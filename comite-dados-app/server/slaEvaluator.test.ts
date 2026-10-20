import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

import {
  calculateDaysOverdue,
  evaluateAccessRequestSla,
  evaluateAssetSla,
  evaluateSla,
  resolveSlaConfig,
} from "./slaEvaluator";
import { getDb } from "./db";

const NOW = new Date("2026-01-10T00:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

const globalConfig = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  organizationId: 7,
  entityType: "global" as const,
  entityId: null,
  maxUpdateDays: 30,
  minQualityScore: 70,
  maxAccessResponseDays: 5,
  active: true,
  ...overrides,
});

describe("SLA evaluator — cálculo puro", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolve asset > domain > global, e ignora configuração desativada", () => {
    const configs = [
      globalConfig({ id: 1 }),
      globalConfig({ id: 2, entityType: "domain", entityId: 10 }),
      globalConfig({ id: 3, entityType: "asset", entityId: 99 }),
      globalConfig({ id: 4, entityType: "asset", entityId: 99, active: false }),
    ];

    expect(resolveSlaConfig(configs, 99, 10)).toMatchObject({ config: { id: 3 }, conflict: false });
    expect(resolveSlaConfig(configs, 100, 10)).toMatchObject({ config: { id: 2 }, conflict: false });
    expect(resolveSlaConfig(configs, 100, 20)).toMatchObject({ config: { id: 1 }, conflict: false });
  });

  it("não escolhe silenciosamente quando existem configs ativas duplicadas no escopo", () => {
    const result = resolveSlaConfig([
      globalConfig({ id: 10, entityType: "domain", entityId: 4 }),
      globalConfig({ id: 11, entityType: "domain", entityId: 4 }),
      globalConfig({ id: 12 }),
    ], 20, 4);

    expect(result).toEqual({ config: null, conflict: true, scope: "domain:4", configIds: [10, 11] });
  });

  it("lastSyncAt ausente viola freshness e qualityScore nulo é evidência ausente", () => {
    const observations = evaluateAssetSla({ id: 1, lastSyncAt: null, qualityScore: null }, globalConfig(), NOW);
    expect(observations).toHaveLength(2);
    expect(observations[0]).toMatchObject({ violationType: "stale_data", breach: true, daysOverdue: 0 });
    expect(observations[0].details).toMatchObject({ evidence: "missing_lastSyncAt" });
    expect(observations[1]).toMatchObject({ violationType: "low_quality", breach: true, daysOverdue: 0 });
    expect(observations[1].details).toMatchObject({ evidence: "missing_qualityScore" });
  });

  it("usa tempo decorrido UTC e respeita o limite exato", () => {
    const exact = calculateDaysOverdue(daysAgo(5), 5, NOW);
    const oneMillisecondLate = calculateDaysOverdue(new Date(daysAgo(5).getTime() - 1), 5, NOW);
    expect(exact).toMatchObject({ breach: false, daysOverdue: 0, elapsedDays: 5 });
    expect(oneMillisecondLate.breach).toBe(true);
    expect(oneMillisecondLate.daysOverdue).toBe(1);

    const freshnessAtBoundary = evaluateAssetSla(
      { id: 1, lastSyncAt: daysAgo(30), qualityScore: 100 },
      globalConfig({ maxUpdateDays: 30, minQualityScore: null }),
      NOW,
    )[0];
    expect(freshnessAtBoundary).toMatchObject({ violationType: "stale_data", breach: false, daysOverdue: 0 });
  });

  it("aplica os relógios corretos e fecha estados terminais de access request", () => {
    const owner = evaluateAccessRequestSla({ id: 1, assetId: 2, status: "pendente_owner", createdAt: daysAgo(6) }, globalConfig({ maxAccessResponseDays: 5 }), NOW)[0];
    const steward = evaluateAccessRequestSla({ id: 2, assetId: 2, status: "pendente_steward", createdAt: daysAgo(1), ownerApprovedAt: daysAgo(6) }, globalConfig({ maxAccessResponseDays: 5 }), NOW)[0];
    const stewardFallback = evaluateAccessRequestSla({ id: 3, assetId: 2, status: "pendente_steward", createdAt: daysAgo(6), ownerApprovedAt: null }, globalConfig({ maxAccessResponseDays: 5 }), NOW)[0];

    expect(owner).toMatchObject({ breach: true, daysOverdue: 1 });
    expect(steward).toMatchObject({ breach: true, daysOverdue: 1 });
    expect(steward.details).toMatchObject({ clockStartedAt: "ownerApprovedAt" });
    expect(stewardFallback).toMatchObject({ breach: true, daysOverdue: 1 });
    expect(stewardFallback.details).toMatchObject({ clockStartedAt: "createdAt" });
    expect(evaluateAccessRequestSla({ id: 4, assetId: 2, status: "aprovado", createdAt: daysAgo(90) }, globalConfig(), NOW)).toEqual([]);
    expect(evaluateAccessRequestSla({ id: 5, assetId: 2, status: "rejeitado_owner", createdAt: daysAgo(90) }, globalConfig(), NOW)).toEqual([]);
    expect(evaluateAccessRequestSla({ id: 6, assetId: 2, status: "rejeitado_steward", createdAt: daysAgo(90) }, globalConfig(), NOW)).toEqual([]);
  });

  it("permite o ciclo breach → resolve → breach novamente sem mudar a semântica da ocorrência", () => {
    const config = globalConfig({ maxUpdateDays: 5, minQualityScore: null });
    const breached = evaluateAssetSla({ id: 1, lastSyncAt: daysAgo(6), qualityScore: 100 }, config, NOW)[0];
    const resolved = evaluateAssetSla({ id: 1, lastSyncAt: NOW, qualityScore: 100 }, config, NOW)[0];
    const reopened = evaluateAssetSla({ id: 1, lastSyncAt: daysAgo(8), qualityScore: 100 }, config, NOW)[0];

    expect(breached.breach).toBe(true);
    expect(resolved).toMatchObject({ breach: false, violationType: "stale_data" });
    expect(reopened).toMatchObject({ breach: true, violationType: "stale_data" });
    // A persistência da avaliação usa a chave config/entity/type para dedupe
    // enquanto ativa; após resolução, uma nova abertura recebe uma ocorrência nova.
    expect([breached.violationType, resolved.violationType, reopened.violationType]).toEqual([
      "stale_data",
      "stale_data",
      "stale_data",
    ]);
  });
});

describe("SLA evaluator — contrato de execução", () => {
  it("não tenta credenciais/serviços reais quando o DB não está disponível", async () => {
    vi.mocked(getDb).mockResolvedValue(null);
    const result = await evaluateSla({ organizationId: 7, source: "manual", now: NOW });
    expect(result.status).toBe("failed");
    expect(result.counters.errors).toBe(1);
    expect(result.notifications).toMatchObject({ sent: false, pending: true });
    expect(result.runId).toEqual(expect.any(String));
  });
});
