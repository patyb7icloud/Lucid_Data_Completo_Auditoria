export const INTEGRATION_TIMEOUT_MS = 15_000;

export interface ProjectIntegrationInput {
  projectId: string;
  name: string;
  description?: string;
  riskLevel: string;
  projectType: string;
  servicenowTicket?: string;
  azureDevopsUrl?: string;
}

export interface IntegrationResult {
  remoteId: string;
  remoteNumber?: string;
  remoteUrl: string;
}

const PROJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const CONTROL_CHARACTER_PATTERN =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function configurationError(message: string): Error {
  return new Error(`Integration configuration error: ${message}`);
}

export function inputError(message: string): Error {
  return new Error(`Invalid integration input: ${message}`);
}

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw configurationError(`missing ${name}`);
  }
  return value.trim();
}

export function secretEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

export function validateIdentifier(value: string, name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw configurationError(`${name} must be a valid identifier`);
  }
  return value;
}

export function validateProjectInput(value: unknown): ProjectIntegrationInput {
  if (!value || typeof value !== "object") {
    throw inputError("project input is required");
  }

  const candidate = value as Record<string, unknown>;
  const projectId = requiredInputString(candidate.projectId, "projectId");
  if (!PROJECT_ID_PATTERN.test(projectId)) {
    throw inputError("projectId is not a valid identifier");
  }

  const name = requiredInputString(candidate.name, "name");
  const riskLevel = requiredInputString(candidate.riskLevel, "riskLevel");
  const projectType = requiredInputString(candidate.projectType, "projectType");
  const description = optionalInputString(candidate.description, "description");
  const servicenowTicket = optionalInputString(
    candidate.servicenowTicket,
    "servicenowTicket"
  );
  const azureDevopsUrl = optionalInputString(
    candidate.azureDevopsUrl,
    "azureDevopsUrl"
  );

  return {
    projectId,
    name,
    ...(description === undefined ? {} : { description }),
    riskLevel,
    projectType,
    ...(servicenowTicket === undefined ? {} : { servicenowTicket }),
    ...(azureDevopsUrl === undefined ? {} : { azureDevopsUrl }),
  };
}

function requiredInputString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw inputError(`${name} is required`);
  }
  const normalized = value.trim();
  if (CONTROL_CHARACTER_PATTERN.test(normalized)) {
    throw inputError(`${name} contains unsupported characters`);
  }
  return normalized;
}

function optionalInputString(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || CONTROL_CHARACTER_PATTERN.test(value)) {
    throw inputError(`${name} contains unsupported characters`);
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function validateHttpsUrl(rawValue: string, name: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawValue);
  } catch {
    throw configurationError(`${name} must be a valid HTTPS URL`);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname.length === 0 ||
    parsed.username.length > 0 ||
    parsed.password.length > 0
  ) {
    throw configurationError(`${name} must be a valid HTTPS URL`);
  }
  return parsed;
}

/**
 * Keep a client-provided URL as metadata only. Query and fragment values are
 * removed so accidental bearer/query secrets are never copied to a ticket.
 */
export function safeMetadataUrl(rawValue: string, name: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawValue);
  } catch {
    throw inputError(`${name} must be a valid HTTPS URL`);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname.length === 0 ||
    parsed.username.length > 0 ||
    parsed.password.length > 0
  ) {
    throw inputError(`${name} must be a valid HTTPS URL`);
  }
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

export function safeTicketMetadata(value: string): string {
  if (!/^https?:\/\//i.test(value)) return value;
  return safeMetadataUrl(value, "servicenowTicket");
}

export function pathSegment(value: string, name: string): string {
  if (
    value.length === 0 ||
    value.length > 256 ||
    CONTROL_CHARACTER_PATTERN.test(value) ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes("?") ||
    value.includes("#")
  ) {
    throw configurationError(`${name} must be a valid path segment`);
  }
  return value;
}

export async function requestJson(
  service: string,
  url: URL,
  init: RequestInit
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(INTEGRATION_TIMEOUT_MS),
    });
  } catch {
    throw new Error(`${service} request failed`);
  }

  if (
    !Number.isInteger(response.status) ||
    response.status < 100 ||
    response.status > 599
  ) {
    throw new Error(`${service} request failed`);
  }
  if (response.status < 200 || response.status > 299) {
    throw new Error(`${service} request failed (status ${response.status})`);
  }

  try {
    return (await response.json()) as unknown;
  } catch {
    throw new Error(`${service} returned invalid JSON`);
  }
}

export function requireObject(
  value: unknown,
  service: string
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${service} returned an invalid response`);
  }
  return value as Record<string, unknown>;
}

export function requireString(
  value: unknown,
  service: string,
  field: string
): string {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    String(value).trim().length === 0
  ) {
    throw new Error(`${service} returned an invalid response`);
  }
  const normalized = String(value).trim();
  if (CONTROL_CHARACTER_PATTERN.test(normalized)) {
    throw new Error(`${service} returned an invalid response`);
  }
  return normalized;
}

export function buildBasicAuthorization(
  username: string,
  password: string
): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}
