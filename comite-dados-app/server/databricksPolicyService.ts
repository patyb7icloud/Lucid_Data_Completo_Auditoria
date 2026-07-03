/**
 * databricksPolicyService.ts — Políticas de Proteção no Unity Catalog com Fluxo de Aprovação
 *
 * Implementa o ciclo seguro de aplicação de políticas PII no Databricks Unity Catalog:
 *
 *   CICLO DE APROVAÇÃO (espelho do padrão syncApproved dos atributos):
 *   ┌─────────────────────────────────────────────────────────────────────────┐
 *   │  1. PII detectado pelo scanner/agente                                   │
 *   │     → piiPolicyStatus = 'pendente_revisao'                              │
 *   │                                                                         │
 *   │  2. Steward/Admin revisa o preview das políticas (SQL gerado)           │
 *   │     → previewPiiPolicies() — mostra os SQLs que serão executados        │
 *   │                                                                         │
 *   │  3. Steward aprova ou rejeita                                           │
 *   │     → approvePiiPolicies()  → piiPolicyStatus = 'aprovado'             │
 *   │     → rejectPiiPolicies()   → piiPolicyStatus = 'rejeitado'            │
 *   │                                                                         │
 *   │  4. Somente após aprovação: botão "Sync Databricks" executa             │
 *   │     → syncApprovedPiiPolicies() → piiPolicyStatus = 'sincronizado'     │
 *   └─────────────────────────────────────────────────────────────────────────┘
 *
 * Políticas aplicadas no Unity Catalog:
 *   1. Masking Policies   — Substitui o valor real por '***PII***' para usuários
 *                           sem os grupos data_steward / data_owner / admins.
 *   2. Column-Level Permissions — Revoga SELECT em colunas de alto risco.
 *   3. Row-Level Security — Opcional; filtra linhas por coluna de usuário.
 *
 * Documentação Unity Catalog:
 *   https://docs.databricks.com/data-governance/unity-catalog/row-and-column-filters.html
 */

import type { PiiScanResult } from "./piiScanner";
import * as db from "./db";

// ─── Tipos Exportados ─────────────────────────────────────────────────────────

export interface DatabricksPolicyConfig {
  /** Ex: "https://adb-1234567890.12.azuredatabricks.net" */
  host: string;
  /** Personal Access Token ou token de Service Principal */
  token: string;
  /** Catálogo Unity Catalog (ex: "main") */
  catalog?: string;
}

export interface PiiColumn {
  name: string;
  piiResult: PiiScanResult;
}

export interface PolicyApplicationResult {
  column: string;
  policyType: "masking" | "column_permission" | "rls";
  status: "applied" | "skipped" | "error";
  message: string;
  sqlExecuted?: string;
}

export interface PolicyApplicationSummary {
  fullyQualifiedName: string;
  applied: number;
  skipped: number;
  errors: number;
  results: PolicyApplicationResult[];
  maskingFunctionCreated: boolean;
}

/** Preview das políticas que serão aplicadas (sem executar nada) */
export interface PiiPolicyPreview {
  canSync: boolean;
  reason?: string;
  fullyQualifiedName: string;
  piiColumnsDetected: number;
  policyStatus: string | null;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  syncedAt?: Date | null;
  notes?: string | null;
  commands: Array<{
    column: string;
    policyType: "masking" | "column_permission" | "rls";
    riskLevel: string;
    sql: string;
    description: string;
  }>;
}

// ─── Construtores de SQL ──────────────────────────────────────────────────────

function buildMaskingFunctionSQL(
  catalog: string,
  schema: string,
  functionName: string
): string {
  return `
CREATE OR REPLACE FUNCTION \`${catalog}\`.\`${schema}\`.\`${functionName}\`(col STRING)
RETURN CASE
  WHEN is_member('data_steward') OR is_member('data_owner') OR is_member('admins')
    THEN col
  ELSE '***PII***'
END;`.trim();
}

function buildColumnMaskSQL(
  catalog: string,
  schema: string,
  table: string,
  column: string,
  maskFunctionFQN: string
): string {
  return `ALTER TABLE \`${catalog}\`.\`${schema}\`.\`${table}\` ALTER COLUMN \`${column}\` SET MASK \`${maskFunctionFQN}\`;`;
}

function buildRevokeColumnSQL(
  catalog: string,
  schema: string,
  table: string,
  column: string,
  groupName = "account users"
): string {
  return `REVOKE SELECT(\`${column}\`) ON TABLE \`${catalog}\`.\`${schema}\`.\`${table}\` FROM \`${groupName}\`;`;
}

function buildRowFilterFunctionSQL(
  catalog: string,
  schema: string,
  functionName: string,
  filterColumn: string
): string {
  return `
CREATE OR REPLACE FUNCTION \`${catalog}\`.\`${schema}\`.\`${functionName}\`()
RETURN is_member('data_steward') OR is_member('data_owner') OR is_member('admins')
  OR current_user() = \`${filterColumn}\`;`.trim();
}

function buildSetRowFilterSQL(
  catalog: string,
  schema: string,
  table: string,
  filterFunctionFQN: string
): string {
  return `ALTER TABLE \`${catalog}\`.\`${schema}\`.\`${table}\` SET ROW FILTER \`${filterFunctionFQN}\` ON ();`;
}

// ─── Executor de SQL via Databricks REST API ──────────────────────────────────

async function executeDatabricksSQL(
  config: DatabricksPolicyConfig,
  sql: string,
  warehouseId?: string
): Promise<{ ok: boolean; error?: string }> {
  const host = config.host.replace(/\/$/, "");
  const wid = warehouseId ?? process.env.DATABRICKS_WAREHOUSE_ID ?? "";

  const url = `${host}/api/2.0/sql/statements`;
  const body: Record<string, unknown> = {
    statement: sql,
    wait_timeout: "30s",
    on_wait_timeout: "CANCEL",
  };
  if (wid) body.warehouse_id = wid;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "(sem corpo)");
      return { ok: false, error: `HTTP ${resp.status}: ${text}` };
    }

    const data = (await resp.json()) as {
      status?: { state?: string; error?: { message?: string } };
    };
    const state = data.status?.state ?? "";

    if (state === "FAILED" || state === "CANCELED") {
      return {
        ok: false,
        error: data.status?.error?.message ?? `Statement ${state}`,
      };
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: `Falha de rede: ${err?.message ?? err}` };
  }
}

// ─── ETAPA 1: Marcar ativo como "pendente_revisao" ────────────────────────────

/**
 * Chamado pelo agente de classificação ou pelo scanner de PII quando colunas
 * sensíveis são detectadas. Atualiza o status do ativo para 'pendente_revisao'
 * para que o steward seja notificado e possa revisar.
 *
 * NÃO executa nenhuma SQL no Databricks.
 */
export async function markAssetPendingPiiReview(assetId: number): Promise<void> {
  await db.updateDataAsset(assetId, {
    piiPolicyStatus: "pendente_revisao",
  } as any);
  console.log(
    `[DatabricksPolicyService] Ativo #${assetId} marcado como 'pendente_revisao'. Aguardando aprovação do steward.`
  );
}

// ─── ETAPA 2: Preview das políticas (sem executar) ────────────────────────────

/**
 * Gera um preview completo das políticas que seriam aplicadas no Unity Catalog,
 * incluindo os SQLs exatos. Não executa nada.
 *
 * Equivalente ao previewDatabricksSync() da curadoria de atributos.
 */
export async function previewPiiPolicies(
  assetId: number,
  piiColumns: PiiColumn[],
  options?: {
    applyMasking?: boolean;
    applyColumnRevoke?: boolean;
    applyRls?: boolean;
    rlsUserColumn?: string;
    unauthorizedGroup?: string;
  }
): Promise<PiiPolicyPreview> {
  const allAssets = await db.getDataAssets();
  const asset = allAssets.find((a: any) => a.id === assetId);

  if (!asset) {
    return {
      canSync: false,
      reason: "Ativo não encontrado.",
      fullyQualifiedName: "",
      piiColumnsDetected: 0,
      policyStatus: null,
      commands: [],
    };
  }

  if (!asset.fullyQualifiedName || asset.fullyQualifiedName.split(".").length !== 3) {
    return {
      canSync: false,
      reason: "O ativo não possui fullyQualifiedName válido (catalog.schema.table).",
      fullyQualifiedName: asset.fullyQualifiedName ?? "",
      piiColumnsDetected: piiColumns.length,
      policyStatus: (asset as any).piiPolicyStatus ?? null,
      commands: [],
    };
  }

  if ((asset as any).piiPolicyStatus === "rejeitado") {
    return {
      canSync: false,
      reason: "Políticas foram rejeitadas pelo steward. Para reavaliar, cancele a rejeição.",
      fullyQualifiedName: asset.fullyQualifiedName,
      piiColumnsDetected: piiColumns.length,
      policyStatus: "rejeitado",
      reviewedBy: (asset as any).piiPolicyReviewedBy,
      reviewedAt: (asset as any).piiPolicyReviewedAt,
      notes: (asset as any).piiPolicyNotes,
      commands: [],
    };
  }

  if ((asset as any).piiPolicyStatus === "sincronizado") {
    return {
      canSync: false,
      reason: "Políticas já foram sincronizadas com o Unity Catalog.",
      fullyQualifiedName: asset.fullyQualifiedName,
      piiColumnsDetected: piiColumns.length,
      policyStatus: "sincronizado",
      syncedAt: (asset as any).piiPolicySyncedAt,
      commands: [],
    };
  }

  const [catalog, schema, table] = asset.fullyQualifiedName.split(".");
  const opts = {
    applyMasking: true,
    applyColumnRevoke: true,
    applyRls: false,
    unauthorizedGroup: "account users",
    ...options,
  };

  const commands: PiiPolicyPreview["commands"] = [];

  const highRiskColumns = piiColumns.filter(
    (c) => c.piiResult.riskLevel === "alto" || c.piiResult.riskLevel === "medio"
  );

  if (opts.applyMasking && highRiskColumns.length > 0) {
    const maskFnName = `mask_pii_${table.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    const maskFnFQN = `${catalog}.${schema}.${maskFnName}`;

    // SQL da função de mascaramento
    commands.push({
      column: "*",
      policyType: "masking",
      riskLevel: "alto",
      sql: buildMaskingFunctionSQL(catalog, schema, maskFnName),
      description: `Cria/atualiza função de mascaramento '${maskFnName}' — retorna '***PII***' para usuários sem permissão.`,
    });

    // SQL de SET MASK para cada coluna
    for (const col of highRiskColumns) {
      commands.push({
        column: col.name,
        policyType: "masking",
        riskLevel: col.piiResult.riskLevel ?? "medio",
        sql: buildColumnMaskSQL(catalog, schema, table, col.name, maskFnFQN),
        description: `Aplica mascaramento na coluna '${col.name}' (${col.piiResult.category ?? "PII"}).`,
      });
    }
  }

  if (opts.applyColumnRevoke) {
    const highRiskOnly = piiColumns.filter((c) => c.piiResult.riskLevel === "alto");
    for (const col of highRiskOnly) {
      commands.push({
        column: col.name,
        policyType: "column_permission",
        riskLevel: "alto",
        sql: buildRevokeColumnSQL(catalog, schema, table, col.name, opts.unauthorizedGroup),
        description: `Revoga SELECT na coluna '${col.name}' para o grupo '${opts.unauthorizedGroup}'.`,
      });
    }
  }

  if (opts.applyRls && opts.rlsUserColumn) {
    const rlsFnName = `rls_${table.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    const rlsFnFQN = `${catalog}.${schema}.${rlsFnName}`;
    commands.push({
      column: "*",
      policyType: "rls",
      riskLevel: "alto",
      sql: buildRowFilterFunctionSQL(catalog, schema, rlsFnName, opts.rlsUserColumn),
      description: `Cria função de Row-Level Security '${rlsFnName}'.`,
    });
    commands.push({
      column: "*",
      policyType: "rls",
      riskLevel: "alto",
      sql: buildSetRowFilterSQL(catalog, schema, table, rlsFnFQN),
      description: `Aplica Row Filter na tabela '${table}' — usuários veem apenas suas próprias linhas.`,
    });
  }

  return {
    canSync: commands.length > 0,
    reason: commands.length === 0 ? "Nenhuma política necessária para as colunas detectadas." : undefined,
    fullyQualifiedName: asset.fullyQualifiedName,
    piiColumnsDetected: piiColumns.length,
    policyStatus: (asset as any).piiPolicyStatus ?? null,
    reviewedBy: (asset as any).piiPolicyReviewedBy,
    reviewedAt: (asset as any).piiPolicyReviewedAt,
    notes: (asset as any).piiPolicyNotes,
    commands,
  };
}

// ─── ETAPA 3a: Aprovar políticas ──────────────────────────────────────────────

/**
 * Registra a aprovação do steward para aplicar as políticas PII.
 * Atualiza o status para 'aprovado'. NÃO executa nada no Databricks.
 *
 * Equivalente ao syncApproved = true da curadoria de atributos.
 */
export async function approvePiiPolicies(
  assetId: number,
  approvedBy: string,
  notes?: string
): Promise<void> {
  await db.updateDataAsset(assetId, {
    piiPolicyStatus: "aprovado",
    piiPolicyReviewedBy: approvedBy,
    piiPolicyReviewedAt: new Date(),
    piiPolicyNotes: notes ?? null,
  } as any);
  console.log(
    `[DatabricksPolicyService] Ativo #${assetId} aprovado por '${approvedBy}'. Pronto para sync via botão.`
  );
}

// ─── ETAPA 3b: Rejeitar políticas ─────────────────────────────────────────────

/**
 * Registra a rejeição do steward. Nenhuma política será aplicada.
 * Atualiza o status para 'rejeitado'.
 */
export async function rejectPiiPolicies(
  assetId: number,
  rejectedBy: string,
  reason: string
): Promise<void> {
  await db.updateDataAsset(assetId, {
    piiPolicyStatus: "rejeitado",
    piiPolicyReviewedBy: rejectedBy,
    piiPolicyReviewedAt: new Date(),
    piiPolicyNotes: reason,
  } as any);
  console.log(
    `[DatabricksPolicyService] Ativo #${assetId} rejeitado por '${rejectedBy}'. Motivo: ${reason}`
  );
}

// ─── ETAPA 3c: Cancelar rejeição (reabre para revisão) ───────────────────────

/**
 * Cancela uma rejeição anterior, reabrindo o ativo para revisão.
 * Útil quando o steward muda de decisão após nova análise.
 */
export async function resetPiiPolicyReview(assetId: number): Promise<void> {
  await db.updateDataAsset(assetId, {
    piiPolicyStatus: "pendente_revisao",
    piiPolicyReviewedBy: null,
    piiPolicyReviewedAt: null,
    piiPolicyNotes: null,
    piiPolicySyncedAt: null,
  } as any);
  console.log(
    `[DatabricksPolicyService] Ativo #${assetId} reaberto para revisão.`
  );
}

// ─── ETAPA 4: Sync efetivo (somente após aprovação) ──────────────────────────

/**
 * Executa o sync das políticas PII no Unity Catalog.
 * SÓ pode ser chamado se piiPolicyStatus === 'aprovado'.
 *
 * Equivalente ao pushVerifiedTagsToDatabricks() da curadoria de atributos.
 * Deve ser acionado EXCLUSIVAMENTE pelo botão "Sync Databricks" no portal.
 *
 * @throws Error se o ativo não estiver com status 'aprovado'
 */
export async function syncApprovedPiiPolicies(
  config: DatabricksPolicyConfig,
  assetId: number,
  piiColumns: PiiColumn[],
  options?: {
    applyMasking?: boolean;
    applyColumnRevoke?: boolean;
    applyRls?: boolean;
    rlsUserColumn?: string;
    unauthorizedGroup?: string;
  }
): Promise<PolicyApplicationSummary> {
  // Guarda de segurança: verifica aprovação antes de qualquer execução
  const allAssets = await db.getDataAssets();
  const asset = allAssets.find((a: any) => a.id === assetId);

  if (!asset) {
    throw new Error(`Ativo #${assetId} não encontrado.`);
  }

  const currentStatus = (asset as any).piiPolicyStatus;
  if (currentStatus !== "aprovado") {
    throw new Error(
      `Sync bloqueado: o ativo "${asset.name}" está com status '${currentStatus ?? "não revisado"}'. ` +
      `Apenas ativos com status 'aprovado' podem ser sincronizados com o Unity Catalog.`
    );
  }

  if (!asset.fullyQualifiedName || asset.fullyQualifiedName.split(".").length !== 3) {
    throw new Error(
      `O ativo "${asset.name}" não possui fullyQualifiedName válido (catalog.schema.table).`
    );
  }

  const [catalog, schema, table] = asset.fullyQualifiedName.split(".");
  const opts = {
    applyMasking: true,
    applyColumnRevoke: true,
    applyRls: false,
    unauthorizedGroup: "account users",
    ...options,
  };

  const results: PolicyApplicationResult[] = [];
  let maskingFunctionCreated = false;

  const highRiskColumns = piiColumns.filter(
    (c) => c.piiResult.riskLevel === "alto" || c.piiResult.riskLevel === "medio"
  );

  if (highRiskColumns.length === 0) {
    // Nenhuma coluna de risco alto/médio — marca como sincronizado mesmo assim
    await db.updateDataAsset(assetId, {
      piiPolicyStatus: "sincronizado",
      piiPolicySyncedAt: new Date(),
    } as any);
    return {
      fullyQualifiedName: asset.fullyQualifiedName,
      applied: 0,
      skipped: piiColumns.length,
      errors: 0,
      results: piiColumns.map((c) => ({
        column: c.name,
        policyType: "masking",
        status: "skipped",
        message: "Risco baixo — mascaramento não necessário.",
      })),
      maskingFunctionCreated: false,
    };
  }

  // 1. Cria a função de mascaramento compartilhada
  if (opts.applyMasking) {
    const maskFnName = `mask_pii_${table.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    const maskFnFQN = `${catalog}.${schema}.${maskFnName}`;
    const maskFnSQL = buildMaskingFunctionSQL(catalog, schema, maskFnName);

    const fnResult = await executeDatabricksSQL(config, maskFnSQL);
    maskingFunctionCreated = fnResult.ok;

    if (!fnResult.ok) {
      results.push({
        column: "*",
        policyType: "masking",
        status: "error",
        message: `Falha ao criar função de mascaramento: ${fnResult.error}`,
        sqlExecuted: maskFnSQL,
      });
    } else {
      // 2. Aplica mascaramento em cada coluna PII de alto/médio risco
      for (const col of highRiskColumns) {
        const maskSQL = buildColumnMaskSQL(catalog, schema, table, col.name, maskFnFQN);
        const maskResult = await executeDatabricksSQL(config, maskSQL);
        results.push({
          column: col.name,
          policyType: "masking",
          status: maskResult.ok ? "applied" : "error",
          message: maskResult.ok
            ? `Masking Policy aplicada — usuários sem permissão verão '***PII***'.`
            : `Falha ao aplicar mascaramento: ${maskResult.error}`,
          sqlExecuted: maskSQL,
        });
      }
    }
  }

  // 3. Revoga permissão de SELECT em colunas de alto risco
  if (opts.applyColumnRevoke) {
    const highRiskOnly = piiColumns.filter((c) => c.piiResult.riskLevel === "alto");
    for (const col of highRiskOnly) {
      const revokeSQL = buildRevokeColumnSQL(catalog, schema, table, col.name, opts.unauthorizedGroup);
      const revokeResult = await executeDatabricksSQL(config, revokeSQL);
      results.push({
        column: col.name,
        policyType: "column_permission",
        status: revokeResult.ok ? "applied" : "error",
        message: revokeResult.ok
          ? `Column-Level Permission revogada para grupo "${opts.unauthorizedGroup}".`
          : `Falha ao revogar permissão: ${revokeResult.error}`,
        sqlExecuted: revokeSQL,
      });
    }
  }

  // 4. Row-Level Security (opcional)
  if (opts.applyRls && opts.rlsUserColumn) {
    const rlsFnName = `rls_${table.replace(/[^a-zA-Z0-9_]/g, "_")}`;
    const rlsFnFQN = `${catalog}.${schema}.${rlsFnName}`;
    const rlsFnSQL = buildRowFilterFunctionSQL(catalog, schema, rlsFnName, opts.rlsUserColumn);
    const rlsSetSQL = buildSetRowFilterSQL(catalog, schema, table, rlsFnFQN);

    const rlsFnResult = await executeDatabricksSQL(config, rlsFnSQL);
    if (rlsFnResult.ok) {
      const rlsSetResult = await executeDatabricksSQL(config, rlsSetSQL);
      results.push({
        column: "*",
        policyType: "rls",
        status: rlsSetResult.ok ? "applied" : "error",
        message: rlsSetResult.ok
          ? "Row-Level Security aplicado com sucesso."
          : `Falha ao aplicar RLS: ${rlsSetResult.error}`,
        sqlExecuted: rlsSetSQL,
      });
    } else {
      results.push({
        column: "*",
        policyType: "rls",
        status: "error",
        message: `Falha ao criar função RLS: ${rlsFnResult.error}`,
        sqlExecuted: rlsFnSQL,
      });
    }
  }

  const applied = results.filter((r) => r.status === "applied").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors  = results.filter((r) => r.status === "error").length;

  // Atualiza status: 'sincronizado' mesmo se houver erros parciais (registra na auditoria)
  await db.updateDataAsset(assetId, {
    piiPolicyStatus: "sincronizado",
    piiPolicySyncedAt: new Date(),
  } as any);

  console.log(
    `[DatabricksPolicyService] Sync concluído para "${asset.name}" (${asset.fullyQualifiedName}): ` +
    `${applied} aplicada(s), ${skipped} ignorada(s), ${errors} erro(s).`
  );

  return {
    fullyQualifiedName: asset.fullyQualifiedName,
    applied,
    skipped,
    errors,
    results,
    maskingFunctionCreated,
  };
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

/**
 * Verifica se as credenciais Databricks estão configuradas para o serviço de políticas.
 */
export function isDatabricksPolicyConfigured(): boolean {
  return !!(process.env.DATABRICKS_HOST && process.env.DATABRICKS_TOKEN);
}

/**
 * Constrói a configuração do serviço a partir de variáveis de ambiente.
 */
export function getDatabricksPolicyConfig(): DatabricksPolicyConfig | null {
  const host = process.env.DATABRICKS_HOST;
  const token = process.env.DATABRICKS_TOKEN;
  if (!host || !token) return null;
  return {
    host: host.startsWith("http") ? host : `https://${host}`,
    token,
    catalog: process.env.DATABRICKS_CATALOG ?? "hive_metastore",
  };
}

/**
 * Retorna todos os ativos com políticas PII pendentes de revisão.
 * Útil para o dashboard de governança exibir a fila de aprovação.
 */
export async function getAssetsPendingPiiReview(): Promise<any[]> {
  const allAssets = await db.getDataAssets();
  return allAssets.filter(
    (a: any) => a.piiPolicyStatus === "pendente_revisao"
  );
}
