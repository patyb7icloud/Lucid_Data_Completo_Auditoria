/**
 * databricksGrantService.ts
 *
 * Executa concessão/revogação de permissões via Databricks Unity Catalog REST API
 * após aprovação final (Data Steward) de uma solicitação de acesso.
 *
 * Documentação da API:
 *   PATCH /api/2.1/unity-catalog/permissions/{securable_type}/{full_name}
 *   https://docs.databricks.com/api/workspace/grants/update
 */

export type GrantResult =
  | { ok: true; grantedPermissions: string[] }
  | { ok: false; reason: string };

export interface DatabricksConnectorConfig {
  /** ex: "https://adb-1234567890.12.azuredatabricks.net" */
  host: string;
  /** Personal Access Token ou token de Service Principal */
  token: string;
}

/** Mapeia nivelAcesso do portal para privileges do Unity Catalog */
function toPrivileges(nivelAcesso: "leitura" | "leitura_escrita"): string[] {
  return nivelAcesso === "leitura_escrita"
    ? ["SELECT", "MODIFY"]
    : ["SELECT"];
}

/**
 * Concede permissões no Unity Catalog do Databricks.
 *
 * @param config          Configuração do conector (host + token)
 * @param fullyQualifiedName  Nome completo da tabela: "catalog.schema.table"
 * @param principal       E-mail ou grupo AAD do solicitante
 * @param nivelAcesso     Nível de acesso aprovado
 */
export async function grantDatabricksPermission(
  config: DatabricksConnectorConfig,
  fullyQualifiedName: string,
  principal: string,
  nivelAcesso: "leitura" | "leitura_escrita"
): Promise<GrantResult> {
  const privileges = toPrivileges(nivelAcesso);

  // Unity Catalog usa "table" como securable_type para tabelas
  const url = `${config.host.replace(/\/$/, "")}/api/2.1/unity-catalog/permissions/table/${encodeURIComponent(fullyQualifiedName)}`;

  const body = {
    changes: [
      {
        principal,
        add: privileges,
      },
    ],
  };

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    return { ok: false, reason: `Falha de rede ao contactar Databricks: ${err?.message ?? err}` };
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => "(sem corpo)");
    return {
      ok: false,
      reason: `Databricks retornou HTTP ${resp.status}: ${text}`,
    };
  }

  return { ok: true, grantedPermissions: privileges };
}

/**
 * Revoga permissões no Unity Catalog (usado em eventual desativação).
 */
export async function revokeDatabricksPermission(
  config: DatabricksConnectorConfig,
  fullyQualifiedName: string,
  principal: string,
  nivelAcesso: "leitura" | "leitura_escrita"
): Promise<GrantResult> {
  const privileges = toPrivileges(nivelAcesso);

  const url = `${config.host.replace(/\/$/, "")}/api/2.1/unity-catalog/permissions/table/${encodeURIComponent(fullyQualifiedName)}`;

  const body = {
    changes: [
      {
        principal,
        remove: privileges,
      },
    ],
  };

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    return { ok: false, reason: `Falha de rede ao contactar Databricks: ${err?.message ?? err}` };
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => "(sem corpo)");
    return { ok: false, reason: `Databricks retornou HTTP ${resp.status}: ${text}` };
  }

  return { ok: true, grantedPermissions: privileges };
}
