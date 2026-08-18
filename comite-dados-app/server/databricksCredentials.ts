import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import { execFileSync } from "node:child_process";

export type DatabricksCredentialSource =
  | "config"
  | "environment"
  | "key_vault"
  | "azure_ad"
  | "azure_cli";

export type DatabricksCredentialConfig = {
  token?: string;
  tokenSource?: "pat" | "key_vault";
  useKeyVault?: boolean | string;
  keyVaultUrl?: string;
  keyVaultSecretName?: string;
};

export class DatabricksCredentialError extends Error {
  constructor(
    public readonly code: "CONFIG_MISSING" | "KEY_VAULT_FAILED",
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "DatabricksCredentialError";
  }
}

export type DatabricksCrawlerErrorCode =
  | "CONFIG_MISSING"
  | "CONNECTION_FAILED"
  | "QUERY_FAILED"
  | "CATALOG_ACCESS_DENIED"
  | "KEY_VAULT_FAILED";

export class DatabricksCrawlerError extends Error {
  constructor(
    public readonly code: DatabricksCrawlerErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "DatabricksCrawlerError";
  }
}

const DEFAULT_SECRET_NAME = "Databricks-AccessToken";
const DATABRICKS_AAD_RESOURCE = "2ff814a6-3304-4ab8-85cb-cd0e6f879c1d";

function normalizeSecretName(value?: string) {
  const secretName = value?.trim();
  return secretName || process.env.AZURE_KEY_VAULT_SECRET_NAME?.trim() || DEFAULT_SECRET_NAME;
}

function configuredVaultUrl(config: DatabricksCredentialConfig): string | undefined {
  return (
    config.keyVaultUrl?.trim() ||
    process.env.AZURE_KEY_VAULT_URL?.trim() ||
    // Compatibilidade com o projeto Auditoria-de-Governanca-de-Dados-Databricks.
    process.env.AZURE_KEYVAULT_URL?.trim()
  );
}

async function getSecretFromKeyVault(vaultUrl: string, secretName: string): Promise<string> {
  try {
    const client = new SecretClient(vaultUrl, new DefaultAzureCredential());
    const secret = await client.getSecret(secretName);
    if (!secret.value?.trim()) {
      throw new Error("O segredo do Azure Key Vault não possui valor.");
    }
    return secret.value.trim();
  } catch (error) {
    if (error instanceof DatabricksCredentialError) throw error;
    throw new DatabricksCredentialError(
      "KEY_VAULT_FAILED",
      "Não foi possível obter o token Databricks no Azure Key Vault.",
      { cause: error },
    );
  }
}

async function getTokenWithDefaultCredential(): Promise<string | null> {
  try {
    const credential = new DefaultAzureCredential();
    const token = await credential.getToken(`${DATABRICKS_AAD_RESOURCE}/.default`);
    return token?.token?.trim() || null;
  } catch {
    // Falhas de uma fonte são tratadas como fallback; detalhes nunca são logados.
    return null;
  }
}

function findAzCli(): string | null {
  try {
    const result = execFileSync(
      process.platform === "win32" ? "where.exe" : "which",
      ["az"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return result ? "az" : null;
  } catch {
    return null;
  }
}

function getTokenWithAzCli(): string | null {
  const az = findAzCli();
  if (!az) return null;
  try {
    const output = execFileSync(
      az,
      ["account", "get-access-token", "--resource", DATABRICKS_AAD_RESOURCE, "--query", "accessToken", "-o", "tsv"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return output || null;
  } catch {
    return null;
  }
}

/**
 * Resolve o token no servidor. A prioridade normal é configuração explícita,
 * variável de ambiente e Key Vault. Quando Key Vault é selecionado, a mesma
 * cadeia de fallback do projeto de referência é usada: Key Vault, Azure AD e
 * Azure CLI. O segredo existe apenas em memória durante a operação.
 */
export async function resolveDatabricksToken(
  config: DatabricksCredentialConfig = {},
): Promise<{ token: string; source: DatabricksCredentialSource }> {
  const explicitlyWantsKeyVault =
    config.tokenSource === "key_vault" ||
    config.useKeyVault === true ||
    config.useKeyVault === "true" ||
    Boolean(config.keyVaultUrl?.trim());

  if (!explicitlyWantsKeyVault && config.token?.trim()) {
    return { token: config.token.trim(), source: "config" };
  }

  if (!explicitlyWantsKeyVault && process.env.DATABRICKS_TOKEN?.trim()) {
    return { token: process.env.DATABRICKS_TOKEN.trim(), source: "environment" };
  }

  const vaultUrl = configuredVaultUrl(config);
  let keyVaultError: DatabricksCredentialError | undefined;
  if (vaultUrl) {
    try {
      const token = await getSecretFromKeyVault(vaultUrl, normalizeSecretName(config.keyVaultSecretName));
      return { token, source: "key_vault" };
    } catch (error) {
      keyVaultError = error instanceof DatabricksCredentialError
        ? error
        : new DatabricksCredentialError("KEY_VAULT_FAILED", "Falha ao acessar o Azure Key Vault.", { cause: error });
    }
  }

  // Mesmo que o Key Vault esteja configurado, reproduz o fallback Azure AD da referência.
  const tokenFromCredential = await getTokenWithDefaultCredential();
  if (tokenFromCredential) return { token: tokenFromCredential, source: "azure_ad" };

  // O fallback via Azure CLI é útil em desenvolvimento e em hosts com az login ativo.
  const tokenFromAzCli = getTokenWithAzCli();
  if (tokenFromAzCli) return { token: tokenFromAzCli, source: "azure_cli" };

  if (keyVaultError) throw keyVaultError;
  throw new DatabricksCredentialError(
    "CONFIG_MISSING",
    "Token Databricks ausente. Configure token, DATABRICKS_TOKEN, Azure Key Vault, identidade Azure ou az login.",
  );
}

/** Evita que tokens e URLs de autenticação apareçam no log ou na resposta HTTP. */
export function redactDatabricksError(message: string, secrets: string[] = []) {
  let safe = message;
  for (const secret of secrets) {
    const value = secret.trim();
    if (!value) continue;
    safe = safe.replace(new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "[REDACTED_TOKEN]");
  }
  return safe
    .replace(/dapi[a-zA-Z0-9_-]+/g, "[REDACTED_TOKEN]")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED_TOKEN]")
    .replace(/(token|access_token|client_secret)=([^&\s]+)/gi, "$1=[REDACTED]");
}
