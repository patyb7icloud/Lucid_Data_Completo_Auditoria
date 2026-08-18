/**
 * akvResolver.ts
 *
 * Resolve o token Databricks a partir da configuração do conector.
 *
 * Modos suportados (campo authMode):
 *
 *  "token"  → token PAT direto (campo token)
 *
 *  "scope"  → Databricks Secret Scope API  ← RECOMENDADO para ambientes Databricks
 *             Chama GET /api/2.0/secrets/get usando o bootstrapToken,
 *             exatamente como: dbutils.secrets.get(scope=..., key=...)
 *             Não precisa de Azure SDK, Service Principal nem Managed Identity.
 *
 *  "akv"    → Azure Key Vault direto (SDK @azure/identity)
 *             Service Principal ou Managed Identity
 */

import { SecretClient } from "@azure/keyvault-secrets";
import { DefaultAzureCredential, ClientSecretCredential } from "@azure/identity";
import { execSync } from "child_process";

// ─── Modo "scope": Databricks Secret Scope API ────────────────────────────────

/**
 * Busca um segredo via Databricks Secrets REST API.
 * Equivalente a: dbutils.secrets.get(scope, key)
 *
 * @param host           Ex: https://adb-xxx.azuredatabricks.net
 * @param bootstrapToken PAT com permissão de leitura de secrets (pode ser somente-leitura)
 * @param scope          Nome do scope: "key-vault-secrets"
 * @param key            Nome da chave: "Databricks-AccessToken"
 */
export async function resolveDatabricksScopeSecret(
  host: string,
  bootstrapToken: string,
  scope: string,
  key: string,
): Promise<string | null> {
  if (!host || !bootstrapToken || !scope || !key) {
    console.warn("[Scope] Parâmetros incompletos para Databricks Secret Scope.");
    return null;
  }

  try {
    let hostClean = host.trim().replace(/\/$/, "");
    if (!hostClean.startsWith("http")) hostClean = "https://" + hostClean;

    const url = `${hostClean}/api/2.0/secrets/get?scope=${encodeURIComponent(scope)}&key=${encodeURIComponent(key)}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${bootstrapToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Scope] Falha HTTP ${res.status} ao buscar secret "${scope}/${key}": ${errText}`);
      return null;
    }

    const data = await res.json();
    const value: string | null = data?.value ?? null;

    if (!value) {
      console.warn(`[Scope] Segredo "${scope}/${key}" retornou vazio.`);
    } else {
      console.log(`[Scope] Segredo "${scope}/${key}" obtido com sucesso via Databricks Secrets API.`);
    }

    return value;
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error(`[Scope] Erro ao chamar Databricks Secrets API: ${msg}`);
    return null;
  }
}

// ─── Modo "akv": Azure Key Vault direto (SDK) ─────────────────────────────────

const _clientCache = new Map<string, SecretClient>();

function buildCacheKey(vaultUrl: string, clientId?: string, tenantId?: string): string {
  return `${vaultUrl}||${clientId ?? "default"}||${tenantId ?? "default"}`;
}

export async function resolveAkvSecret(
  vaultUrl: string,
  secretName: string,
  spn?: { tenantId: string; clientId: string; clientSecret: string }
): Promise<string | null> {
  if (!vaultUrl || !secretName) {
    console.warn("[AKV] vaultUrl ou secretName não informados.");
    return null;
  }

  try {
    const cacheKey = buildCacheKey(vaultUrl, spn?.clientId, spn?.tenantId);

    if (!_clientCache.has(cacheKey)) {
      let credential;
      if (spn?.tenantId && spn?.clientId && spn?.clientSecret) {
        console.log(`[AKV] Usando ClientSecretCredential (Service Principal: ${spn.clientId})`);
        credential = new ClientSecretCredential(spn.tenantId, spn.clientId, spn.clientSecret);
      } else {
        console.log("[AKV] Usando DefaultAzureCredential (Managed Identity / az login)");
        credential = new DefaultAzureCredential();
      }
      _clientCache.set(cacheKey, new SecretClient(vaultUrl, credential));
    }

    const client = _clientCache.get(cacheKey)!;
    let value: string | null = null;
    
    try {
      const secret = await client.getSecret(secretName);
      value = secret?.value ?? null;
    } catch (err: any) {
      if (err.message?.includes("ChainedTokenCredential") || err.message?.includes("authentication failed")) {
        console.warn("[AKV] @azure/identity falhou no Windows. Tentando fallback forçado via CLI...");
        try {
          const stdout = execSync("az account get-access-token --resource https://vault.azure.net --output json", { encoding: "utf8" });
          const tokenData = JSON.parse(stdout);
          
          let vaultClean = vaultUrl.trim().replace(/\/$/, "");
          const res = await fetch(`${vaultClean}/secrets/${secretName}?api-version=7.4`, {
            headers: { Authorization: `Bearer ${tokenData.accessToken}` }
          });
          
          if (res.ok) {
            const data = await res.json();
            value = data?.value ?? null;
            console.log(`[AKV] Fallback via CLI funcionou! Segredo obtido.`);
          } else {
             throw new Error(`REST API falhou com status ${res.status}`);
          }
        } catch (fallbackErr: any) {
          console.error(`[AKV] Fallback forçado falhou: ${fallbackErr.message}`);
          throw err; // throw original error
        }
      } else {
        throw err;
      }
    }

    if (!value) {
      console.warn(`[AKV] Segredo "${secretName}" encontrado mas está vazio.`);
    } else {
      console.log(`[AKV] Segredo "${secretName}" obtido com sucesso.`);
    }

    return value;
  } catch (err: any) {
    const msg = err?.message?.split("\n")[0] ?? String(err);
    console.error(`[AKV] Falha ao buscar "${secretName}" em "${vaultUrl}": ${msg}`);
    return null;
  }
}

// ─── resolveDatabricksToken — ponto de entrada central ───────────────────────

/**
 * Resolve o token de acesso Databricks conforme o authMode configurado.
 *
 * authMode === "scope"  → Databricks Secret Scope API (RECOMENDADO)
 *   Usa: host + bootstrapToken + scopeName + secretKey
 *   Ex: dbutils.secrets.get(scope='key-vault-secrets', key='Databricks-AccessToken')
 *
 * authMode === "akv"    → Azure Key Vault SDK
 *   Usa: akvVaultUrl + akvSecretName (+ SPN opcional)
 *
 * authMode === "token"  → PAT direto
 */
export async function resolveDatabricksToken(cfg: Record<string, any>): Promise<string | null> {
  const authMode = cfg.authMode ?? "token";

  // ── Modo 1: Databricks Secret Scope (igual ao dbutils.secrets.get) ──────────
  if (authMode === "scope") {
    const scopeName = cfg.scopeName?.trim();
    const secretKey = cfg.secretKey?.trim();
    const bootstrapToken = cfg.bootstrapToken?.trim();

    if (!scopeName || !secretKey || !bootstrapToken) {
      console.warn("[Scope] authMode=scope mas scopeName, secretKey ou bootstrapToken não configurados.");
      return null;
    }

    return resolveDatabricksScopeSecret(cfg.host, bootstrapToken, scopeName, secretKey);
  }

  // ── Modo 2: Azure Key Vault (SDK) ────────────────────────────────────────────
  if (authMode === "akv") {
    const vaultUrl   = cfg.akvVaultUrl?.trim();
    const secretName = cfg.akvSecretName?.trim();

    if (!vaultUrl || !secretName) {
      console.warn("[AKV] authMode=akv mas akvVaultUrl ou akvSecretName não configurados.");
      return null;
    }

    const spn =
      cfg.akvTenantId?.trim() && cfg.akvClientId?.trim() && cfg.akvClientSecret?.trim()
        ? {
            tenantId:     cfg.akvTenantId.trim(),
            clientId:     cfg.akvClientId.trim(),
            clientSecret: cfg.akvClientSecret.trim(),
          }
        : undefined;

    return resolveAkvSecret(vaultUrl, secretName, spn);
  }

  // ── Modo 3: Entra ID via CLI (Bypass) ──────────────────────────────────────
  if (authMode === "entra_id") {
    try {
      console.log("[Databricks] Autenticando via Azure Entra ID (CLI)...");
      const stdout = execSync("az account get-access-token --resource 2ff814a6-3304-4ab8-85cb-cd0e6f879c1d --output json", { encoding: "utf8" });
      const tokenData = JSON.parse(stdout);
      console.log("[Databricks] Token Entra ID gerado com sucesso!");
      return tokenData.accessToken;
    } catch (err: any) {
      console.error("[Databricks] Falha no Entra ID:", err.message);
      return null;
    }
  }

  // ── Modo 4: Token PAT direto ─────────────────────────────────────────────────
  return cfg.token ?? null;
}
