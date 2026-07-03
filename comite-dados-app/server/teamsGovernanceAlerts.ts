/**
 * teamsGovernanceAlerts.ts — Alertas Proativos de Governança via Microsoft Teams
 *
 * Envia mensagens adaptativas (Adaptive Cards) para canais do Teams quando
 * eventos de governança críticos são detectados:
 *
 *   - Nova tabela detectada sem classificação de sensibilidade
 *   - Colunas PII detectadas sem políticas de proteção aplicadas
 *   - Violação de qualidade de dados (score abaixo do threshold)
 *   - Auditoria de risco alto (score >= 70) ou status não-conforme
 *   - Acesso a dados sensíveis sem autorização registrada
 *
 * Integração via Microsoft Teams Incoming Webhook (sem necessidade de OAuth).
 * Configuração:
 *   TEAMS_GOVERNANCE_WEBHOOK_URL — URL do Incoming Webhook do canal de auditoria
 *
 * Opcional (para envio via Graph API com autenticação):
 *   TEAMS_TENANT_ID, TEAMS_CLIENT_ID, TEAMS_CLIENT_SECRET, TEAMS_CHANNEL_ID
 */

// ─── Tipos de Alertas ─────────────────────────────────────────────────────────

export type GovernanceAlertType =
  | "unclassified_asset"    // Nova tabela sem classificação
  | "pii_detected"          // PII detectado sem política aplicada
  | "quality_violation"     // Violação de qualidade de dados
  | "audit_risk"            // Risco alto na auditoria
  | "policy_applied"        // Política de proteção aplicada com sucesso
  | "access_anomaly";       // Acesso suspeito a dados sensíveis

export interface GovernanceAlertPayload {
  type: GovernanceAlertType;
  assetName: string;
  assetId?: number;
  severity?: "low" | "medium" | "high" | "critical";
  // Para unclassified_asset
  sourceSystem?: string;
  // Para pii_detected
  piiColumns?: string[];
  piiCount?: number;
  // Para quality_violation
  metricName?: string;
  score?: number;
  threshold?: number;
  // Para audit_risk
  riskScore?: number;
  complianceStatus?: string;
  recommendations?: string[];
  // Para policy_applied
  policiesApplied?: number;
  // Para access_anomaly
  accessedBy?: string;
  accessedAt?: Date;
  // Metadados gerais
  runId?: string;
  portalUrl?: string;
}

// ─── Construção de Adaptive Cards ────────────────────────────────────────────

function getSeverityColor(severity?: string): string {
  switch (severity) {
    case "critical": return "attention";
    case "high":     return "warning";
    case "medium":   return "accent";
    default:         return "good";
  }
}

function getSeverityEmoji(severity?: string): string {
  switch (severity) {
    case "critical": return "🔴";
    case "high":     return "🟠";
    case "medium":   return "🟡";
    default:         return "🟢";
  }
}

function buildUnclassifiedAssetCard(payload: GovernanceAlertPayload): object {
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "Container",
              style: "warning",
              items: [
                {
                  type: "TextBlock",
                  text: "⚠️ Nova Tabela Sem Classificação Detectada",
                  weight: "Bolder",
                  size: "Medium",
                  color: "Warning",
                },
                {
                  type: "FactSet",
                  facts: [
                    { title: "Ativo:", value: payload.assetName },
                    { title: "Sistema:", value: payload.sourceSystem ?? "Desconhecido" },
                    { title: "Status:", value: "Sem classificação de sensibilidade" },
                    { title: "Detectado em:", value: new Date().toLocaleString("pt-BR") },
                  ],
                },
                {
                  type: "TextBlock",
                  text: "**Ação necessária:** Acesse o Portal de Governança para classificar este ativo e aplicar as políticas de acesso adequadas.",
                  wrap: true,
                  color: "Warning",
                },
              ],
            },
          ],
          actions: payload.portalUrl
            ? [
                {
                  type: "Action.OpenUrl",
                  title: "Classificar no Portal",
                  url: payload.portalUrl,
                },
              ]
            : [],
        },
      },
    ],
  };
}

function buildPiiDetectedCard(payload: GovernanceAlertPayload): object {
  const colsList = (payload.piiColumns ?? []).slice(0, 8).join(", ");
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "Container",
              style: "attention",
              items: [
                {
                  type: "TextBlock",
                  text: `🔒 PII Detectado — ${payload.piiCount ?? 0} Coluna(s) Sensível(is)`,
                  weight: "Bolder",
                  size: "Medium",
                  color: "Attention",
                },
                {
                  type: "FactSet",
                  facts: [
                    { title: "Ativo:", value: payload.assetName },
                    { title: "Colunas PII:", value: colsList || "Ver portal" },
                    { title: "Total detectado:", value: String(payload.piiCount ?? 0) },
                    { title: "Conformidade LGPD:", value: "Verificação necessária" },
                    { title: "Detectado em:", value: new Date().toLocaleString("pt-BR") },
                  ],
                },
                {
                  type: "TextBlock",
                  text: "**Ação necessária:** Revise as políticas de acesso e aplique mascaramento (Masking Policy) para as colunas identificadas.",
                  wrap: true,
                  color: "Attention",
                },
              ],
            },
          ],
          actions: payload.portalUrl
            ? [
                {
                  type: "Action.OpenUrl",
                  title: "Ver no Portal de Governança",
                  url: payload.portalUrl,
                },
              ]
            : [],
        },
      },
    ],
  };
}

function buildQualityViolationCard(payload: GovernanceAlertPayload): object {
  const scoreColor = (payload.score ?? 100) < 50 ? "Attention" : "Warning";
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "Container",
              style: "warning",
              items: [
                {
                  type: "TextBlock",
                  text: `📊 Violação de Qualidade de Dados`,
                  weight: "Bolder",
                  size: "Medium",
                  color: scoreColor,
                },
                {
                  type: "FactSet",
                  facts: [
                    { title: "Ativo:", value: payload.assetName },
                    { title: "Métrica:", value: payload.metricName ?? "N/A" },
                    { title: "Score atual:", value: `${payload.score ?? "N/A"}%` },
                    { title: "Threshold mínimo:", value: `${payload.threshold ?? "N/A"}%` },
                    { title: "Detectado em:", value: new Date().toLocaleString("pt-BR") },
                  ],
                },
                {
                  type: "TextBlock",
                  text: "**Ação necessária:** Investigue a origem da degradação de qualidade e acione o Data Steward responsável.",
                  wrap: true,
                },
              ],
            },
          ],
          actions: payload.portalUrl
            ? [
                {
                  type: "Action.OpenUrl",
                  title: "Ver Relatório de Qualidade",
                  url: payload.portalUrl,
                },
              ]
            : [],
        },
      },
    ],
  };
}

function buildAuditRiskCard(payload: GovernanceAlertPayload): object {
  const recList = (payload.recommendations ?? [])
    .slice(0, 4)
    .map((r, i) => `${i + 1}. ${r}`)
    .join("\n");

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "Container",
              style: "attention",
              items: [
                {
                  type: "TextBlock",
                  text: `🚨 Alerta de Risco de Governança — Score ${payload.riskScore ?? "N/A"}/100`,
                  weight: "Bolder",
                  size: "Medium",
                  color: "Attention",
                },
                {
                  type: "FactSet",
                  facts: [
                    { title: "Ativo:", value: payload.assetName },
                    { title: "Score de Risco:", value: `${payload.riskScore ?? "N/A"}/100` },
                    { title: "Status Compliance:", value: payload.complianceStatus ?? "N/A" },
                    { title: "Run ID:", value: payload.runId ?? "N/A" },
                    { title: "Detectado em:", value: new Date().toLocaleString("pt-BR") },
                  ],
                },
                ...(recList
                  ? [
                      {
                        type: "TextBlock",
                        text: `**Recomendações do Agente de Auditoria:**\n${recList}`,
                        wrap: true,
                      },
                    ]
                  : []),
              ],
            },
          ],
          actions: payload.portalUrl
            ? [
                {
                  type: "Action.OpenUrl",
                  title: "Ver Auditoria no Portal",
                  url: payload.portalUrl,
                },
              ]
            : [],
        },
      },
    ],
  };
}

function buildPolicyAppliedCard(payload: GovernanceAlertPayload): object {
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "Container",
              style: "good",
              items: [
                {
                  type: "TextBlock",
                  text: `✅ Políticas de Proteção Aplicadas Automaticamente`,
                  weight: "Bolder",
                  size: "Medium",
                  color: "Good",
                },
                {
                  type: "FactSet",
                  facts: [
                    { title: "Ativo:", value: payload.assetName },
                    { title: "Políticas aplicadas:", value: String(payload.policiesApplied ?? 0) },
                    { title: "Tipo:", value: "Masking Policy + Column-Level Permissions" },
                    { title: "Aplicado em:", value: new Date().toLocaleString("pt-BR") },
                  ],
                },
                {
                  type: "TextBlock",
                  text: "Colunas PII agora estão protegidas no Unity Catalog. Usuários sem permissão verão '***PII***'.",
                  wrap: true,
                  color: "Good",
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

// ─── Envio via Webhook ────────────────────────────────────────────────────────

async function sendWebhookMessage(
  webhookUrl: string,
  card: object
): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
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

// ─── API Pública ──────────────────────────────────────────────────────────────

/**
 * Envia um alerta de governança para o canal do Microsoft Teams configurado.
 *
 * Requer a variável de ambiente:
 *   TEAMS_GOVERNANCE_WEBHOOK_URL — URL do Incoming Webhook do canal de auditoria
 *
 * @param payload  Dados do alerta de governança
 * @returns        Resultado do envio
 */
export async function sendGovernanceAlert(
  payload: GovernanceAlertPayload
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const webhookUrl = process.env.TEAMS_GOVERNANCE_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn(
      "[TeamsGovernanceAlerts] TEAMS_GOVERNANCE_WEBHOOK_URL não configurado — alerta não enviado."
    );
    return { ok: false, skipped: true, error: "Webhook URL não configurado." };
  }

  // Enriquece o payload com a URL do portal
  const portalBase = process.env.PUBLIC_URL ?? process.env.VITE_API_URL ?? "";
  const enrichedPayload: GovernanceAlertPayload = {
    ...payload,
    portalUrl: payload.assetId
      ? `${portalBase}/catalogo?asset=${payload.assetId}`
      : portalBase || undefined,
  };

  // Seleciona o card adequado para o tipo de alerta
  let card: object;
  switch (payload.type) {
    case "unclassified_asset":
      card = buildUnclassifiedAssetCard(enrichedPayload);
      break;
    case "pii_detected":
      card = buildPiiDetectedCard(enrichedPayload);
      break;
    case "quality_violation":
      card = buildQualityViolationCard(enrichedPayload);
      break;
    case "audit_risk":
      card = buildAuditRiskCard(enrichedPayload);
      break;
    case "policy_applied":
      card = buildPolicyAppliedCard(enrichedPayload);
      break;
    default:
      card = buildAuditRiskCard(enrichedPayload);
  }

  const result = await sendWebhookMessage(webhookUrl, card);

  if (result.ok) {
    console.log(
      `[TeamsGovernanceAlerts] Alerta "${payload.type}" enviado para o canal de auditoria. Ativo: ${payload.assetName}`
    );
  } else {
    console.error(
      `[TeamsGovernanceAlerts] Falha ao enviar alerta "${payload.type}": ${result.error}`
    );
  }

  return result;
}

/**
 * Verifica se o serviço de alertas Teams está configurado.
 */
export function isTeamsGovernanceConfigured(): boolean {
  return !!process.env.TEAMS_GOVERNANCE_WEBHOOK_URL;
}

/**
 * Envia alerta para múltiplos ativos sem classificação de uma vez.
 * Útil para ser chamado pelo metadataScheduler após uma varredura.
 */
export async function alertUnclassifiedAssets(
  assets: Array<{ id: number; name: string; sourceSystem?: string }>
): Promise<{ sent: number; failed: number }> {
  if (!isTeamsGovernanceConfigured() || assets.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  // Agrupa em um único alerta de resumo se houver muitos ativos
  if (assets.length > 3) {
    const assetList = assets
      .slice(0, 10)
      .map((a) => `• ${a.name} (${a.sourceSystem ?? "fonte desconhecida"})`)
      .join("\n");

    const summaryPayload: GovernanceAlertPayload = {
      type: "unclassified_asset",
      assetName: `${assets.length} ativo(s) sem classificação`,
      severity: "high",
      sourceSystem: "Varredura Automática",
    };

    const webhookUrl = process.env.TEAMS_GOVERNANCE_WEBHOOK_URL!;
    const card = {
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          content: {
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            type: "AdaptiveCard",
            version: "1.4",
            body: [
              {
                type: "Container",
                style: "warning",
                items: [
                  {
                    type: "TextBlock",
                    text: `⚠️ ${assets.length} Ativo(s) Detectado(s) Sem Classificação`,
                    weight: "Bolder",
                    size: "Medium",
                    color: "Warning",
                  },
                  {
                    type: "TextBlock",
                    text: `Os seguintes ativos foram detectados sem classificação de sensibilidade:\n\n${assetList}${assets.length > 10 ? `\n... e mais ${assets.length - 10} ativo(s).` : ""}`,
                    wrap: true,
                  },
                  {
                    type: "TextBlock",
                    text: `**Detectado em:** ${new Date().toLocaleString("pt-BR")}`,
                    wrap: true,
                    isSubtle: true,
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    const result = await sendWebhookMessage(webhookUrl, card);
    if (result.ok) sent++;
    else failed++;
  } else {
    // Envia um alerta individual para cada ativo
    for (const asset of assets) {
      const result = await sendGovernanceAlert({
        type: "unclassified_asset",
        assetName: asset.name,
        assetId: asset.id,
        sourceSystem: asset.sourceSystem,
        severity: "medium",
      });
      if (result.ok) sent++;
      else if (!result.skipped) failed++;
    }
  }

  return { sent, failed };
}
