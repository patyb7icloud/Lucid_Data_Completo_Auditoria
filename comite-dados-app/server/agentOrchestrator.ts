/**
 * agentOrchestrator.ts — Motor de Orquestração Multiagente com LLM
 *
 * Implementa um pipeline de agentes autônomos baseado em grafo de estados,
 * inspirado na arquitetura LangGraph/crewAI, para governança de dados.
 *
 * Agentes disponíveis:
 *   1. InspectionAgent   — Lê metadados de tabelas e cataloga ativos
 *   2. ClassificationAgent — Aplica tags de governança (PII, Confidencial, Público)
 *   3. DocumentationAgent  — Gera relatórios automáticos com tags e políticas
 *   4. AuditAgent          — Monitora acessos e sugere melhorias de segurança
 *
 * Fluxo (grafo de estados):
 *   START → inspection → classification → documentation → audit → END
 *
 * Cada agente recebe o estado global, executa sua tarefa via LLM e
 * retorna um estado atualizado para o próximo agente.
 */

import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { scanTable } from "./piiScanner";
import { sendGovernanceAlert } from "./teamsGovernanceAlerts";

// ─── Tipos e Estado Global ────────────────────────────────────────────────────

export type AgentName =
  | "inspection"
  | "classification"
  | "documentation"
  | "audit";

export type AgentStatus = "pending" | "running" | "completed" | "failed";

export interface AgentResult {
  agent: AgentName;
  status: AgentStatus;
  output: string;
  metadata: Record<string, unknown>;
  durationMs: number;
  error?: string;
}

export interface OrchestrationState {
  runId: string;
  organizationId: number;
  assetId?: number;
  assetName?: string;
  sourceSystem?: string;
  fullyQualifiedName?: string;
  columns: Array<{ name: string; type: string; description?: string }>;
  piiScanResult?: ReturnType<typeof scanTable>;
  classificationResult?: {
    sensitivity: string;
    tags: string[];
    governancePolicies: string[];
    reasoning: string;
  };
  documentationResult?: {
    reportMarkdown: string;
    glossaryTerms: Array<{ term: string; definition: string; category: string }>;
  };
  auditResult?: {
    riskScore: number;
    recommendations: string[];
    accessAlerts: string[];
    complianceStatus: "compliant" | "non_compliant" | "needs_review";
  };
  agentResults: AgentResult[];
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

// ─── Agente 1: Inspeção ───────────────────────────────────────────────────────

async function runInspectionAgent(
  state: OrchestrationState
): Promise<OrchestrationState> {
  const startMs = Date.now();
  console.log(`[InspectionAgent] Iniciando inspeção do ativo: ${state.assetName ?? state.assetId}`);

  try {
    // Carrega atributos do ativo do banco de dados
    let columns = state.columns;
    if (state.assetId && columns.length === 0) {
      const attrs = await db.getDataAttributes(state.assetId, state.organizationId);
      columns = attrs.map((a: any) => ({
        name: a.name,
        type: a.dataType ?? "unknown",
        description: a.description ?? "",
      }));
    }

    // Usa LLM para enriquecer a inspeção com análise semântica
    const columnList = columns
      .map((c) => `- ${c.name} (${c.type})${c.description ? `: ${c.description}` : ""}`)
      .join("\n");

    const llmResult = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "Você é o Agente de Inspeção de Metadados. Analise a estrutura da tabela e identifique o propósito de cada coluna, possíveis dados sensíveis e o domínio de negócio. Responda APENAS em JSON válido.",
        },
        {
          role: "user",
          content: `Inspecione a tabela "${state.assetName ?? "desconhecida"}" do sistema "${state.sourceSystem ?? "desconhecido"}".

Colunas:
${columnList}

Retorne JSON no formato:
{
  "tablePurpose": "descrição do propósito da tabela",
  "businessDomain": "domínio de negócio (ex: Cliente, Produto, Financeiro)",
  "sensitiveColumnsDetected": ["col1", "col2"],
  "dataTypes": {"col1": "tipo_semântico", "col2": "tipo_semântico"},
  "inspectionNotes": "observações adicionais"
}`,
        },
      ],
      responseFormat: { type: "json_object" },
    });

    const rawContent =
      typeof llmResult.choices[0]?.message?.content === "string"
        ? llmResult.choices[0].message.content
        : "{}";
    const inspection = JSON.parse(rawContent);

    const result: AgentResult = {
      agent: "inspection",
      status: "completed",
      output: `Inspeção concluída: ${columns.length} colunas analisadas. Domínio: ${inspection.businessDomain ?? "N/A"}`,
      metadata: { inspection, columnCount: columns.length },
      durationMs: Date.now() - startMs,
    };

    return {
      ...state,
      columns,
      agentResults: [...state.agentResults, result],
    };
  } catch (err: any) {
    const result: AgentResult = {
      agent: "inspection",
      status: "failed",
      output: `Falha na inspeção: ${err?.message ?? err}`,
      metadata: {},
      durationMs: Date.now() - startMs,
      error: err?.message ?? String(err),
    };
    return { ...state, agentResults: [...state.agentResults, result] };
  }
}

// ─── Agente 2: Classificação ──────────────────────────────────────────────────

async function runClassificationAgent(
  state: OrchestrationState
): Promise<OrchestrationState> {
  const startMs = Date.now();
  console.log(`[ClassificationAgent] Classificando ativo: ${state.assetName ?? state.assetId}`);

  try {
    // Executa scanner nativo de PII
    const piiScanResult = scanTable(
      state.columns.map((c) => ({ name: c.name, type: c.type }))
    );

    // Usa LLM para classificação governada
    const piiSummary =
      piiScanResult.piiColumns.length > 0
        ? piiScanResult.piiColumns
            .map((p) => `${p.name}: ${p.result.category} (risco ${p.result.riskLevel})`)
            .join(", ")
        : "Nenhum PII detectado";

    const llmResult = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "Você é o Agente de Classificação de Governança. Com base no scan de PII e nos metadados, aplique as tags de governança corretas e determine a sensibilidade do ativo. Responda APENAS em JSON válido.",
        },
        {
          role: "user",
          content: `Classifique o ativo "${state.assetName ?? "desconhecido"}".

PII Detectado: ${piiSummary}
Colunas sensíveis (risco alto): ${piiScanResult.piiColumns.filter((p) => p.result.riskLevel === "alto").map((p) => p.name).join(", ") || "nenhuma"}
Sensibilidade sugerida pelo scanner: ${piiScanResult.suggestedSensitivity}

Retorne JSON no formato:
{
  "sensitivity": "publico|interno|confidencial|restrito",
  "tags": ["PII", "LGPD", "Financeiro"],
  "governancePolicies": ["Política 1", "Política 2"],
  "reasoning": "justificativa da classificação"
}`,
        },
      ],
      responseFormat: { type: "json_object" },
    });

    const rawContent =
      typeof llmResult.choices[0]?.message?.content === "string"
        ? llmResult.choices[0].message.content
        : "{}";
    const classification = JSON.parse(rawContent);

    // Persiste a classificação no banco de dados
    if (state.assetId) {
      await db.updateDataAsset(state.assetId, {
        sensitivity: classification.sensitivity ?? piiScanResult.suggestedSensitivity,
      } as any, state.organizationId);

      // Atualiza isPii nos atributos detectados
      for (const piiCol of piiScanResult.piiColumns) {
        const attrs = await db.getDataAttributes(state.assetId, state.organizationId);
        const attr = attrs.find((a: any) => a.name === piiCol.name);
        if (attr) {
          await db.updateDataAttribute(attr.id, { isPii: true } as any, state.organizationId);
        }
      }
    }

    const result: AgentResult = {
      agent: "classification",
      status: "completed",
      output: `Classificação: ${classification.sensitivity}. Tags: ${(classification.tags ?? []).join(", ")}. PII: ${piiScanResult.piiCount} coluna(s).`,
      metadata: { classification, piiScanResult },
      durationMs: Date.now() - startMs,
    };

    return {
      ...state,
      piiScanResult,
      classificationResult: {
        sensitivity: classification.sensitivity ?? piiScanResult.suggestedSensitivity,
        tags: classification.tags ?? [],
        governancePolicies: classification.governancePolicies ?? [],
        reasoning: classification.reasoning ?? "",
      },
      agentResults: [...state.agentResults, result],
    };
  } catch (err: any) {
    const result: AgentResult = {
      agent: "classification",
      status: "failed",
      output: `Falha na classificação: ${err?.message ?? err}`,
      metadata: {},
      durationMs: Date.now() - startMs,
      error: err?.message ?? String(err),
    };
    return { ...state, agentResults: [...state.agentResults, result] };
  }
}

// ─── Agente 3: Documentação ───────────────────────────────────────────────────

async function runDocumentationAgent(
  state: OrchestrationState
): Promise<OrchestrationState> {
  const startMs = Date.now();
  console.log(`[DocumentationAgent] Gerando documentação para: ${state.assetName ?? state.assetId}`);

  try {
    const classification = state.classificationResult;
    const pii = state.piiScanResult;

    const llmResult = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "Você é o Agente de Documentação de Dados. Gere relatórios de governança e extraia termos para o glossário corporativo. Responda APENAS em JSON válido.",
        },
        {
          role: "user",
          content: `Gere documentação para o ativo "${state.assetName ?? "desconhecido"}".

Classificação: ${classification?.sensitivity ?? "não classificado"}
Tags: ${(classification?.tags ?? []).join(", ") || "nenhuma"}
Políticas: ${(classification?.governancePolicies ?? []).join("; ") || "nenhuma"}
PII detectado: ${pii?.piiCount ?? 0} coluna(s) — ${pii?.riskSummary ?? "sem dados"}
Colunas: ${state.columns.map((c) => `${c.name}(${c.type})`).join(", ")}

Retorne JSON no formato:
{
  "reportMarkdown": "# Relatório de Governança\\n...",
  "glossaryTerms": [
    { "term": "Nome do Termo", "definition": "Definição", "category": "Categoria" }
  ]
}`,
        },
      ],
      responseFormat: { type: "json_object" },
    });

    const rawContent =
      typeof llmResult.choices[0]?.message?.content === "string"
        ? llmResult.choices[0].message.content
        : "{}";
    const documentation = JSON.parse(rawContent);

    // Persiste termos no glossário
    if (documentation.glossaryTerms?.length) {
      const existing = await db.getGlossaryTerms({ organizationId: state.organizationId });
      const existingNames = new Set(
        existing.map((t: any) => t.term.toLowerCase().trim())
      );
      for (const term of documentation.glossaryTerms) {
        if (!term.term || existingNames.has(term.term.toLowerCase().trim())) continue;
        await db.createGlossaryTerm({
          term: term.term,
          definition: term.definition,
          category: term.category ?? "Geral",
          status: "rascunho",
          notes: `Gerado automaticamente pelo Agente de Documentação (runId: ${state.runId}).`,
        } as any);
        existingNames.add(term.term.toLowerCase().trim());
      }
    }

    const result: AgentResult = {
      agent: "documentation",
      status: "completed",
      output: `Documentação gerada. ${documentation.glossaryTerms?.length ?? 0} termos adicionados ao glossário.`,
      metadata: { glossaryCount: documentation.glossaryTerms?.length ?? 0 },
      durationMs: Date.now() - startMs,
    };

    return {
      ...state,
      documentationResult: {
        reportMarkdown: documentation.reportMarkdown ?? "",
        glossaryTerms: documentation.glossaryTerms ?? [],
      },
      agentResults: [...state.agentResults, result],
    };
  } catch (err: any) {
    const result: AgentResult = {
      agent: "documentation",
      status: "failed",
      output: `Falha na documentação: ${err?.message ?? err}`,
      metadata: {},
      durationMs: Date.now() - startMs,
      error: err?.message ?? String(err),
    };
    return { ...state, agentResults: [...state.agentResults, result] };
  }
}

// ─── Agente 4: Auditoria ──────────────────────────────────────────────────────

async function runAuditAgent(
  state: OrchestrationState
): Promise<OrchestrationState> {
  const startMs = Date.now();
  console.log(`[AuditAgent] Auditando ativo: ${state.assetName ?? state.assetId}`);

  try {
    const classification = state.classificationResult;
    const pii = state.piiScanResult;

    const llmResult = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "Você é o Agente de Auditoria de Dados. Avalie riscos de segurança, conformidade LGPD/GDPR e sugira melhorias. Responda APENAS em JSON válido.",
        },
        {
          role: "user",
          content: `Audite o ativo "${state.assetName ?? "desconhecido"}".

Sensibilidade: ${classification?.sensitivity ?? "não classificado"}
PII detectado: ${pii?.piiCount ?? 0} coluna(s)
Colunas PII de alto risco: ${pii?.piiColumns.filter((p) => p.result.riskLevel === "alto").map((p) => p.name).join(", ") || "nenhuma"}
Tem dados sensíveis LGPD (Art. 11): ${pii?.hasSensitiveLgpd ? "SIM" : "NÃO"}

Retorne JSON no formato:
{
  "riskScore": 75,
  "complianceStatus": "compliant|non_compliant|needs_review",
  "recommendations": ["Recomendação 1", "Recomendação 2"],
  "accessAlerts": ["Alerta 1"]
}`,
        },
      ],
      responseFormat: { type: "json_object" },
    });

    const rawContent =
      typeof llmResult.choices[0]?.message?.content === "string"
        ? llmResult.choices[0].message.content
        : "{}";
    const audit = JSON.parse(rawContent);

    // Registra log de auditoria no banco
    if (state.assetId) {
      await db.createAuditLog({
        action: "agent_audit",
        entity: "data_asset",
        entityId: state.assetId,
        entityName: state.assetName,
        details: {
          runId: state.runId,
          riskScore: audit.riskScore,
          complianceStatus: audit.complianceStatus,
          recommendations: audit.recommendations,
          agentPipeline: "inspection→classification→documentation→audit",
        },
      } as any);
    }

    // Envia alerta via Teams se risco alto ou não-conforme
    if (
      audit.complianceStatus === "non_compliant" ||
      (audit.riskScore ?? 0) >= 70
    ) {
      await sendGovernanceAlert({
        type: "audit_risk",
        assetName: state.assetName ?? "Ativo desconhecido",
        assetId: state.assetId,
        riskScore: audit.riskScore,
        complianceStatus: audit.complianceStatus,
        recommendations: audit.recommendations ?? [],
        runId: state.runId,
      }).catch((e) =>
        console.warn("[AuditAgent] Falha ao enviar alerta Teams:", e?.message)
      );
    }

    const result: AgentResult = {
      agent: "audit",
      status: "completed",
      output: `Auditoria: risco ${audit.riskScore ?? "N/A"}/100. Status: ${audit.complianceStatus}. ${audit.recommendations?.length ?? 0} recomendação(ões).`,
      metadata: { audit },
      durationMs: Date.now() - startMs,
    };

    return {
      ...state,
      auditResult: {
        riskScore: audit.riskScore ?? 0,
        recommendations: audit.recommendations ?? [],
        accessAlerts: audit.accessAlerts ?? [],
        complianceStatus: audit.complianceStatus ?? "needs_review",
      },
      agentResults: [...state.agentResults, result],
    };
  } catch (err: any) {
    const result: AgentResult = {
      agent: "audit",
      status: "failed",
      output: `Falha na auditoria: ${err?.message ?? err}`,
      metadata: {},
      durationMs: Date.now() - startMs,
      error: err?.message ?? String(err),
    };
    return { ...state, agentResults: [...state.agentResults, result] };
  }
}

// ─── Grafo de Orquestração ────────────────────────────────────────────────────

/**
 * Define a sequência do grafo de agentes.
 * Cada nó recebe o estado atual e retorna o estado atualizado.
 * A execução é sequencial: inspection → classification → documentation → audit
 */
const AGENT_GRAPH: Array<{
  name: AgentName;
  fn: (state: OrchestrationState) => Promise<OrchestrationState>;
}> = [
  { name: "inspection", fn: runInspectionAgent },
  { name: "classification", fn: runClassificationAgent },
  { name: "documentation", fn: runDocumentationAgent },
  { name: "audit", fn: runAuditAgent },
];

// ─── API Pública ──────────────────────────────────────────────────────────────

export interface OrchestratorInput {
  organizationId: number;
  assetId?: number;
  assetName?: string;
  sourceSystem?: string;
  fullyQualifiedName?: string;
  columns?: Array<{ name: string; type: string; description?: string }>;
  /** Agentes a executar (default: todos em sequência) */
  agents?: AgentName[];
}

export interface OrchestratorOutput {
  runId: string;
  success: boolean;
  agentResults: AgentResult[];
  finalState: OrchestrationState;
  summary: string;
  durationMs: number;
}

/**
 * Executa o pipeline completo de agentes de governança para um ativo de dados.
 *
 * @example
 * const result = await runGovernanceAgents({ assetId: 42 });
 * console.log(result.summary);
 */
export async function runGovernanceAgents(
  input: OrchestratorInput
): Promise<OrchestratorOutput> {
  const runId = `orch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startMs = Date.now();

  console.log(`[Orchestrator] Iniciando pipeline multiagente — runId: ${runId}`);

  // Carrega metadados do ativo se assetId fornecido
  let assetName = input.assetName;
  let sourceSystem = input.sourceSystem;
  let fullyQualifiedName = input.fullyQualifiedName;
  let columns = input.columns ?? [];

  if (input.assetId && (!assetName || columns.length === 0)) {
    try {
      const assets = await db.getDataAssets({ organizationId: input.organizationId });
      const asset = assets.find((a: any) => a.id === input.assetId);
      if (!asset) throw new Error("Asset not found in the authenticated organization");
      assetName = assetName ?? asset.name ?? undefined;
      sourceSystem = sourceSystem ?? asset.sourceSystem ?? undefined;
      fullyQualifiedName = fullyQualifiedName ?? asset.fullyQualifiedName ?? undefined;
    } catch (e) {
      console.warn("[Orchestrator] Falha ao carregar metadados do ativo:", e);
    }
  }

  // Estado inicial do grafo
  let state: OrchestrationState = {
    runId,
    organizationId: input.organizationId,
    assetId: input.assetId,
    assetName,
    sourceSystem,
    fullyQualifiedName,
    columns,
    agentResults: [],
    startedAt: new Date(),
  };

  // Filtra agentes a executar
  const agentsToRun = input.agents
    ? AGENT_GRAPH.filter((a) => input.agents!.includes(a.name))
    : AGENT_GRAPH;

  // Executa o grafo de agentes sequencialmente
  for (const node of agentsToRun) {
    console.log(`[Orchestrator] → Executando agente: ${node.name}`);
    try {
      state = await node.fn(state);
    } catch (err: any) {
      console.error(`[Orchestrator] Erro crítico no agente ${node.name}:`, err);
      state = {
        ...state,
        error: `Agente ${node.name} falhou: ${err?.message ?? err}`,
        agentResults: [
          ...state.agentResults,
          {
            agent: node.name,
            status: "failed",
            output: `Erro crítico: ${err?.message ?? err}`,
            metadata: {},
            durationMs: 0,
            error: err?.message ?? String(err),
          },
        ],
      };
    }
  }

  state.completedAt = new Date();
  const totalDuration = Date.now() - startMs;

  const completedAgents = state.agentResults.filter(
    (r) => r.status === "completed"
  ).length;
  const failedAgents = state.agentResults.filter(
    (r) => r.status === "failed"
  ).length;

  const summary = [
    `Pipeline multiagente concluído em ${(totalDuration / 1000).toFixed(1)}s.`,
    `Agentes: ${completedAgents} concluídos, ${failedAgents} com falha.`,
    state.classificationResult
      ? `Classificação: ${state.classificationResult.sensitivity}.`
      : "",
    state.piiScanResult
      ? `PII: ${state.piiScanResult.piiCount} coluna(s) detectada(s).`
      : "",
    state.auditResult
      ? `Risco: ${state.auditResult.riskScore}/100 — ${state.auditResult.complianceStatus}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  console.log(`[Orchestrator] ${summary}`);

  return {
    runId,
    success: failedAgents === 0,
    agentResults: state.agentResults,
    finalState: state,
    summary,
    durationMs: totalDuration,
  };
}

/**
 * Executa o pipeline para todos os ativos ativos do catálogo (varredura global).
 * Útil para ser chamado pelo metadataScheduler periodicamente.
 */
export async function runGlobalGovernanceAgents(options: {
  organizationId: number;
  maxAssets?: number;
  agents?: AgentName[];
}): Promise<{ processed: number; succeeded: number; failed: number }> {
  console.log(`[Orchestrator] Iniciando varredura de governança para tenant ${options.organizationId}...`);

  const assets = await db.getDataAssets({ organizationId: options.organizationId });
  const activeAssets = assets
    .filter((a: any) => a.status !== "inativo" && a.status !== "deprecated")
    .slice(0, options?.maxAssets ?? 20);

  let succeeded = 0;
  let failed = 0;

  for (const asset of activeAssets) {
    try {
      const result = await runGovernanceAgents({
        organizationId: options.organizationId,
        assetId: asset.id,
        assetName: asset.name ?? undefined,
        sourceSystem: asset.sourceSystem ?? undefined,
        fullyQualifiedName: asset.fullyQualifiedName ?? undefined,
        agents: options.agents,
      });
      if (result.success) succeeded++;
      else failed++;
    } catch (err) {
      console.error(`[Orchestrator] Falha ao processar ativo ${asset.id}:`, err);
      failed++;
    }
  }

  console.log(
    `[Orchestrator] Varredura do tenant ${options.organizationId} concluída: ${succeeded} sucesso(s), ${failed} falha(s).`
  );
  return { processed: activeAssets.length, succeeded, failed };
}
