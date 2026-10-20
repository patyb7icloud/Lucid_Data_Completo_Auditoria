import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { upsertServiceNowProject } from "./serviceNow";

const ENV_NAMES = [
  "SERVICENOW_INSTANCE_URL",
  "SERVICENOW_ACCESS_TOKEN",
  "SERVICENOW_USERNAME",
  "SERVICENOW_PASSWORD",
  "SERVICENOW_TABLE",
  "SERVICENOW_CORRELATION_FIELD",
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

describe("upsertServiceNowProject", () => {
  beforeEach(() => {
    clearIntegrationEnv();
    process.env.SERVICENOW_INSTANCE_URL = "https://servicenow.example.test";
    process.env.SERVICENOW_ACCESS_TOKEN = "sn-secret-token";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    restoreEnv();
  });

  it("falha por configuração ausente antes de chamar fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    delete process.env.SERVICENOW_INSTANCE_URL;

    await expect(upsertServiceNowProject(project)).rejects.toThrow(
      "SERVICENOW_INSTANCE_URL"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("consulta o correlation ID e cria quando não existe", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ result: [] }))
      .mockResolvedValueOnce(
        jsonResponse({ result: { sys_id: "abc123", number: "INC0099" } })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await upsertServiceNowProject(project);
    expect(result).toEqual({
      remoteId: "abc123",
      remoteNumber: "INC0099",
      remoteUrl:
        "https://servicenow.example.test/nav_to.do?uri=incident.do%3Fsys_id%3Dabc123",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const lookupUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(lookupUrl.pathname).toBe("/api/now/table/incident");
    expect(lookupUrl.searchParams.get("sysparm_query")).toBe(
      "correlation_id=lucid-ai-project-project-123"
    );
    expect(lookupUrl.searchParams.get("sysparm_fields")).toBe("sys_id,number");
    expect(lookupUrl.searchParams.get("sysparm_limit")).toBe("1");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "GET",
      headers: expect.objectContaining({
        Authorization: "Bearer sn-secret-token",
      }),
    });

    const createInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(createInit.method).toBe("POST");
    expect(createInit.headers).toMatchObject({
      "Content-Type": "application/json",
    });
    const body = JSON.parse(String(createInit.body)) as Record<string, string>;
    expect(body.correlation_id).toBe("lucid-ai-project-project-123");
    expect(body.description).toContain("Quarterly controls");
    expect(body.description).not.toContain("sn-secret-token");
  });

  it("consulta o correlation ID e atualiza quando o registro existe", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({ result: [{ sys_id: "existing-id", number: "INC0001" }] })
      )
      .mockResolvedValueOnce(
        jsonResponse({ result: { sys_id: "existing-id", number: "INC0002" } })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await upsertServiceNowProject(project);
    expect(result.remoteId).toBe("existing-id");
    expect(result.remoteNumber).toBe("INC0002");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe("PATCH");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      "/api/now/table/incident/existing-id"
    );
  });

  it("não expõe body de erro nem segredo", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "body-secret-should-not-leak",
          token: "sn-secret-token",
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const error = await upsertServiceNowProject(project).catch(
      value => value as Error
    );
    expect(error.message).toContain("ServiceNow");
    expect(error.message).toContain("500");
    expect(error.message).not.toContain("body-secret-should-not-leak");
    expect(error.message).not.toContain("sn-secret-token");
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
