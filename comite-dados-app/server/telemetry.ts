/**
 * telemetry.ts
 * Observabilidade: métricas HTTP, latência, contadores de erro.
 * Implementação nativa sem dependências extras (sem necessidade de @opentelemetry).
 *
 * Quando o pacote @opentelemetry/sdk-node estiver instalado, faz auto-instrumentação.
 * Caso contrário, opera em modo "nativo" com métricas em memória exportáveis via /api/metrics.
 *
 * Para ativar OpenTelemetry completo:
 *   npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
 *   npm install @opentelemetry/exporter-prometheus (para Prometheus/Grafana)
 *
 * Variáveis de ambiente:
 *   OTEL_EXPORTER_OTLP_ENDPOINT  — endpoint do coletor OTLP (ex: http://localhost:4318)
 *   OTEL_SERVICE_NAME             — nome do serviço (default: lucid-data-governance-api)
 */
import type { Request, Response, NextFunction } from "express";
import { logger } from "./_core/logger";

// ─── Contadores e histogramas em memória ──────────────────────────────────────
interface MetricBucket {
  count: number;
  sum: number;
  min: number;
  max: number;
  p95: number; // estimativa simples via reservoir sampling
  samples: number[]; // últimos 1000 para cálculo de percentis
}

const httpMetrics = new Map<string, MetricBucket>(); // key: "METHOD /path"
const errorCounter = { total: 0, by5xx: 0, by4xx: 0 };
const appStart = Date.now();

function bucketKey(method: string, path: string): string {
  // Normaliza paths com IDs numéricos: /api/assets/123 → /api/assets/:id
  const normalized = path.replace(/\/\d+/g, "/:id");
  return `${method} ${normalized}`;
}

function updateBucket(key: string, durationMs: number) {
  let b = httpMetrics.get(key);
  if (!b) {
    b = { count: 0, sum: 0, min: Infinity, max: -Infinity, p95: 0, samples: [] };
    httpMetrics.set(key, b);
  }
  b.count++;
  b.sum += durationMs;
  b.min = Math.min(b.min, durationMs);
  b.max = Math.max(b.max, durationMs);
  b.samples.push(durationMs);
  if (b.samples.length > 1000) b.samples.shift(); // reservoir
  // Percentil 95 simplificado
  const sorted = [...b.samples].sort((a, c) => a - c);
  b.p95 = sorted[Math.floor(sorted.length * 0.95)] ?? durationMs;
}

// ─── Middleware de instrumentação HTTP ─────────────────────────────────────────
export function telemetryMiddleware() {
  return function (req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    res.on("finish", () => {
      const dur = Date.now() - start;
      const key = bucketKey(req.method, req.path);
      updateBucket(key, dur);

      if (res.statusCode >= 500) errorCounter.by5xx++;
      else if (res.statusCode >= 400) errorCounter.by4xx++;

      // Log de requisições lentas (> 2s)
      if (dur > 2000) {
        logger.warn("telemetry.slow_request", {
          method: req.method, path: req.path, durationMs: dur, status: res.statusCode,
        });
      }
    });
    next();
  };
}

// ─── Exportador Prometheus (formato text/plain) ───────────────────────────────
export function renderPrometheusMetrics(): string {
  const lines: string[] = [
    `# HELP http_request_duration_ms HTTP request duration in milliseconds`,
    `# TYPE http_request_duration_ms summary`,
  ];

  for (const [key, b] of httpMetrics.entries()) {
    const safeKey = key.replace(/[^a-zA-Z0-9_]/g, "_");
    lines.push(`http_request_duration_ms_count{endpoint="${key}"} ${b.count}`);
    lines.push(`http_request_duration_ms_sum{endpoint="${key}"} ${b.sum.toFixed(0)}`);
    lines.push(`http_request_duration_ms{endpoint="${key}",quantile="0.95"} ${b.p95.toFixed(0)}`);
    lines.push(`http_request_duration_ms_min{endpoint="${key}"} ${b.min.toFixed(0)}`);
    lines.push(`http_request_duration_ms_max{endpoint="${key}"} ${b.max.toFixed(0)}`);
  }

  lines.push(``, `# HELP http_errors_total Total HTTP errors`, `# TYPE http_errors_total counter`);
  lines.push(`http_errors_total{code="4xx"} ${errorCounter.by4xx}`);
  lines.push(`http_errors_total{code="5xx"} ${errorCounter.by5xx}`);

  lines.push(``, `# HELP process_uptime_seconds Process uptime in seconds`, `# TYPE process_uptime_seconds gauge`);
  lines.push(`process_uptime_seconds ${((Date.now() - appStart) / 1000).toFixed(0)}`);

  lines.push(``, `# HELP nodejs_memory_usage_bytes Memory usage in bytes`, `# TYPE nodejs_memory_usage_bytes gauge`);
  const mem = process.memoryUsage();
  lines.push(`nodejs_memory_usage_bytes{type="rss"} ${mem.rss}`);
  lines.push(`nodejs_memory_usage_bytes{type="heapUsed"} ${mem.heapUsed}`);
  lines.push(`nodejs_memory_usage_bytes{type="heapTotal"} ${mem.heapTotal}`);

  return lines.join("\n") + "\n";
}

// ─── Endpoint /api/health (readiness + liveness) ──────────────────────────────
export async function healthCheck(req: Request, res: Response) {
  const start = Date.now();
  const checks: Record<string, { status: "ok" | "error"; latencyMs?: number; detail?: string }> = {};

  // 1. Database
  try {
    const { getDb } = await import("./db");
    const db = await getDb();
    const t0 = Date.now();
    await (db as any).execute("SELECT 1");
    checks.database = { status: "ok", latencyMs: Date.now() - t0 };
  } catch (e) {
    checks.database = { status: "error", detail: String(e) };
  }

  // 2. Cache
  try {
    const { cache } = await import("./cache");
    const t0 = Date.now();
    await cache.set("__healthcheck__", "ok", 5);
    await cache.del("__healthcheck__");
    checks.cache = { status: "ok", latencyMs: Date.now() - t0, detail: cache.backend };
  } catch (e) {
    checks.cache = { status: "error", detail: String(e) };
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok");
  const statusCode = allOk ? 200 : 503;

  res.status(statusCode).json({
    status: allOk ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - appStart) / 1000),
    version: process.env.npm_package_version ?? "unknown",
    checks,
    totalLatencyMs: Date.now() - start,
  });
}

// ─── Tentativa de inicializar OpenTelemetry (se pacote disponível) ─────────────
export async function tryInitOpenTelemetry() {
  const serviceName = process.env.OTEL_SERVICE_NAME ?? "lucid-data-governance-api";
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  try {
    const { NodeSDK } = await import("@opentelemetry/sdk-node");
    const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");

    const sdk = new NodeSDK({
      serviceName,
      instrumentations: [getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-http": { enabled: true },
        "@opentelemetry/instrumentation-express": { enabled: true },
        "@opentelemetry/instrumentation-mysql2": { enabled: true },
      })],
    });

    sdk.start();
    logger.info("telemetry.otel_started", { serviceName, endpoint: endpoint ?? "console" });
  } catch {
    logger.info("telemetry.native_mode", {
      hint: "Instale @opentelemetry/sdk-node para rastreamento distribuído completo.",
    });
  }
}
