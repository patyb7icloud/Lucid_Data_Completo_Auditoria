import { describe, expect, it } from "vitest";
import { calculateFairnessMetrics, canManageRisk, organizationIdFor } from "./aiRiskRouter";

describe("aiRisk fairness metrics", () => {
  it("calcula selection rate, SPD, DIR e EOD a partir de contagens agregadas", () => {
    const result = calculateFairnessMetrics([
      { code: "g_a", sampleSize: 100, positivePredictionCount: 40, actualPositiveCount: 50, truePositiveCount: 20 },
      { code: "g_b", sampleSize: 50, positivePredictionCount: 10, actualPositiveCount: 25, truePositiveCount: 5 },
    ]);

    expect(result.groups[0].selectionRate).toBeCloseTo(0.4);
    expect(result.groups[1].selectionRate).toBeCloseTo(0.2);
    expect(result.metrics.statisticalParityDifference).toBeCloseTo(0.2);
    expect(result.metrics.disparateImpactRatio).toBeCloseTo(0.5);
    expect(result.metrics.equalOpportunityDifference).toBeCloseTo(0.2);
    expect(result.metrics.totalSampleSize).toBe(150);
  });

  it("não inventa equal opportunity sem ground truth", () => {
    const result = calculateFairnessMetrics([
      { code: "g_a", sampleSize: 20, positivePredictionCount: 8 },
      { code: "g_b", sampleSize: 20, positivePredictionCount: 4 },
    ]);
    expect(result.metrics.equalOpportunityDifference).toBeNull();
    expect(result.metrics.disparateImpactRatio).toBeCloseTo(0.5);
  });
});

describe("aiRisk tenant and role guards", () => {
  it("usa organização 1 como fallback e não permite owner de outro registro", () => {
    expect(organizationIdFor({ id: 1, organizationId: null })).toBe(1);
    expect(canManageRisk({ id: 10, role: "user" }, { ownerId: 11, createdById: 11 })).toBe(false);
    expect(canManageRisk({ id: 11, role: "user" }, { ownerId: 11, createdById: 11 })).toBe(true);
  });

  it("permite revisão somente aos papéis de governança", () => {
    expect(canManageRisk({ id: 20, role: "data_steward" }, { ownerId: 99, createdById: 99 })).toBe(true);
    expect(canManageRisk({ id: 20, role: "admin" }, { ownerId: 99, createdById: 99 })).toBe(true);
    expect(canManageRisk({ id: 20, role: "data_analyst" }, { ownerId: 99, createdById: 99 })).toBe(false);
  });
});
