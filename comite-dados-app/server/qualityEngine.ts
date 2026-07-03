import * as db from "./db";
import { getAdapter } from "./adapters/index";
import { sendGovernanceAlert } from "./teamsGovernanceAlerts";

export class QualityEngineService {
  /**
   * Executa checks reais de qualidade em um ativo via adaptador da sua fonte.
   * Persiste os resultados em data_quality_checks e atualiza qualityScore no ativo.
   */
  async runChecksForAsset(assetId: number): Promise<void> {
    const assets = await db.getDataAssets();
    const asset = assets.find(a => a.id === assetId);
    if (!asset) {
      console.warn(`[QualityEngine] Ativo #${assetId} não encontrado.`);
      return;
    }

    console.log(`[QualityEngine] Executando checks para "${asset.name}" (fonte: ${asset.sourceSystem ?? "portal"})...`);

    const adapter = getAdapter(asset.sourceSystem);
    const rules = await db.getQualityRules(assetId);
    
    const checks = await adapter.runChecks(assetId, {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      sourceSystem: asset.sourceSystem ?? null,
      ownerId: asset.ownerId ?? null,
      stewardId: asset.stewardId ?? null,
      qualityScore: asset.qualityScore ?? null,
      fullyQualifiedName: asset.fullyQualifiedName ?? null,
    }, rules);

    console.log(`[QualityEngine] "${asset.name}" — adapter retornou ${checks.length} check(s): ${checks.map(c => `${c.metricName}=${c.score}`).join(", ") || "(nenhum)"}`);

    // Persiste cada check
    let violations: any[] = [];

    for (const check of checks) {
      const status: "sucesso" | "alerta" | "falha" =
        check.score >= check.threshold ? "sucesso"
        : check.score >= check.threshold * 0.8 ? "alerta"
        : "falha";

      if (status === "falha") {
        violations.push({
          metric: check.metricName,
          score: check.score,
          threshold: check.threshold,
          details: check.details,
        });
      }

      try {
        await db.createDataQualityCheck({
          assetId,
          metricName: check.metricName,
          score: check.score,
          threshold: check.threshold,
          status,
          details: check.details,
          lastRunAt: new Date(),
        });
      } catch (insertErr: any) {
        console.error(`[QualityEngine] Erro ao salvar check "${check.metricName}" para ativo #${assetId}: ${insertErr?.message ?? insertErr}`);
        throw insertErr;
      }
    }

    // Se houver violações críticas, dispara webhooks e alerta Teams
    if (violations.length > 0) {
      await db.dispatchWebhook('quality.violation', {
        assetId: asset.id,
        assetName: asset.name,
        organizationId: asset.organizationId,
        violations,
        timestamp: new Date().toISOString()
      });

      // Alerta proativo via Microsoft Teams para cada violação crítica
      for (const violation of violations) {
        await sendGovernanceAlert({
          type: 'quality_violation',
          assetName: asset.name,
          assetId: asset.id,
          severity: violation.score < violation.threshold * 0.5 ? 'critical' : 'high',
          metricName: violation.metric,
          score: violation.score,
          threshold: violation.threshold,
        }).catch(e => console.warn('[QualityEngine] Falha ao enviar alerta Teams:', e?.message));
      }
    }

    // Calcula score médio ponderado e atualiza o ativo
    if (checks.length > 0) {
      const avg = Math.round(checks.reduce((s, c) => s + c.score, 0) / checks.length);
      await db.updateDataAsset(assetId, { qualityScore: avg });
      console.log(`[QualityEngine] "${asset.name}" — score médio: ${avg}%`);
    }
  }

  /**
   * Processa todos os ativos ativos em paralelo (até 5 simultâneos).
   */
  async runGlobalQualityCheck(): Promise<{ success: boolean; assetsProcessed: number }> {
    const assets = (await db.getDataAssets()).filter(a => a.status === "ativo");
    console.log(`[QualityEngine] Iniciando validação global para ${assets.length} ativos.`);

    // Processa em batches de 5 para não sobrecarregar conexões
    const batchSize = 5;
    for (let i = 0; i < assets.length; i += batchSize) {
      const batch = assets.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(a => this.runChecksForAsset(a.id)));
    }

    console.log(`[QualityEngine] Validação global concluída.`);
    return { success: true, assetsProcessed: assets.length };
  }
}

export const qualityEngine = new QualityEngineService();
