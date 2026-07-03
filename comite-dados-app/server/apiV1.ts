/**
 * API REST Pública v1 — Lucid Data Governance
 * Autenticação via API Key (Bearer token)
 * 
 * Endpoints:
 *   GET  /api/v1/assets         — Listar ativos
 *   GET  /api/v1/assets/:id     — Detalhe de ativo
 *   GET  /api/v1/glossary       — Listar glossário
 *   GET  /api/v1/metrics        — Métricas de governança
 *   GET  /api/v1/lgpd/assets    — Ativos com dados sensíveis (LGPD)
 */
import type { Express, Request, Response, NextFunction } from "express";
import * as db from "./db";
import { openApiSpec, swaggerUiHtml } from "./openapi";

// ─── Rate Limiting (in-memory, por IP) ───────────────────────────────────────
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 100;       // requisições por janela
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minuto

function rateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = (req.headers["x-forwarded-for"] as string ?? req.ip ?? "unknown").split(",")[0].trim();
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    res.setHeader("X-RateLimit-Limit", RATE_LIMIT_MAX);
    res.setHeader("X-RateLimit-Remaining", RATE_LIMIT_MAX - 1);
    return next();
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
    return res.status(429).json({ error: "Limite de requisições excedido. Tente novamente em 1 minuto." });
  }
  entry.count++;
  res.setHeader("X-RateLimit-Limit", RATE_LIMIT_MAX);
  res.setHeader("X-RateLimit-Remaining", RATE_LIMIT_MAX - entry.count);
  next();
}

// Limpa entradas expiradas a cada 5 minutos para evitar memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitStore.entries()) {
    if (now > val.resetAt) rateLimitStore.delete(key);
  }
}, 5 * 60_000);

// ─── Middleware de autenticação por API Key ───────────────────────────────────
async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"] ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "API Key obrigatória. Use o header: Authorization: Bearer <chave>" });
  }
  const result = await db.validateApiKey(token);
  if (!result) {
    return res.status(401).json({ error: "API Key inválida ou expirada." });
  }
  (req as any).apiUser = result;
  next();
}

function requireScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const scopes: string[] = (req as any).apiUser?.scopes ?? [];
    if (!scopes.includes(scope) && !scopes.includes("*")) {
      return res.status(403).json({ error: `Permissão insuficiente. Escopo necessário: ${scope}` });
    }
    next();
  };
}

function paginate(req: Request) {
  const limit  = Math.min(parseInt(req.query.limit  as string ?? "50"), 200);
  const offset = parseInt(req.query.offset as string ?? "0");
  return { limit, offset };
}

// ─── Register routes ──────────────────────────────────────────────────────────
export function registerPublicApiV1(app: Express) {
  const base = "/api/v1";

  // ── OpenAPI spec & Swagger UI (públicos, sem autenticação) ────────────────
  app.get(`${base}/openapi.json`, (_req, res) => {
    res.json(openApiSpec);
  });
  app.get(`${base}/docs`, (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(swaggerUiHtml("/api/v1/openapi.json"));
  });

  app.use(base, rateLimit, apiKeyAuth);

  // ── GET /api/v1/assets ────────────────────────────────────────────────────
  app.get(`${base}/assets`, requireScope("assets:read"), async (req, res) => {
    try {
      const { limit, offset } = paginate(req);
      const search      = req.query.search      as string | undefined;
      const domainId    = req.query.domainId    ? parseInt(req.query.domainId as string) : undefined;
      const sensitivity = req.query.sensitivity as string | undefined;
      const criticality = req.query.criticality as string | undefined;
      const type        = req.query.type        as string | undefined;
      const assets = await db.getDataAssets({ search, domainId, sensitivity, criticality, type });
      const page = assets.slice(offset, offset + limit);
      res.json({ data: page, total: assets.length, limit, offset });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/v1/assets/:id ────────────────────────────────────────────────
  app.get(`${base}/assets/:id`, requireScope("assets:read"), async (req, res) => {
    try {
      const asset = await db.getDataAssetById(parseInt(req.params.id));
      if (!asset) return res.status(404).json({ error: "Ativo não encontrado" });
      res.json({ data: asset });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/v1/assets/:id/quality-history ────────────────────────────────
  app.get(`${base}/assets/:id/quality-history`, requireScope("assets:read"), async (req, res) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const history = await db.getDataQualityHistory(parseInt(req.params.id), days);
      res.json({ data: history });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/v1/glossary ──────────────────────────────────────────────────
  app.get(`${base}/glossary`, requireScope("glossary:read"), async (req, res) => {
    try {
      const { limit, offset } = paginate(req);
      const status   = req.query.status   as string | undefined;
      const category = req.query.category as string | undefined;
      const search   = req.query.search   as string | undefined;
      const terms = await db.getGlossaryTerms({ status, category, search });
      res.json({ data: terms.slice(offset, offset + limit), total: terms.length, limit, offset });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/v1/metrics ───────────────────────────────────────────────────
  app.get(`${base}/metrics`, requireScope("metrics:read"), async (req, res) => {
    try {
      const maturity = await db.getMaturityScore();
      res.json({ data: maturity });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/v1/lgpd/assets ───────────────────────────────────────────────
  app.get(`${base}/lgpd/assets`, requireScope("lgpd:read"), async (req, res) => {
    try {
      const assets = await db.getLgpdAssets();
      res.json({ data: assets, total: assets.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/v1/access-requests ───────────────────────────────────────────
  app.get(`${base}/access-requests`, requireScope("access:read"), async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const requests = await db.getAccessRequests({ status });
      res.json({ data: requests, total: requests.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/health (público) ─────────────────────────────────────────────
  app.get("/api/health", async (_req, res) => {
    const start = Date.now();
    let dbOk = false;
    try {
      await db.getDataAssets({ search: undefined });
      dbOk = true;
    } catch { /* db unreachable */ }
    const latencyMs = Date.now() - start;
    const status = dbOk ? "ok" : "degraded";
    res.status(dbOk ? 200 : 503).json({
      status,
      uptime: Math.floor(process.uptime()),
      db: { ok: dbOk, latencyMs },
      version: process.env.npm_package_version ?? "1.0.0",
      env: process.env.NODE_ENV ?? "unknown",
      timestamp: new Date().toISOString(),
    });
  });

  // ── GET /api/prometheus (Prometheus text format, público) ─────────────────
  app.get("/api/prometheus", async (_req, res) => {
    try {
      const [assets, userCount, dsarList, piaList, contracts] = await Promise.all([
        db.getDataAssets({}).catch(() => []),
        db.countUsers().catch(() => 0),
        db.getDsarRequests().catch(() => []),
        db.getPiaAssessments().catch(() => []),
        db.getDataContracts().catch(() => []),
      ]);
      const lines: string[] = [
        "# HELP comite_dados_total_assets Total de ativos de dados cadastrados",
        "# TYPE comite_dados_total_assets gauge",
        `comite_dados_total_assets ${assets.length}`,
        "# HELP comite_dados_total_users Total de usuários",
        "# TYPE comite_dados_total_users gauge",
        `comite_dados_total_users ${userCount}`,
        "# HELP comite_dados_dsar_open Solicitações DSAR em aberto",
        "# TYPE comite_dados_dsar_open gauge",
        `comite_dados_dsar_open ${(dsarList as any[]).filter((r) => r.status === "aberto").length}`,
        "# HELP comite_dados_pia_total Total de avaliações PIA",
        "# TYPE comite_dados_pia_total gauge",
        `comite_dados_pia_total ${piaList.length}`,
        "# HELP comite_dados_contracts_active Contratos de dados ativos",
        "# TYPE comite_dados_contracts_active gauge",
        `comite_dados_contracts_active ${(contracts as any[]).filter((c) => c.status === "ativo").length}`,
        "# HELP comite_dados_uptime_seconds Tempo de atividade do servidor",
        "# TYPE comite_dados_uptime_seconds counter",
        `comite_dados_uptime_seconds ${Math.floor(process.uptime())}`,
      ];
      res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
      res.send(lines.join("\n") + "\n");
    } catch (e: any) {
      res.status(500).send(`# error: ${e.message}\n`);
    }
  });

  console.log("[API v1] REST API registrada em /api/v1");
}
