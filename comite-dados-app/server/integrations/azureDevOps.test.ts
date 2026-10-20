import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { upsertAzureDevOpsProject } from "./azureDevOps";

const ENV_NAMES = [
  "AZURE_DEVOPS_ORGANIZATION",
  "AZURE_DEVOPS_PROJECT",
  "AZURE_DEVOPS_WORK_ITEM_TYPE",
  "AZURE_DEVOPS_ACCESS_TOKEN",
  "AZURE_DEVOPS_PAT",
] as const;

const originalEnv = { ...process.env };

const project = {
  projectId: "project-123",
  name: "Quarterly controls",
  description: "Control review project",
  riskLevel: "high",
  projectType: "audit",
  servicenowTicket: "INC0012345",
  azureDevopsUrl: "https://dev.azure.com/example/project/_workitems/edit/12",
};

describe("upsertAzureDevOpsProject", () => {
  beforeEach(() => {
    clearIntegrationEnv();
    process.env.AZURE_DEVOPS_ORGANIZATION = "example-org";
    process.env.AZURE_DEVOPS_PROJECT = "Governance Project";
    process.env.AZURE_DEVOPS_ACCESS_TOKEN = "ado-secret-token";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    restoreEnv();
  });

  it("falha por configuração ausente antes de chamar fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    delete process.env.AZURE_DEVOPS_ORGANIZATION;

    await expect(upsertAzureDevOpsProject(project)).rejects.toThrow(
      "AZURE_DEVOPS_ORGANIZATION"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pesquisa a tag e cria um Task com JSON Patch quando não há item", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ workItems: [] }))
      .mockResolvedValueOnce(
        jsonResponse({ id: 42, url: "https://dev.azure.com/api/item/42" })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await upsertAzureDevOpsProject(project);
    expect(result).toEqual({
      remoteId: "42",
      remoteNumber: "42",
      remoteUrl:
        "https://dev.azure.com/example-org/Governance%20Project/_workitems/edit/42",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const wiqlUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(wiqlUrl.pathname).toBe(
      "/example-org/Governance%20Project/_apis/wit/wiql"
    );
    expect(wiqlUrl.searchParams.get("api-version")).toBe("7.1");
    const wiqlInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(wiqlInit.method).toBe("POST");
    expect(wiqlInit.headers).toMatchObject({
      Authorization: "Bearer ado-secret-token",
    });
    expect(JSON.parse(String(wiqlInit.body)).query).toContain(
      "[System.Tags] CONTAINS 'LucidProjectId-project-123'"
    );
    expect(JSON.parse(String(wiqlInit.body)).query).toContain(
      "[System.TeamProject] = 'Governance Project'"
    );

    const createUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(createUrl.pathname).toBe(
      "/example-org/Governance%20Project/_apis/wit/workitems/$Task"
    );
    const createInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(createInit.headers).toMatchObject({
      "Content-Type": "application/json-patch+json",
    });
    const patch = JSON.parse(String(createInit.body)) as Array<{
      path: string;
      value: string;
    }>;
    expect(patch.map(operation => operation.path)).toEqual([
      "/fields/System.Title",
      "/fields/System.Description",
      "/fields/System.Tags",
    ]);
    expect(patch[2]?.value).toBe("LucidProjectId-project-123");
  });

  it("pesquisa por tag, lê o item e atualiza preservando tags existentes", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ workItems: [{ id: 41 }] }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 41,
          fields: { "System.Tags": "Existing; Security" },
        })
      )
      .mockResolvedValueOnce(jsonResponse({ id: 41 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await upsertAzureDevOpsProject(project);
    expect(result.remoteId).toBe("41");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe("GET");
    const updateInit = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(updateInit.method).toBe("PATCH");
    expect(updateInit.headers).toMatchObject({
      "Content-Type": "application/json-patch+json",
    });
    const patch = JSON.parse(String(updateInit.body)) as Array<{
      path: string;
      value: string;
    }>;
    const tagsOperation = patch.find(
      operation => operation.path === "/fields/System.Tags"
    );
    expect(tagsOperation?.value).toBe(
      "Existing; Security; LucidProjectId-project-123"
    );
  });

  it("não expõe body de erro nem segredo", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "body-secret-should-not-leak",
          token: "ado-secret-token",
        }),
        {
          status: 401,
          headers: { "content-type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const error = await upsertAzureDevOpsProject(project).catch(
      value => value as Error
    );
    expect(error.message).toContain("Azure DevOps");
    expect(error.message).toContain("401");
    expect(error.message).not.toContain("body-secret-should-not-leak");
    expect(error.message).not.toContain("ado-secret-token");
  });
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function clearIntegrationEnv(): void {
  for (const name of ENV_NAMES) delete process.env[name];
}

function restoreEnv(): void {
  for (const name of ENV_NAMES) {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  }
}
