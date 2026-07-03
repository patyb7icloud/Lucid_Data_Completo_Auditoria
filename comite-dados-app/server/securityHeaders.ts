/**
 * Security Headers Middleware
 * Implementa headers HTTP de segurança equivalentes ao Helmet.js (sem dependência externa).
 * Protege contra: XSS, Clickjacking, MIME sniffing, CORS injection, information disclosure.
 */
import { Request, Response, NextFunction } from "express";
import { getRateLimitStore } from "./rateLimitStore";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Middleware principal de security headers.
 * Aplica todos os headers recomendados pela OWASP / Content Security Policy Level 3.
 */
export function securityHeaders() {
  return function (req: Request, res: Response, next: NextFunction) {
    // ── Content-Security-Policy ──────────────────────────────────────────────
    // Em dev, permite 'unsafe-eval' e localhost para HMR do Vite.
    const cspDirectives = [
      "default-src 'self'",
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'",  // inline necessário para React bundled
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",       // blob/https para uploads e logos
      "connect-src 'self' " + (isDev ? "ws://localhost:* http://localhost:*" : ""),
      "frame-ancestors 'none'",                   // Bloqueia clickjacking
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].filter(Boolean).join("; ");

    res.setHeader("Content-Security-Policy", cspDirectives);

    // ── Anti-clickjacking ────────────────────────────────────────────────────
    res.setHeader("X-Frame-Options", "DENY");

    // ── MIME sniffing ────────────────────────────────────────────────────────
    res.setHeader("X-Content-Type-Options", "nosniff");

    // ── HSTS (apenas em produção, Caddy faz em dev) ──────────────────────────
    if (!isDev) {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload"
      );
    }

    // ── Referrer Policy ──────────────────────────────────────────────────────
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    // ── Permissions Policy (Feature-Policy moderno) ──────────────────────────
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=()"
    );

    // ── Remove informações do servidor ───────────────────────────────────────
    res.removeHeader("X-Powered-By");

    // ── Cross-Origin policies ────────────────────────────────────────────────
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

    next();
  };
}

/**
 * Rate limit por IP para rotas de autenticação.
 * Usa Redis (se REDIS_URL estiver configurado) ou in-memory como fallback.
 * Bloqueia IPs que façam mais de `maxRequests` tentativas em `windowMs`.
 */
export function authRateLimit(opts: { windowMs?: number; maxRequests?: number } = {}) {
  const windowMs = opts.windowMs ?? 15 * 60 * 1000; // 15 min
  const max = opts.maxRequests ?? 20;                // 20 tentativas

  return async function (req: Request, res: Response, next: NextFunction) {
    const ip = (req.ip ?? req.socket.remoteAddress ?? "unknown").replace(/^::ffff:/, "");
    try {
      const store = await getRateLimitStore();
      const { count, ttlMs } = await store.increment(ip, windowMs);

      if (count > max) {
        const retryAfterSec = Math.ceil(ttlMs / 1000);
        res.setHeader("Retry-After", String(retryAfterSec));
        res.status(429).json({
          error: "TooManyRequests",
          message: `Muitas tentativas. Tente novamente em ${retryAfterSec}s.`,
        });
        return;
      }
      next();
    } catch {
      // Falha no store não deve bloquear o login — fail-open com log
      console.warn("[RateLimit] Erro ao verificar rate limit, ignorando.");
      next();
    }
  };
}
