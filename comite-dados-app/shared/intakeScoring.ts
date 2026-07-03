/**
 * Calcula a pontuação total e o tier de prioridade (P1-P4)
 * de uma demanda Intake a partir dos 8 critérios ponderados.
 *
 * Escala de cada critério: 1 (baixo) → 3 (alto)
 * Score final: 0–100 (percentual do máximo ponderado possível)
 *
 * Tiers:
 *   P1 (Urgente)     ≥ 85 → SLA 2 dias
 *   P2 (Alta)        ≥ 70 → SLA 5 dias
 *   P3 (Média)       ≥ 60 → SLA 15 dias
 *   P4 (Backlog)     < 60 → sem SLA
 */
export const INTAKE_SCORE_WEIGHTS: Record<string, number> = {
  scoreFinancialImpact: 10,
  scoreBusinessUrgency: 10,
  scoreReach: 8,
  scoreStrategicAlignment: 8,
  scoreIntakeCompleteness: 6,
  scoreTechnicalFeasibility: 5,
  scoreReuse: 4,
  scoreDataOwnerDefined: 4,
};

export function calcScore(scores: Record<string, number>): { total: number; tier: string } {
  const raw = Object.entries(INTAKE_SCORE_WEIGHTS).reduce(
    (acc, [k, w]) => acc + ((scores[k] ?? 1) - 1) * (w / 2),
    0,
  );
  const maxRaw = Object.values(INTAKE_SCORE_WEIGHTS).reduce((a, w) => a + w, 0);
  const total = Math.round((raw / maxRaw) * 100);
  const tier = total >= 85 ? "P1" : total >= 70 ? "P2" : total >= 60 ? "P3" : "P4";
  return { total, tier };
}
