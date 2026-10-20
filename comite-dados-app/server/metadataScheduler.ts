/**
 * metadataScheduler.ts
 *
 * Job periódico que executa o Metadata Crawler para sincronizar ativos
 * de sistemas externos (SAP, Snowflake, etc) automaticamente.
 *
 * IMPORTANTE — Políticas PII no Unity Catalog:
 *   O scheduler NÃO aplica políticas de mascaramento/RLS/CLS automaticamente.
 *   Ao detectar colunas PII, apenas marca o ativo como 'pendente_revisao'
 *   e envia alerta Teams. A aplicação efetiva das políticas requer:
 *     1. Revisão do steward via portal (previewPiiPolicies)
 *     2. Aprovação explícita (approvePiiPolicies)
 *     3. Clique no botão "Sync Databricks" (syncApprovedPiiPolicies)
 */
import { metadataCollector } from "./metadataCollector";
import { qualityEngine } from "./qualityEngine";
import * as db from "./db";
import { runGlobalGovernanceAgents } from "./agentOrchestrator";
import { alertUnclassifiedAssets, sendGovernanceAlert } from "./teamsGovernanceAlerts";
import { markAssetPendingPiiReview } from "./databricksPolicyService";
import { scanTable } from "./piiScanner";
import { syncDatabricksModels } from "./scripts/databricksMLSync";
import { randomUUID } from "node:crypto";
import { runWithLlmContext } from "./_core/llm";

// Por padrão, roda a cada 24 horas.
const INTERVAL_MS = 60 * 60 * 1000;

let crawlerTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

async function runCrawler(): Promise<void> {
  if (isRunning) return;

  isRunning = true;
  console.log("[MetadataScheduler] Iniciando ciclo de sincronização e qualidade...");

  try {
    // 1. Sincroniza Metadados (Crawler)
    await metadataCollector.syncAll();
    await metadataCollector.processApprovedServiceNowTickets();

    // 1.b Sincroniza Modelos de ML
    await syncDatabricksModels();

    // 2. Executa Data Quality automaticamente
    await qualityEngine.runGlobalQualityCheck();

    // 3. Captura Snapshot para Tendências (Dashboards Comerciais)
    await db.snapshotQualityMetrics();

    // 4. Detecta ativos sem classificação e envia alertas proativos via Teams
    try {
      const allAssets = await db.getDataAssets();
      const unclassified = allAssets.filter(
        (a: any) =>
          !a.sensitivity ||
          a.sensitivity === "" ||
          a.sensitivity === null
      );
      if (unclassified.length > 0) {
        console.log(
          `[MetadataScheduler] ${unclassified.length} ativo(s) sem classificação detectado(s). Enviando alertas Teams...`
        );
        await alertUnclassifiedAssets(
          unclassified.map((a: any) => ({
            id: a.id,
            name: a.name,
            sourceSystem: a.sourceSystem,
          }))
        );
      }
    } catch (alertErr) {
      console.warn(
        "[MetadataScheduler] Falha ao enviar alertas de ativos não classificados:",
        alertErr
      );
    }

    // 5. Executa pipeline multiagente de governança (inspeção, classificação, documentação, auditoria)
    try {
      console.log("[MetadataScheduler] Iniciando pipeline multiagente de governança...");
      for (const organizationId of await db.getOrganizationIds()) {
        const agentResult = await runWithLlmContext({
          userId: null,
          organizationId,
          requestId: randomUUID(),
          operation: "scheduler.governance_agents",
        }, () => runGlobalGovernanceAgents({ organizationId, maxAssets: 10 }));
        console.log(`[MetadataScheduler] Tenant ${organizationId}: ${agentResult.succeeded} sucesso(s), ${agentResult.failed} falha(s).`);
      }
    } catch (agentErr) {
      console.warn("[MetadataScheduler] Falha no pipeline multiagente:", agentErr);
    }

    // 6. Detecta ativos com PII e marca como 'pendente_revisao' para aprovação manual
    //    ⚠️  NÃO aplica políticas automaticamente — exige revisão e aprovação do steward
    //        antes de qualquer escrita no Unity Catalog (via botão "Sync Databricks").
    try {
      const allAssets = await db.getDataAssets();
      const assetsWithFqn = allAssets.filter(
        (a: any) =>
          a.fullyQualifiedName &&
          a.fullyQualifiedName.split(".").length === 3 &&
          // Só processa ativos que ainda não foram revisados ou sincronizados
          !(a as any).piiPolicyStatus ||
          (a as any).piiPolicyStatus === null
      );

      let pendingCount = 0;
      for (const asset of assetsWithFqn.slice(0, 20)) {
        const attrs = await db.getDataAttributes(asset.id);
        const columns = attrs.map((a: any) => ({
          name: a.name,
          type: a.dataType ?? "string",
        }));
        const scanResult = scanTable(columns);

        if (scanResult.piiCount > 0) {
          // Apenas marca como pendente — NÃO executa SQL no Databricks
          await markAssetPendingPiiReview(asset.id).catch((e: any) =>
            console.warn(
              `[MetadataScheduler] Falha ao marcar "${asset.name}" como pendente:`,
              e?.message
            )
          );

          // Envia alerta Teams informando que há PII pendente de revisão
          await sendGovernanceAlert({
            type: "pii_detected",
            assetName: asset.name,
            assetId: asset.id,
            piiColumns: scanResult.piiColumns.map((c) => c.name),
            piiCount: scanResult.piiCount,
            severity:
              scanResult.suggestedSensitivity === "restrito" ? "critical" : "high",
          }).catch(() => {});

          pendingCount++;
        }
      }

      if (pendingCount > 0) {
        console.log(
          `[MetadataScheduler] ${pendingCount} ativo(s) marcado(s) como 'pendente_revisao'. ` +
          `Aguardando aprovação do steward para aplicar políticas no Unity Catalog.`
        );
      }
    } catch (policyErr) {
      console.warn(
        "[MetadataScheduler] Falha ao marcar ativos com PII para revisão:",
        policyErr
      );
    }

    console.log(
      `[MetadataScheduler] Ciclo concluído com sucesso! Metadados, Qualidade e Agentes processados. ` +
      `Políticas PII aguardam aprovação manual do steward.`
    );
  } catch (err) {
    console.error("[MetadataScheduler] Erro durante o ciclo automático:", err);
  } finally {
    isRunning = false;
  }
}

/**
 * Inicia o scheduler do Metadata Crawler.
 */
export function startMetadataScheduler(): void {
  if (crawlerTimer) {
    console.warn("[MetadataScheduler] Crawler já está em execução.");
    return;
  }

  console.log(
    `[MetadataScheduler] Iniciado — varredura automática agendada a cada ${INTERVAL_MS / 3600000} hora(s).`
  );

  // Executa uma vez na inicialização
  runCrawler().catch(console.error);

  crawlerTimer = setInterval(() => {
    runCrawler().catch(console.error);
  }, INTERVAL_MS);
}

/**
 * Para o scheduler.
 */
export function stopMetadataScheduler(): void {
  if (crawlerTimer) {
    clearInterval(crawlerTimer);
    crawlerTimer = null;
    console.log("[MetadataScheduler] Parado.");
  }
}
