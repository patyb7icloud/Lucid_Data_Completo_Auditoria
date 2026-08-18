import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";

export type DatabricksCredentialSource = "config" | "environment" | "key_vault";

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

function normalizeSecretName(value?: string) {
  const secretName = value?.trim();
  return secretName || process.env.AZURE_KEY_VAULT_SECRET_NAME?.trim() || DEFAULT_SECRET_NAME;
}

/**
 * Resolve o token sem permitir que o segredo seja armazenado ou enviado ao cliente.
 * O uso de Key Vault é ativado por tokenSource=key_vault ou pela presença de AZURE_KEY_VAULT_URL.
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

  const vaultUrl = config.keyVaultUrl?.trim() || process.env.AZURE_KEY_VAULT_URL?.trim();
  if (!vaultUrl) {
    throw new DatabricksCredentialError(
      "CONFIG_MISSING",
      "Token Databricks ausente. Configure token, DATABRICKS_TOKEN ou AZURE_KEY_VAULT_URL.",
    );
  }

  try {
    const client = new SecretClient(vaultUrl, new DefaultAzureCredential());
    const secret = await client.getSecret(normalizeSecretName(config.keyVaultSecretName));
    if (!secret.value?.trim()) {
      throw new DatabricksCredentialError(
        "KEY_VAULT_FAILED",
        "O segredo do Azure Key Vault não possui valor.",
      );
    }
    return { token: secret.value.trim(), source: "key_vault" };
  } catch (error) {
    if (error instanceof DatabricksCredentialError) throw error;
    throw new DatabricksCredentialError(
      "KEY_VAULT_FAILED",
      "Não foi possível obter o token Databricks no Azure Key Vault.",
      { cause: error },
    );
  }
}

/** Evita que tokens e URLs de autenticação apareçam no log ou na resposta HTTP. */
export function redactDatabricksError(message: string) {
  return message
    .replace(/dapi[a-zA-Z0-9_-]+/g, "[REDACTED_TOKEN]")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED_TOKEN]")
    .replace(/(token|access_token|client_secret)=([^&\s]+)/gi, "$1=[REDACTED]");
}
