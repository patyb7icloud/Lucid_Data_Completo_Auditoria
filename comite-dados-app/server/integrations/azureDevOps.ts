import {
  buildBasicAuthorization,
  configurationError,
  IntegrationResult,
  pathSegment,
  ProjectIntegrationInput,
  requireObject,
  requireString,
  requestJson,
  requiredEnv,
  safeMetadataUrl,
  safeTicketMetadata,
  secretEnv,
  validateProjectInput,
} from "./http";

export type AzureDevOpsProjectInput = ProjectIntegrationInput;
export type AzureDevOpsUpsertResult = IntegrationResult;

interface AzureDevOpsConfig {
  organization: string;
  project: string;
  workItemType: string;
  authorization: string;
  baseUrl: URL;
}

interface AzureWorkItem {
  id?: unknown;
  url?: unknown;
  fields?: unknown;
  [key: string]: unknown;
}

const SERVICE_NAME = "Azure DevOps";
const API_VERSION = "7.1";

export async function upsertAzureDevOpsProject(
  input: AzureDevOpsProjectInput
): Promise<AzureDevOpsUpsertResult> {
  const project = validateProjectInput(input);
  const config = loadConfig();
  const tag = `LucidProjectId-${project.projectId}`;
  const wiql = buildWiql(config.project, tag);
  const lookupResponse = await requestJson(
    SERVICE_NAME,
    buildApiUrl(config, "/_apis/wit/wiql"),
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: config.authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: wiql }),
    }
  );
  const existingId = parseWiqlId(lookupResponse);
  const payload = buildProjectPayload(project, tag);

  if (existingId) {
    const existingResponse = await requestJson(
      SERVICE_NAME,
      buildApiUrl(
        config,
        `/_apis/wit/workitems/${encodeURIComponent(existingId)}`
      ),
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: config.authorization,
        },
      }
    );
    const existing = parseWorkItem(existingResponse, existingId);
    const tags = mergeTags(readExistingTags(existing), tag);
    const patch = buildJsonPatch(payload, tags);
    const updatedResponse = await requestJson(
      SERVICE_NAME,
      buildApiUrl(
        config,
        `/_apis/wit/workitems/${encodeURIComponent(existingId)}`
      ),
      {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          Authorization: config.authorization,
          "Content-Type": "application/json-patch+json",
        },
        body: JSON.stringify(patch),
      }
    );
    const updated = parseWorkItem(updatedResponse, existingId);
    return toResult(updated, config);
  }

  const workItemType = config.workItemType.startsWith("$")
    ? config.workItemType
    : `$${config.workItemType}`;
  const createResponse = await requestJson(
    SERVICE_NAME,
    buildApiUrl(
      config,
      `/_apis/wit/workitems/${encodeWorkItemType(workItemType)}`
    ),
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: config.authorization,
        "Content-Type": "application/json-patch+json",
      },
      body: JSON.stringify(buildJsonPatch(payload, [tag])),
    }
  );
  const created = parseWorkItem(createResponse);
  return toResult(created, config);
}

function loadConfig(): AzureDevOpsConfig {
  const organization = pathSegment(
    requiredEnv("AZURE_DEVOPS_ORGANIZATION"),
    "AZURE_DEVOPS_ORGANIZATION"
  );
  const project = pathSegment(
    requiredEnv("AZURE_DEVOPS_PROJECT"),
    "AZURE_DEVOPS_PROJECT"
  );
  const workItemType = pathSegment(
    process.env.AZURE_DEVOPS_WORK_ITEM_TYPE?.trim() || "Task",
    "AZURE_DEVOPS_WORK_ITEM_TYPE"
  );
  const accessToken = secretEnv("AZURE_DEVOPS_ACCESS_TOKEN");
  let authorization: string;
  if (accessToken) {
    authorization = `Bearer ${accessToken}`;
  } else {
    const pat = secretEnv("AZURE_DEVOPS_PAT");
    if (!pat) {
      throw configurationError(
        "set AZURE_DEVOPS_ACCESS_TOKEN or the compatibility AZURE_DEVOPS_PAT"
      );
    }
    authorization = buildBasicAuthorization("", pat);
  }

  const baseUrl = new URL(
    `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}`
  );
  return { organization, project, workItemType, authorization, baseUrl };
}

function buildWiql(project: string, tag: string): string {
  const escapedProject = project.replace(/'/g, "''");
  const escapedTag = tag.replace(/'/g, "''");
  return [
    "SELECT [System.Id]",
    "FROM WorkItems",
    `WHERE [System.TeamProject] = '${escapedProject}'`,
    `AND [System.Tags] CONTAINS '${escapedTag}'`,
    "ORDER BY [System.Id]",
  ].join(" ");
}

function buildProjectPayload(
  project: AzureDevOpsProjectInput,
  tag: string
): { title: string; description: string; tag: string } {
  const descriptionLines = [
    `Lucid AI project ID: ${project.projectId}`,
    `Project name: ${project.name}`,
    `Risk level: ${project.riskLevel}`,
    `Project type: ${project.projectType}`,
  ];
  if (project.description)
    descriptionLines.push(`Project description: ${project.description}`);
  if (project.servicenowTicket) {
    descriptionLines.push(
      `ServiceNow ticket: ${safeTicketMetadata(project.servicenowTicket)}`
    );
  }
  if (project.azureDevopsUrl) {
    descriptionLines.push(
      `Azure DevOps URL: ${safeMetadataUrl(project.azureDevopsUrl, "azureDevopsUrl")}`
    );
  }
  return {
    title: `Lucid AI project: ${project.name}`,
    description: descriptionLines.join("\n"),
    tag,
  };
}

function buildJsonPatch(
  payload: { title: string; description: string; tag: string },
  tags: string[]
): Array<{ op: "add"; path: string; value: string }> {
  return [
    { op: "add", path: "/fields/System.Title", value: payload.title },
    {
      op: "add",
      path: "/fields/System.Description",
      value: payload.description,
    },
    { op: "add", path: "/fields/System.Tags", value: tags.join("; ") },
  ];
}

function parseWiqlId(payload: unknown): string | undefined {
  const root = requireObject(payload, SERVICE_NAME);
  if (!Array.isArray(root.workItems)) {
    throw new Error(`${SERVICE_NAME} returned an invalid response`);
  }
  if (root.workItems.length === 0) return undefined;
  const first = requireObject(root.workItems[0], SERVICE_NAME);
  return validateWorkItemId(first.id);
}

function parseWorkItem(payload: unknown, fallbackId?: string): AzureWorkItem {
  const item = requireObject(payload, SERVICE_NAME) as AzureWorkItem;
  const id = item.id === undefined ? fallbackId : validateWorkItemId(item.id);
  if (!id) throw new Error(`${SERVICE_NAME} returned an invalid response`);
  return { ...item, id };
}

function validateWorkItemId(value: unknown): string {
  const id = requireString(value, SERVICE_NAME, "id");
  if (!/^[1-9][0-9]{0,18}$/.test(id)) {
    throw new Error(`${SERVICE_NAME} returned an invalid response`);
  }
  return id;
}

function readExistingTags(item: AzureWorkItem): string[] {
  if (item.fields === undefined || item.fields === null) return [];
  const fields = requireObject(item.fields, SERVICE_NAME);
  const value = fields["System.Tags"];
  if (value === undefined || value === null || value === "") return [];
  if (typeof value !== "string") {
    throw new Error(`${SERVICE_NAME} returned an invalid response`);
  }
  return value
    .split(";")
    .map(tag => tag.trim())
    .filter(Boolean);
}

function mergeTags(existing: string[], requiredTag: string): string[] {
  const tags = [...existing];
  if (!tags.some(tag => tag.toLowerCase() === requiredTag.toLowerCase())) {
    tags.push(requiredTag);
  }
  return tags;
}

function toResult(
  item: AzureWorkItem,
  config: AzureDevOpsConfig
): AzureDevOpsUpsertResult {
  const remoteId = validateWorkItemId(item.id);
  return {
    remoteId,
    remoteNumber: remoteId,
    remoteUrl: buildWebUrl(config, remoteId),
  };
}

function buildApiUrl(config: AzureDevOpsConfig, suffix: string): URL {
  const result = new URL(config.baseUrl.toString());
  const prefix = result.pathname.replace(/\/+$/, "");
  result.pathname = `${prefix}${suffix}`;
  result.search = "";
  result.hash = "";
  result.searchParams.set("api-version", API_VERSION);
  return result;
}

function encodeWorkItemType(workItemType: string): string {
  return encodeURIComponent(workItemType).replace(/%24/gi, "$");
}

function buildWebUrl(config: AzureDevOpsConfig, remoteId: string): string {
  const result = new URL(config.baseUrl.toString());
  const prefix = result.pathname.replace(/\/+$/, "");
  result.pathname = `${prefix}/_workitems/edit/${encodeURIComponent(remoteId)}`;
  result.search = "";
  result.hash = "";
  return result.toString();
}
