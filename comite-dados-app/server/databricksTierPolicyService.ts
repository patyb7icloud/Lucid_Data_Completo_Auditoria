/**
 * databricksTierPolicyService.ts
 *
 * Modelo de Maturidade de Autonomia por Perfil — Tier 1 a Tier 4
 * Aplica políticas no Unity Catalog (Databricks) por grupo de domínio.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  Tier 1 — Self-Service Completo   │ Data Analyst / BI Developer      │
 * │  Tier 2 — Self-Service Guiado     │ Domain Data Engineer             │
 * │  Tier 3 — Controlado              │ Lead Data Engineer / Data Steward│
 * │  Tier 4 — Restrito (Plataforma)   │ Platform Engineer                │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Cada Tier mapeia para:
 *  - Um grupo AAD/Entra ID no Databricks (ex: "domain-engineering-<domainSlug>")
 *  - Um conjunto de GRANTS no Unity Catalog (catalog, schema, table level)
 *  - Uma Cluster Policy (referenciada por nome, aplicada via API)
 *  - Restrições explícitas (o que NÃO pode fazer)
 *
 * Fluxo de aprovação:
 *  assignTierToDomain()  → status: pendente_revisao
 *  approveTierAssignment() → status: aprovado
 *  syncTierPolicies()    → aplica GRANTs no Unity Catalog → status: sincronizado
 *  revokeTierPolicies()  → remove GRANTs → status: revogado
 */

import * as db from "./db";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TierLevel = 0 | 1 | 2 | 3 | 4;

export interface TierDefinition {
  tier: TierLevel;
  name: string;
  label: string;
  profiles: string[];          // perfis de usuário que se enquadram neste tier
  databricksGroup: string;     // nome do grupo no Databricks/AAD (template com {domainSlug})
  clusterPolicyName: string;   // nome da Cluster Policy no Databricks
  catalogGrants: CatalogGrant[];
  schemaGrants: SchemaGrant[];
  tableGrants: TableGrant[];
  restrictions: string[];      // o que NÃO pode fazer (documentação/auditoria)
  capabilities: string[];      // o que PODE fazer
  requiresApproval: boolean;   // se precisa de aprovação do Steward/Lead antes do sync
  requiresCICD: boolean;       // se todas as ações requerem PR + CI/CD
}

export interface CatalogGrant {
  privilege: string;
  description: string;
}

export interface SchemaGrant {
  privilege: string;
  description: string;
  scopePattern: "own_domain" | "all_domains" | "read_only_others";
}

export interface TableGrant {
  privilege: string;
  description: string;
  scopePattern: "own_domain" | "all_domains" | "read_only_others";
}

export interface DomainTierAssignment {
  domainId: number;
  domainName: string;
  domainSlug: string;
  tier: TierLevel | null;
  databricksGroup: string | null;
  status: "pendente_revisao" | "aprovado" | "sincronizado" | "revogado" | "sem_tier";
  approvedBy?: string;
  approvedAt?: Date;
  syncedAt?: Date;
  notes?: string;
  tierDatabricksCatalog?: string;
  tierDatabricksSchema?: string;
  color?: string;
  grantResults?: TierSyncResult[];
}

export interface TierSyncResult {
  operation: string;
  target: string;
  privilege: string;
  principal: string;
  ok: boolean;
  error?: string;
}

export interface TierSyncReport {
  domainId: number;
  domainName: string;
  tier: TierLevel;
  databricksGroup: string;
  applied: number;
  failed: number;
  skipped: number;
  results: TierSyncResult[];
  syncedAt: Date;
}

// ─── Definição dos 4 Tiers ────────────────────────────────────────────────────

export const TIER_DEFINITIONS: Record<TierLevel, TierDefinition> = {
  0: {
    tier: 0,
    name: "bloqueado",
    label: "Tier 0 — Bloqueado",
    profiles: [],
    databricksGroup: "domain-blocked-{domainSlug}",
    clusterPolicyName: "Blocked Domain Policy",
    catalogGrants: [],
    schemaGrants: [],
    tableGrants: [],
    capabilities: [],
    restrictions: [
      "Acesso total bloqueado ao catálogo",
      "Nenhum privilégio concedido no Unity Catalog",
      "Uso reservado para dados regulatórios, em quarentena ou sob investigação",
    ],
    requiresApproval: true,
    requiresCICD: false,
  },
  1: {
    tier: 1,
    name: "self_service_completo",
    label: "Tier 1 — Self-Service Completo",
    profiles: ["data_analyst", "bi_developer"],
    databricksGroup: "domain-analysts-{domainSlug}",
    clusterPolicyName: "Shared Cluster Policy — Analysts",
    catalogGrants: [
      { privilege: "USE CATALOG", description: "Acesso de leitura ao catálogo do domínio" },
    ],
    schemaGrants: [
      { privilege: "USE SCHEMA",  description: "Acesso ao schema do domínio", scopePattern: "own_domain" },
      { privilege: "SELECT",      description: "Leitura de tabelas Gold/publicadas", scopePattern: "own_domain" },
    ],
    tableGrants: [
      { privilege: "SELECT", description: "Leitura de tabelas aprovadas do domínio", scopePattern: "own_domain" },
    ],
    capabilities: [
      "Criar notebooks em workspace pessoal",
      "Usar clusters compartilhados pré-configurados",
      "Publicar dashboards em workspace aprovado",
      "SELECT em tabelas Gold do próprio domínio",
    ],
    restrictions: [
      "Criar clusters (bloqueado por Cluster Policy)",
      "Modificar catálogos ou schemas",
      "Acessar dados fora do próprio domínio",
      "MODIFY, INSERT, DELETE em qualquer tabela",
    ],
    requiresApproval: false,
    requiresCICD: false,
  },

  2: {
    tier: 2,
    name: "self_service_guiado",
    label: "Tier 2 — Self-Service Guiado",
    profiles: ["data_engineer", "domain_data_engineer"],
    databricksGroup: "domain-engineering-{domainSlug}",
    clusterPolicyName: "Domain Engineering Cluster Policy",
    catalogGrants: [
      { privilege: "USE CATALOG",    description: "Acesso ao catálogo do domínio" },
      { privilege: "CREATE SCHEMA",  description: "Criação de schemas no catálogo do domínio" },
    ],
    schemaGrants: [
      { privilege: "USE SCHEMA",     description: "Acesso a schemas do domínio", scopePattern: "own_domain" },
      { privilege: "CREATE TABLE",   description: "Criação de tabelas Bronze/Silver no domínio", scopePattern: "own_domain" },
      { privilege: "SELECT",         description: "Leitura em schemas do domínio", scopePattern: "own_domain" },
      { privilege: "MODIFY",         description: "Escrita em tabelas Bronze/Silver do domínio", scopePattern: "own_domain" },
    ],
    tableGrants: [
      { privilege: "SELECT",  description: "Leitura de tabelas do domínio", scopePattern: "own_domain" },
      { privilege: "MODIFY",  description: "Escrita em tabelas Bronze/Silver do domínio", scopePattern: "own_domain" },
      { privilege: "SELECT",  description: "Leitura somente em tabelas Gold de outros domínios", scopePattern: "read_only_others" },
    ],
    capabilities: [
      "Criar clusters via Cluster Policy aprovada",
      "Desenvolver pipelines DLT no domínio",
      "Criar tabelas Bronze/Silver no catálogo do domínio",
      "SELECT em tabelas Gold de outros domínios (somente leitura)",
      "Executar jobs no workspace do domínio",
    ],
    restrictions: [
      "Modificar tabelas de outros domínios",
      "Alterar políticas de segurança (Masking, RLS, CLS)",
      "Criar usuários ou Service Principals",
      "Acessar tabelas Restrito de outros domínios",
    ],
    requiresApproval: false,
    requiresCICD: false,
  },

  3: {
    tier: 3,
    name: "controlado",
    label: "Tier 3 — Controlado",
    profiles: ["lead_data_engineer", "data_steward", "data_architect"],
    databricksGroup: "domain-stewards-{domainSlug}",
    clusterPolicyName: "Steward Cluster Policy",
    catalogGrants: [
      { privilege: "USE CATALOG",    description: "Acesso ao catálogo do domínio" },
      { privilege: "CREATE SCHEMA",  description: "Criação de schemas no domínio" },
      { privilege: "CREATE TABLE",   description: "Criação de tabelas em qualquer camada do domínio" },
    ],
    schemaGrants: [
      { privilege: "USE SCHEMA",     description: "Acesso a todos os schemas do domínio", scopePattern: "own_domain" },
      { privilege: "CREATE TABLE",   description: "Criação de tabelas em qualquer camada", scopePattern: "own_domain" },
      { privilege: "SELECT",         description: "Leitura total no domínio", scopePattern: "own_domain" },
      { privilege: "MODIFY",         description: "Escrita em qualquer camada do domínio", scopePattern: "own_domain" },
      { privilege: "SELECT",         description: "Leitura em schemas de outros domínios", scopePattern: "read_only_others" },
    ],
    tableGrants: [
      { privilege: "SELECT",         description: "Leitura total no domínio", scopePattern: "own_domain" },
      { privilege: "MODIFY",         description: "Escrita total no domínio", scopePattern: "own_domain" },
      { privilege: "SELECT",         description: "Leitura em tabelas de outros domínios", scopePattern: "read_only_others" },
    ],
    capabilities: [
      "Aprovar promoção Bronze → Silver → Gold",
      "Definir RLS/CLS no domínio (via portal, com aprovação)",
      "Criar Delta Shares internos entre domínios",
      "Gerenciar Masking Policies no domínio",
      "Criar clusters com políticas avançadas",
      "Acesso de leitura a todos os domínios",
    ],
    restrictions: [
      "Modificar metastore (nível plataforma)",
      "Alterar IAM de produção",
      "Criar Service Principals",
      "Acesso direto a produção sem PR aprovado",
    ],
    requiresApproval: true,
    requiresCICD: false,
  },

  4: {
    tier: 4,
    name: "restrito_plataforma",
    label: "Tier 4 — Restrito (Plataforma)",
    profiles: ["platform_engineer", "admin"],
    databricksGroup: "platform-engineers",
    clusterPolicyName: "Platform Engineer Policy (Unrestricted)",
    catalogGrants: [
      { privilege: "ALL PRIVILEGES", description: "Acesso total ao metastore (com auditoria)" },
    ],
    schemaGrants: [
      { privilege: "ALL PRIVILEGES", description: "Acesso total a todos os schemas", scopePattern: "all_domains" },
    ],
    tableGrants: [
      { privilege: "ALL PRIVILEGES", description: "Acesso total a todas as tabelas", scopePattern: "all_domains" },
    ],
    capabilities: [
      "Tudo dentro da plataforma com auditoria completa via System Tables",
      "Gerenciar metastore, IAM e Service Principals",
      "Criar e modificar Cluster Policies globais",
      "Acesso a System Tables de auditoria",
    ],
    restrictions: [
      "Acesso manual a produção sem PR aprovado",
      "Todas as ações requerem PR aprovado + deploy via CI/CD",
    ],
    requiresApproval: true,
    requiresCICD: true,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDatabricksConfig() {
  const host  = process.env.DATABRICKS_HOST;
  const token = process.env.DATABRICKS_TOKEN;
  if (!host || !token) return null;
  return { host: host.replace(/\/$/, ""), token };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveGroupName(template: string, domainSlug: string): string {
  return template.replace("{domainSlug}", domainSlug);
}

/** Executa um GRANT ou REVOKE no Unity Catalog via REST API */
async function executeUnityGrant(
  host: string,
  token: string,
  securableType: "catalog" | "schema" | "table",
  fullName: string,
  principal: string,
  privileges: string[],
  action: "add" | "remove"
): Promise<{ ok: boolean; error?: string }> {
  const url = `${host}/api/2.1/unity-catalog/permissions/${securableType}/${encodeURIComponent(fullName)}`;
  const body = {
    changes: [{ principal, [action]: privileges }],
  };
  try {
    const resp = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "(sem corpo)");
      return { ok: false, error: `HTTP ${resp.status}: ${text}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: `Falha de rede: ${err?.message ?? err}` };
  }
}

/** Aplica a Cluster Policy para o grupo via API (associa grupo à policy) */
async function applyClusterPolicy(
  host: string,
  token: string,
  policyName: string,
  groupName: string
): Promise<{ ok: boolean; policyId?: string; error?: string }> {
  // 1. Busca a policy pelo nome
  const listUrl = `${host}/api/2.0/policies/clusters/list`;
  try {
    const listResp = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!listResp.ok) {
      return { ok: false, error: `Falha ao listar Cluster Policies: HTTP ${listResp.status}` };
    }
    const listData: any = await listResp.json();
    const policies: any[] = listData.policies ?? [];
    const policy = policies.find((p: any) =>
      p.name?.toLowerCase() === policyName.toLowerCase()
    );
    if (!policy) {
      return { ok: false, error: `Cluster Policy "${policyName}" não encontrada no workspace` };
    }
    // 2. Concede permissão de uso da policy ao grupo
    const permUrl = `${host}/api/2.0/permissions/cluster-policies/${policy.policy_id}`;
    const permResp = await fetch(permUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_control_list: [
          { group_name: groupName, permission_level: "CAN_USE" },
        ],
      }),
    });
    if (!permResp.ok) {
      const text = await permResp.text().catch(() => "(sem corpo)");
      return { ok: false, error: `Falha ao aplicar permissão na Cluster Policy: HTTP ${permResp.status}: ${text}` };
    }
    return { ok: true, policyId: policy.policy_id };
  } catch (err: any) {
    return { ok: false, error: `Falha de rede: ${err?.message ?? err}` };
  }
}

// ─── Funções principais ───────────────────────────────────────────────────────

/**
 * Retorna a definição de um Tier específico.
 */
export function getTierDefinition(tier: TierLevel): TierDefinition {
  return TIER_DEFINITIONS[tier];
}

/**
 * Retorna todas as definições de Tier.
 */
export function getAllTierDefinitions(): TierDefinition[] {
  return [1, 2, 3, 4].map((t) => TIER_DEFINITIONS[t as TierLevel]);
}

/**
 * Gera o preview das políticas que serão aplicadas para um domínio + tier,
 * sem executar nada no Databricks.
 */
export function previewTierPolicies(
  domainName: string,
  domainCatalog: string,
  domainSchema: string,
  tier: TierLevel
): {
  tier: TierLevel;
  tierLabel: string;
  databricksGroup: string;
  clusterPolicyName: string;
  grants: Array<{
    type: "catalog" | "schema" | "table";
    target: string;
    privilege: string;
    description: string;
    sql: string;
  }>;
  restrictions: string[];
  capabilities: string[];
  requiresApproval: boolean;
  requiresCICD: boolean;
} {
  const def = TIER_DEFINITIONS[tier];
  const domainSlug = slugify(domainName);
  const groupName = resolveGroupName(def.databricksGroup, domainSlug);
  const grants: Array<{
    type: "catalog" | "schema" | "table";
    target: string;
    privilege: string;
    description: string;
    sql: string;
  }> = [];

  // Catalog grants
  for (const g of def.catalogGrants) {
    grants.push({
      type: "catalog",
      target: domainCatalog,
      privilege: g.privilege,
      description: g.description,
      sql: `GRANT ${g.privilege} ON CATALOG \`${domainCatalog}\` TO \`${groupName}\`;`,
    });
  }

  // Schema grants
  for (const g of def.schemaGrants) {
    const target =
      g.scopePattern === "own_domain"
        ? `${domainCatalog}.${domainSchema}`
        : g.scopePattern === "read_only_others"
        ? `<outros_dominios>.* (somente leitura)`
        : `*.*`;
    const sqlTarget =
      g.scopePattern === "own_domain"
        ? `\`${domainCatalog}\`.\`${domainSchema}\``
        : `<outros_dominios>.<schema>`;
    grants.push({
      type: "schema",
      target,
      privilege: g.privilege,
      description: g.description,
      sql:
        g.scopePattern === "own_domain"
          ? `GRANT ${g.privilege} ON SCHEMA ${sqlTarget} TO \`${groupName}\`;`
          : `-- ${g.description} (aplicado por domínio conforme solicitação)`,
    });
  }

  // Table grants
  for (const g of def.tableGrants) {
    const target =
      g.scopePattern === "own_domain"
        ? `${domainCatalog}.${domainSchema}.*`
        : g.scopePattern === "read_only_others"
        ? `<outros_dominios>.*.* (somente leitura)`
        : `*.*.*`;
    grants.push({
      type: "table",
      target,
      privilege: g.privilege,
      description: g.description,
      sql:
        g.scopePattern === "own_domain"
          ? `GRANT ${g.privilege} ON ALL TABLES IN SCHEMA \`${domainCatalog}\`.\`${domainSchema}\` TO \`${groupName}\`;`
          : `-- ${g.description} (aplicado por domínio conforme solicitação)`,
    });
  }

  return {
    tier,
    tierLabel: def.label,
    databricksGroup: groupName,
    clusterPolicyName: def.clusterPolicyName,
    grants,
    restrictions: def.restrictions,
    capabilities: def.capabilities,
    requiresApproval: def.requiresApproval,
    requiresCICD: def.requiresCICD,
  };
}

/**
 * Aplica as políticas de Tier no Unity Catalog para um domínio.
 * SÓ pode ser chamado após aprovação (status === 'aprovado').
 * Retorna um relatório detalhado de cada operação.
 */
export async function syncTierPolicies(
  domainId: number,
  domainName: string,
  domainCatalog: string,
  domainSchema: string,
  tier: TierLevel,
  approvedBy: string
): Promise<TierSyncReport> {
  const config = getDatabricksConfig();
  const def = TIER_DEFINITIONS[tier];
  const domainSlug = slugify(domainName);
  const groupName = resolveGroupName(def.databricksGroup, domainSlug);
  const results: TierSyncResult[] = [];
  const syncedAt = new Date();

  if (!config) {
    return {
      domainId,
      domainName,
      tier,
      databricksGroup: groupName,
      applied: 0,
      failed: 0,
      skipped: def.catalogGrants.length + def.schemaGrants.length + def.tableGrants.length,
      results: [
        {
          operation: "sync",
          target: "databricks",
          privilege: "ALL",
          principal: groupName,
          ok: false,
          error: "DATABRICKS_HOST ou DATABRICKS_TOKEN não configurados",
        },
      ],
      syncedAt,
    };
  }

  // 1. Catalog grants
  for (const g of def.catalogGrants) {
    const r = await executeUnityGrant(
      config.host, config.token,
      "catalog", domainCatalog,
      groupName, [g.privilege], "add"
    );
    results.push({
      operation: "GRANT",
      target: `CATALOG:${domainCatalog}`,
      privilege: g.privilege,
      principal: groupName,
      ok: r.ok,
      error: r.error,
    });
  }

  // 2. Schema grants (somente own_domain)
  for (const g of def.schemaGrants.filter((s) => s.scopePattern === "own_domain")) {
    const fullSchema = `${domainCatalog}.${domainSchema}`;
    const r = await executeUnityGrant(
      config.host, config.token,
      "schema", fullSchema,
      groupName, [g.privilege], "add"
    );
    results.push({
      operation: "GRANT",
      target: `SCHEMA:${fullSchema}`,
      privilege: g.privilege,
      principal: groupName,
      ok: r.ok,
      error: r.error,
    });
  }

  // 3. Table grants (ALL TABLES IN SCHEMA — own_domain)
  for (const g of def.tableGrants.filter((t) => t.scopePattern === "own_domain")) {
    const fullSchema = `${domainCatalog}.${domainSchema}`;
    // Usa schema-level grant para cobrir todas as tabelas
    const r = await executeUnityGrant(
      config.host, config.token,
      "schema", fullSchema,
      groupName, [g.privilege], "add"
    );
    results.push({
      operation: "GRANT (ALL TABLES IN SCHEMA)",
      target: `SCHEMA:${fullSchema}`,
      privilege: g.privilege,
      principal: groupName,
      ok: r.ok,
      error: r.error,
    });
  }

  // 4. Cluster Policy
  const cpResult = await applyClusterPolicy(
    config.host, config.token,
    def.clusterPolicyName, groupName
  );
  results.push({
    operation: "CLUSTER POLICY",
    target: def.clusterPolicyName,
    privilege: "CAN_USE",
    principal: groupName,
    ok: cpResult.ok,
    error: cpResult.error,
  });

  const applied = results.filter((r) => r.ok).length;
  const failed  = results.filter((r) => !r.ok).length;

  return {
    domainId,
    domainName,
    tier,
    databricksGroup: groupName,
    applied,
    failed,
    skipped: 0,
    results,
    syncedAt,
  };
}

/**
 * Revoga as políticas de Tier no Unity Catalog para um domínio.
 */
export async function revokeTierPolicies(
  domainId: number,
  domainName: string,
  domainCatalog: string,
  domainSchema: string,
  tier: TierLevel
): Promise<TierSyncReport> {
  const config = getDatabricksConfig();
  const def = TIER_DEFINITIONS[tier];
  const domainSlug = slugify(domainName);
  const groupName = resolveGroupName(def.databricksGroup, domainSlug);
  const results: TierSyncResult[] = [];
  const syncedAt = new Date();

  if (!config) {
    return {
      domainId, domainName, tier, databricksGroup: groupName,
      applied: 0, failed: 0, skipped: 1,
      results: [{ operation: "revoke", target: "databricks", privilege: "ALL", principal: groupName, ok: false, error: "Databricks não configurado" }],
      syncedAt,
    };
  }

  // Revoga catalog grants
  for (const g of def.catalogGrants) {
    const r = await executeUnityGrant(config.host, config.token, "catalog", domainCatalog, groupName, [g.privilege], "remove");
    results.push({ operation: "REVOKE", target: `CATALOG:${domainCatalog}`, privilege: g.privilege, principal: groupName, ok: r.ok, error: r.error });
  }

  // Revoga schema grants
  for (const g of def.schemaGrants.filter((s) => s.scopePattern === "own_domain")) {
    const fullSchema = `${domainCatalog}.${domainSchema}`;
    const r = await executeUnityGrant(config.host, config.token, "schema", fullSchema, groupName, [g.privilege], "remove");
    results.push({ operation: "REVOKE", target: `SCHEMA:${fullSchema}`, privilege: g.privilege, principal: groupName, ok: r.ok, error: r.error });
  }

  const applied = results.filter((r) => r.ok).length;
  const failed  = results.filter((r) => !r.ok).length;

  return { domainId, domainName, tier, databricksGroup: groupName, applied, failed, skipped: 0, results, syncedAt };
}

/**
 * Retorna os domínios com suas atribuições de Tier (lidos do banco).
 * Os campos tierLevel, tierStatus, tierApprovedBy, tierSyncedAt, tierNotes
 * são lidos da tabela domains (adicionados via migration).
 */
export async function getDomainTierAssignments(): Promise<DomainTierAssignment[]> {
  const domains = await db.getDomains();
  return domains.map((d: any) => ({
    domainId: d.id,
    domainName: d.name,
    domainSlug: slugify(d.name),
    tier: (d.tierLevel ?? null) as TierLevel | null,
    databricksGroup: d.tierLevel
      ? resolveGroupName(TIER_DEFINITIONS[d.tierLevel as TierLevel]?.databricksGroup ?? "", slugify(d.name))
      : null,
    status: d.tierStatus ?? "sem_tier",
    approvedBy: d.tierApprovedBy ?? undefined,
    approvedAt: d.tierApprovedAt ?? undefined,
    syncedAt: d.tierSyncedAt ?? undefined,
    notes: d.tierNotes ?? undefined,
    tierDatabricksCatalog: d.tierDatabricksCatalog ?? undefined,
    tierDatabricksSchema: d.tierDatabricksSchema ?? undefined,
    color: d.color ?? undefined,
  }));
}
