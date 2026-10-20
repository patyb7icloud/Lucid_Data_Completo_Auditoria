import {
  buildBasicAuthorization,
  configurationError,
  IntegrationResult,
  ProjectIntegrationInput,
  requireObject,
  requireString,
  requestJson,
  requiredEnv,
  safeMetadataUrl,
  safeTicketMetadata,
  secretEnv,
  validateHttpsUrl,
  validateIdentifier,
  validateProjectInput,
} from "./http";

export type ServiceNowProjectInput = ProjectIntegrationInput;
export type ServiceNowUpsertResult = IntegrationResult;

interface ServiceNowConfig {
  instanceUrl: URL;
  table: string;
  correlationField: string;
  authorization: string;
}

interface ServiceNowRecord {
  sys_id?: unknown;
  number?: unknown;
  [key: string]: unknown;
}

const SERVICE_NAME = "ServiceNow";

export async function upsertServiceNowProject(
  input: ServiceNowProjectInput
): Promise<ServiceNowUpsertResult> {
  const project = validateProjectInput(input);
  const config = loadConfig();
  const payload = buildRecordPayload(project, config.correlationField);
  const correlationId = `lucid-ai-project-${project.projectId}`;
  const recordsUrl = buildPath(
    config.instanceUrl,
    `/api/now/table/${config.table}`
  );
  const lookupUrl = new URL(recordsUrl.toString());
  lookupUrl.searchParams.set(
    "sysparm_query",
    `${config.correlationField}=${correlationId}`
  );
  lookupUrl.searchParams.set("sysparm_fields", "sys_id,number");
  lookupUrl.searchParams.set("sysparm_limit", "1");

  const lookupResponse = await requestJson(SERVICE_NAME, lookupUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: config.authorization,
    },
  });
  const existing = parseLookupResult(lookupResponse);

  if (existing) {
    const remoteId = requireString(existing.sys_id, SERVICE_NAME, "sys_id");
    const updateUrl = buildPath(recordsUrl, `/${encodeURIComponent(remoteId)}`);
    const updateResponse = await requestJson(SERVICE_NAME, updateUrl, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        Authorization: config.authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const updated = parseRecordResult(updateResponse);
    return toResult(
      updated ? { ...existing, ...updated } : existing,
      remoteId,
      config.instanceUrl,
      config.table
    );
  }

  const createResponse = await requestJson(SERVICE_NAME, recordsUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: config.authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const created = parseRecordResult(createResponse);
  if (!created) {
    throw new Error(`${SERVICE_NAME} returned an invalid response`);
  }
  return toResult(created, undefined, config.instanceUrl, config.table);
}

function loadConfig(): ServiceNowConfig {
  const instanceUrl = validateHttpsUrl(
    requiredEnv("SERVICENOW_INSTANCE_URL"),
    "SERVICENOW_INSTANCE_URL"
  );
  if (instanceUrl.search || instanceUrl.hash) {
    throw configurationError(
      "SERVICENOW_INSTANCE_URL must not contain a query or fragment"
    );
  }

  const table = validateIdentifier(
    process.env.SERVICENOW_TABLE?.trim() || "incident",
    "SERVICENOW_TABLE"
  );
  const correlationField = validateIdentifier(
    process.env.SERVICENOW_CORRELATION_FIELD?.trim() || "correlation_id",
    "SERVICENOW_CORRELATION_FIELD"
  );

  const accessToken = secretEnv("SERVICENOW_ACCESS_TOKEN");
  let authorization: string;
  if (accessToken) {
    authorization = `Bearer ${accessToken}`;
  } else {
    const username = secretEnv("SERVICENOW_USERNAME");
    const password = secretEnv("SERVICENOW_PASSWORD");
    if (!username || !password) {
      throw configurationError(
        "set SERVICENOW_ACCESS_TOKEN or the compatibility SERVICENOW_USERNAME and SERVICENOW_PASSWORD"
      );
    }
    authorization = buildBasicAuthorization(username, password);
  }

  return { instanceUrl, table, correlationField, authorization };
}

function buildRecordPayload(
  project: ServiceNowProjectInput,
  correlationField: string
): Record<string, string> {
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
    [correlationField]: `lucid-ai-project-${project.projectId}`,
    short_description: `Lucid AI project: ${project.name}`,
    description: descriptionLines.join("\n"),
  };
}

function parseLookupResult(payload: unknown): ServiceNowRecord | undefined {
  const root = requireObject(payload, SERVICE_NAME);
  if (!Array.isArray(root.result)) {
    throw new Error(`${SERVICE_NAME} returned an invalid response`);
  }
  if (root.result.length === 0) return undefined;
  return requireObject(root.result[0], SERVICE_NAME) as ServiceNowRecord;
}

function parseRecordResult(payload: unknown): ServiceNowRecord | undefined {
  const root = requireObject(payload, SERVICE_NAME);
  if (root.result === undefined || root.result === null) return undefined;
  return requireObject(root.result, SERVICE_NAME) as ServiceNowRecord;
}

function toResult(
  record: ServiceNowRecord,
  fallbackId: string | undefined,
  instanceUrl: URL,
  table: string
): ServiceNowUpsertResult {
  const remoteId =
    fallbackId ?? requireString(record.sys_id, SERVICE_NAME, "sys_id");
  const remoteNumber = optionalRemoteNumber(record.number);
  return {
    remoteId,
    ...(remoteNumber === undefined ? {} : { remoteNumber }),
    remoteUrl: buildRecordUrl(instanceUrl, table, remoteId),
  };
}

function optionalRemoteNumber(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`${SERVICE_NAME} returned an invalid response`);
  }
  const result = String(value).trim();
  if (result.length === 0 || /[\u0000-\u001F\u007F]/.test(result)) {
    throw new Error(`${SERVICE_NAME} returned an invalid response`);
  }
  return result;
}

function buildPath(base: URL, suffix: string): URL {
  const result = new URL(base.toString());
  const prefix = result.pathname.replace(/\/+$/, "");
  result.pathname = `${prefix}${suffix}`;
  result.search = "";
  result.hash = "";
  return result;
}

function buildRecordUrl(
  instanceUrl: URL,
  table: string,
  remoteId: string
): string {
  const result = buildPath(instanceUrl, "/nav_to.do");
  result.searchParams.set("uri", `${table}.do?sys_id=${remoteId}`);
  return result.toString();
}
