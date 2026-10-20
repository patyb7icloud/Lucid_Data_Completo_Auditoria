import { afterEach, describe, expect, it, vi } from "vitest";
import { aggregateFinOpsRows, periodWindow, type LedgerRow } from "./mlopsRouter";

const row = (overrides: Partial<LedgerRow> = {}): LedgerRow => ({
  operation: "aiGateway.chat",
  userId: 7,
  status: "success",
  inputTokens: 10,
  outputTokens: 5,
  estimatedCostUsd: "0.12000000",
  billedCostUsd: null,
  createdAt: new Date("2026-01-15T12:00:00.000Z"),
  ...overrides,
});

describe("FinOps ledger aggregates", () => {
  afterEach(() => vi.useRealTimers());

  it("soma tokens provider-reported e separa sucesso, falha e billing", () => {
    const aggregate = aggregateFinOpsRows([
      row(),
      row({ status: "failure", inputTokens: null, outputTokens: null, estimatedCostUsd: null, userId: null }),
    ]);

    expect(aggregate).toMatchObject({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
      unknownTokenRequests: 1,
      totalRequests: 2,
      successfulRequests: 1,
      failedRequests: 1,
      activeAgents: 1,
      estimatedCostUSD: 0.12,
      billedCostUSD: null,
    });
  });

  it("mantém tokens/custos indisponíveis quando nenhum log reporta valor", () => {
    const aggregate = aggregateFinOpsRows([row({ inputTokens: null, outputTokens: null, estimatedCostUsd: null })]);
    expect(aggregate.totalTokens).toBeNull();
    expect(aggregate.estimatedCostUSD).toBeNull();
    expect(aggregate.billedCostUSD).toBeNull();
  });

  it("calcula as três janelas no backend", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T15:30:00.000Z"));

    const weekly = periodWindow("weekly");
    const monthly = periodWindow("monthly");
    const yearly = periodWindow("yearly");

    expect(weekly.start.getTime()).toBe(new Date("2026-08-13T15:30:00.000Z").getTime());
    expect(monthly.start.getMonth()).toBe(7);
    expect(monthly.start.getDate()).toBe(1);
    expect(yearly.start.getMonth()).toBe(0);
    expect(yearly.start.getDate()).toBe(1);
    expect(yearly.end.getTime()).toBeGreaterThan(yearly.start.getTime());
  });
});
