import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  values: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("../db", () => ({ getDb: mocks.getDb }));

import { invokeLLM, runWithLlmContext } from "./llm";

const providerResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-request-id": "provider-req-1" },
  });

const db = () => ({ insert: mocks.insert });

async function flushTelemetry() {
  await vi.waitFor(() => expect(mocks.values).toHaveBeenCalled());
}

describe("invokeLLM telemetry", () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-only-key";
    process.env.OPENAI_MODEL = "test-model";
    delete process.env.LLM_PRICING_JSON;
    mocks.getDb.mockResolvedValue(db());
    mocks.insert.mockReturnValue({ values: mocks.values });
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
  });

  it("persiste tokens provider-reported e contexto sem conteúdo", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(providerResponse({
      id: "completion-1",
      created: 1,
      model: "test-model-effective",
      choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
    }));

    const result = await runWithLlmContext(
      { userId: 42, organizationId: 9, requestId: "req-1", operation: "aiGateway.chat" },
      () => invokeLLM({ messages: [{ role: "user", content: "não registrar este texto" }] }),
    );
    await flushTelemetry();

    expect(result.usage).toEqual({ prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 });
    const ledger = mocks.values.mock.calls[0][0];
    expect(ledger).toMatchObject({
      organizationId: 9,
      userId: 42,
      operation: "aiGateway.chat",
      provider: "openai",
      model: "test-model-effective",
      requestId: "req-1",
      providerRequestId: "provider-req-1",
      status: "success",
      inputTokens: 11,
      outputTokens: 7,
      tokenSource: "provider_reported",
      billedCostUsd: null,
    });
    expect(JSON.stringify(ledger)).not.toContain("não registrar este texto");
  });

  it("sanitiza erro do provider e não inclui corpo bruto", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(providerResponse({ error: "secret-provider-body" }, 502));

    await expect(invokeLLM({ messages: [{ role: "user", content: "private prompt" }] }))
      .rejects.toThrow("LLM provider request failed (502)");
    await flushTelemetry();

    expect(mocks.values.mock.calls[0][0]).toMatchObject({ status: "failure", errorClass: "provider_http" });
    expect(JSON.stringify(mocks.values.mock.calls[0][0])).not.toContain("secret-provider-body");
  });

  it("não derruba a resposta quando a escrita de telemetria falha", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(providerResponse({
      id: "completion-2",
      created: 1,
      model: "test-model",
      choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
    }));
    mocks.values.mockRejectedValueOnce(new Error("database failure"));

    await expect(invokeLLM({ messages: [{ role: "user", content: "safe" }] })).resolves.toMatchObject({ id: "completion-2" });
  });

  it("calcula estimativa somente com catálogo configurado; sem rate fica indisponível", async () => {
    process.env.LLM_PRICING_JSON = JSON.stringify({ openai: { "test-model": { inputPer1M: 2, outputPer1M: 4, version: "catalog-test" } } });
    vi.mocked(globalThis.fetch).mockResolvedValue(providerResponse({
      id: "completion-3",
      created: 1,
      model: "test-model",
      choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1_000_000, completion_tokens: 500_000, total_tokens: 1_500_000 },
    }));

    await invokeLLM({ messages: [{ role: "user", content: "safe" }] });
    await flushTelemetry();
    expect(mocks.values.mock.calls[0][0]).toMatchObject({
      estimatedCostUsd: "4.00000000",
      costProvenance: "pricing_catalog_estimate",
      pricingVersion: "catalog-test",
    });

    vi.clearAllMocks();
    mocks.insert.mockReturnValue({ values: mocks.values });
    delete process.env.LLM_PRICING_JSON;
    vi.mocked(globalThis.fetch).mockResolvedValue(providerResponse({
      id: "completion-4",
      created: 1,
      model: "test-model",
      choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
    }));
    const withoutUsage = await invokeLLM({ messages: [{ role: "user", content: "safe" }] });
    await flushTelemetry();
    expect(withoutUsage.usage).toBeUndefined();
    expect(mocks.values.mock.calls[0][0]).toMatchObject({
      inputTokens: null,
      outputTokens: null,
      tokenSource: "unknown",
      estimatedCostUsd: null,
      costProvenance: "not_available",
      pricingVersion: null,
      billedCostUsd: null,
    });
  });
});
