import { AsyncLocalStorage } from "node:async_hooks";
import { ENV } from "./env";
import { getDb } from "../db";
import { llmInvocationLogs } from "../../drizzle/schema";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  /** Modelo específico a usar (opcional). */
  model?: string;
  /** Sobrescrita interna para workers que não passam por tRPC. */
  operation?: string;
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ProviderUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: ProviderUsage;
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

export type LlmInvocationContext = {
  userId?: number | null;
  organizationId?: number | null;
  requestId?: string | null;
  operation?: string | null;
};

const llmContextStorage = new AsyncLocalStorage<LlmInvocationContext>();

export function runWithLlmContext<T>(
  context: LlmInvocationContext,
  callback: () => T,
): T {
  return llmContextStorage.run(context, callback);
}

export function getLlmInvocationContext(): LlmInvocationContext | undefined {
  return llmContextStorage.getStore();
}

export type LlmPricingRate = {
  inputPer1M: number;
  outputPer1M: number;
  version: string;
};

type LlmPricingCatalog = Record<string, Record<string, Partial<LlmPricingRate>>>;

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * The catalog is deliberately opt-in. No commercial price is embedded here.
 * Expected shape: { "provider": { "model": { inputPer1M, outputPer1M, version } } }.
 */
export function parseLlmPricingCatalog(raw = process.env.LLM_PRICING_JSON): LlmPricingCatalog {
  if (!raw?.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as LlmPricingCatalog;
  } catch {
    return {};
  }
}

export function estimateLlmCost(
  provider: string,
  model: string,
  usage: ProviderUsage | undefined,
  rawCatalog = process.env.LLM_PRICING_JSON,
): { amount: number; version: string } | null {
  if (!usage) return null;
  const rate = parseLlmPricingCatalog(rawCatalog)?.[provider]?.[model];
  if (!rate || !finiteNonNegative(rate.inputPer1M) || !finiteNonNegative(rate.outputPer1M) || typeof rate.version !== "string" || !rate.version.trim()) {
    return null;
  }
  return {
    amount: usage.prompt_tokens / 1_000_000 * rate.inputPer1M + usage.completion_tokens / 1_000_000 * rate.outputPer1M,
    version: rate.version.slice(0, 128),
  };
}

const ensureArray = (
  value: MessageContent | MessageContent[],
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent,
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") return { type: "text", text: part };
  if (part.type === "text") return part;
  if (part.type === "image_url") return part;
  if (part.type === "file_url") return part;
  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");
    return { role, name, tool_call_id, content };
  }

  const rawParts = ensureArray(message.content).filter(
    (p) => typeof p !== "object" || (p as { type?: string }).type !== "thinking",
  );
  const contentParts = rawParts.map(normalizeContentPart);

  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return { role, name, content: contentParts[0].text };
  }
  return { role, name, content: contentParts };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined,
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;
  if (toolChoice === "none" || toolChoice === "auto") return toolChoice;
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) throw new Error("tool_choice 'required' needs a configured tool");
    if (tools.length > 1) throw new Error("tool_choice 'required' needs one tool or an explicit name");
    return { type: "function", function: { name: tools[0].function.name } };
  }
  if ("name" in toolChoice) return { type: "function", function: { name: toolChoice.name } };
  return toolChoice;
};

type LlmConfig = { url: string; apiKey: string; model: string; provider: string };

function resolveLLMConfig(): LlmConfig {
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureKey = process.env.AZURE_OPENAI_KEY;
  const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o";
  const azureApiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-02-01";
  if (azureEndpoint && azureKey) {
    return {
      url: `${azureEndpoint.replace(/\/$/, "")}/openai/deployments/${azureDeployment}/chat/completions?api-version=${azureApiVersion}`,
      apiKey: azureKey,
      model: azureDeployment,
      provider: "azure_openai",
    };
  }

  const ollamaUrl = process.env.OLLAMA_BASE_URL;
  const ollamaModel = process.env.OLLAMA_MODEL ?? "llama3.1";
  if (ollamaUrl) {
    return { url: `${ollamaUrl.replace(/\/$/, "")}/v1/chat/completions`, apiKey: "ollama", model: ollamaModel, provider: "ollama" };
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL ?? "gpt-4o";
  if (openaiKey) {
    return { url: "https://api.openai.com/v1/chat/completions", apiKey: openaiKey, model: openaiModel, provider: "openai" };
  }

  const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  if (geminiKey) {
    return { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", apiKey: geminiKey, model: geminiModel, provider: "gemini" };
  }

  const forgeUrl = ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";
  return { url: forgeUrl, apiKey: ENV.forgeApiKey ?? "", model: "gemini-2.5-flash", provider: "manus_forge" };
}

class LlmPublicError extends Error {
  constructor(public readonly kind: string, message: string) {
    super(message);
    this.name = "LlmPublicError";
  }
}

function publicError(kind: string, status?: number): LlmPublicError {
  if (kind === "configuration") return new LlmPublicError(kind, "LLM provider is not configured");
  if (kind === "provider_http" && typeof status === "number") return new LlmPublicError(kind, `LLM provider request failed (${status})`);
  return new LlmPublicError(kind, "LLM provider request failed");
}

function bounded(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.slice(0, max);
}

function providerRequestId(response: Response, body?: unknown): string | null {
  const headerId = response.headers?.get("x-request-id") ?? response.headers?.get("request-id") ?? response.headers?.get("x-ms-request-id");
  if (headerId) return bounded(headerId, 256);
  if (body && typeof body === "object" && typeof (body as { id?: unknown }).id === "string") {
    return bounded((body as { id: string }).id, 256);
  }
  return null;
}

function providerUsage(value: unknown): ProviderUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const usage = (value as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") return undefined;
  const candidate = usage as Record<string, unknown>;
  if (!finiteNonNegative(candidate.prompt_tokens) || !finiteNonNegative(candidate.completion_tokens) || !finiteNonNegative(candidate.total_tokens)) return undefined;
  return {
    prompt_tokens: candidate.prompt_tokens,
    completion_tokens: candidate.completion_tokens,
    total_tokens: candidate.total_tokens,
  };
}

function errorClass(error: unknown): string {
  return error instanceof LlmPublicError ? error.kind : "invocation_error";
}

type LedgerWrite = {
  context: LlmInvocationContext | undefined;
  operation: string;
  provider: string;
  model: string;
  status: "success" | "failure";
  providerRequestId?: string | null;
  usage?: ProviderUsage;
  latencyMs: number;
  errorClass?: string;
};

async function persistLlmInvocation(entry: LedgerWrite): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const estimated = entry.usage ? estimateLlmCost(entry.provider, entry.model, entry.usage) : null;
    await db.insert(llmInvocationLogs).values({
      organizationId: entry.context?.organizationId ?? null,
      userId: entry.context?.userId ?? null,
      operation: bounded(entry.operation, 128) ?? "llm.invoke",
      provider: bounded(entry.provider, 64) ?? "unknown",
      model: bounded(entry.model, 256) ?? "unknown",
      requestId: bounded(entry.context?.requestId, 128),
      providerRequestId: bounded(entry.providerRequestId, 256),
      status: entry.status,
      inputTokens: entry.usage?.prompt_tokens ?? null,
      outputTokens: entry.usage?.completion_tokens ?? null,
      tokenSource: entry.usage ? "provider_reported" : "unknown",
      estimatedCostUsd: estimated?.amount.toFixed(8) ?? null,
      billedCostUsd: null,
      currency: "USD",
      costProvenance: estimated ? "pricing_catalog_estimate" : "not_available",
      pricingVersion: estimated?.version ?? null,
      latencyMs: Math.max(0, Math.round(entry.latencyMs)),
      errorClass: entry.status === "failure" ? bounded(entry.errorClass, 128) : null,
    });
  } catch {
    // Observabilidade nunca pode transformar uma resposta LLM válida em erro.
    console.warn("[LLM telemetry] write failed", { errorClass: "telemetry_write_error" });
  }
}

function record(entry: LedgerWrite): void {
  void persistLlmInvocation(entry);
}

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}): ResponseFormat | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error("responseFormat json_schema requires a schema");
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return undefined;
  if (!schema.name || !schema.schema) throw new Error("outputSchema requires name and schema");
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const startedAt = Date.now();
  const config = resolveLLMConfig();
  const effectiveModel = params.model ?? config.model;
  const context = getLlmInvocationContext();
  const operation = params.operation ?? context?.operation ?? "llm.invoke";
  let providerId: string | null = null;

  try {
    if (!config.apiKey && !config.url.includes("ollama")) {
      throw publicError("configuration");
    }

    const payload: Record<string, unknown> = {
      model: effectiveModel,
      messages: params.messages.map(normalizeMessage),
    };
    if (params.tools && params.tools.length > 0) payload.tools = params.tools;
    const normalizedToolChoice = normalizeToolChoice(params.toolChoice || params.tool_choice, params.tools);
    if (normalizedToolChoice) payload.tool_choice = normalizedToolChoice;
    payload.max_tokens = params.maxTokens ?? params.max_tokens ?? 4096;
    const normalizedResponseFormat = normalizeResponseFormat(params);
    if (normalizedResponseFormat) payload.response_format = normalizedResponseFormat;

    let response: Response;
    try {
      response = await fetch(config.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      throw publicError("network_error");
    }

    if (!response.ok) {
      providerId = providerRequestId(response);
      throw publicError("provider_http", response.status);
    }

    let rawBody: unknown;
    try {
      rawBody = await response.json();
    } catch {
      providerId = providerRequestId(response);
      throw publicError("invalid_provider_response");
    }
    providerId = providerRequestId(response, rawBody);
    if (!rawBody || typeof rawBody !== "object") throw publicError("invalid_provider_response");

    const result = rawBody as InvokeResult;
    const usage = providerUsage(rawBody);
    const sanitizedResult = usage
      ? { ...result, usage }
      : (() => {
          const { usage: _usage, ...withoutUsage } = result;
          return withoutUsage as InvokeResult;
        })();

    record({
      context,
      operation,
      provider: config.provider,
      model: typeof result.model === "string" && result.model ? result.model : effectiveModel,
      status: "success",
      providerRequestId: providerId,
      usage,
      latencyMs: Date.now() - startedAt,
    });
    return sanitizedResult;
  } catch (error) {
    const safeError = error instanceof LlmPublicError ? error : publicError(errorClass(error));
    record({
      context,
      operation,
      provider: config.provider,
      model: effectiveModel,
      status: "failure",
      providerRequestId: providerId,
      latencyMs: Date.now() - startedAt,
      errorClass: safeError.kind,
    });
    throw safeError;
  }
}
