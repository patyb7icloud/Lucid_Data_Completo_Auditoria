/**
 * rateLimitStore.ts
 * Store pluggável para rate limiting de autenticação.
 *
 * Estratégia:
 *   1. Se REDIS_URL estiver configurado, tenta usar Redis (ioredis) via dynamic import.
 *   2. Se ioredis não estiver instalado ou Redis estiver indisponível, cai no
 *      fallback in-memory (Map) com log de aviso na inicialização.
 *
 * O Redis garante persistência de contadores entre reinicializações e
 * funcionamento correto em ambientes multi-instância (horizontal scaling).
 *
 * Interface:
 *   increment(key, windowMs)  → retorna { count, ttlMs }
 *   reset(key)                → zera o contador (ex: após login bem-sucedido)
 */

type IncrementResult = { count: number; ttlMs: number };

export interface IRateLimitStore {
  increment(key: string, windowMs: number): Promise<IncrementResult>;
  reset(key: string): Promise<void>;
}

// ─── Implementação In-Memory (fallback) ──────────────────────────────────────

class InMemoryRateLimitStore implements IRateLimitStore {
  private readonly map = new Map<string, { count: number; resetAt: number }>();

  async increment(key: string, windowMs: number): Promise<IncrementResult> {
    const now = Date.now();
    const existing = this.map.get(key);

    if (!existing || existing.resetAt <= now) {
      const resetAt = now + windowMs;
      this.map.set(key, { count: 1, resetAt });
      return { count: 1, ttlMs: windowMs };
    }

    existing.count++;
    return { count: existing.count, ttlMs: existing.resetAt - now };
  }

  async reset(key: string): Promise<void> {
    this.map.delete(key);
  }
}

// ─── Implementação Redis (ioredis — optional) ─────────────────────────────────

class RedisRateLimitStore implements IRateLimitStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;

  constructor(redisClient: unknown) {
    this.client = redisClient;
  }

  async increment(key: string, windowMs: number): Promise<IncrementResult> {
    const redisKey = `ratelimit:${key}`;
    const windowSec = Math.ceil(windowMs / 1000);

    // Pipeline atômico: INCR + EXPIRE
    const pipeline = this.client.pipeline();
    pipeline.incr(redisKey);
    pipeline.pttl(redisKey);
    const [[, count], [, pttl]] = await pipeline.exec();

    // Define TTL apenas na primeira vez (quando pttl = -1 = sem expiração)
    if (pttl === -1) {
      await this.client.expire(redisKey, windowSec);
      return { count: count as number, ttlMs: windowMs };
    }

    return { count: count as number, ttlMs: pttl as number };
  }

  async reset(key: string): Promise<void> {
    await this.client.del(`ratelimit:${key}`);
  }
}

// ─── Factory — inicializa o store correto ─────────────────────────────────────

let _store: IRateLimitStore | null = null;

export async function getRateLimitStore(): Promise<IRateLimitStore> {
  if (_store) return _store;

  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      // Dynamic import: graceful degradation se ioredis não estiver instalado
      const { default: Redis } = await import("ioredis") as { default: new (url: string) => unknown };
      const client = new Redis(redisUrl);

      // Teste rápido de conectividade
      await (client as { ping: () => Promise<string> }).ping();

      _store = new RedisRateLimitStore(client);
      console.log("[RateLimit] Usando Redis como store de rate limiting");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[RateLimit] Redis configurado (REDIS_URL=${redisUrl}) mas não disponível: ${msg}. ` +
          "Usando store in-memory como fallback."
      );
      _store = new InMemoryRateLimitStore();
    }
  } else {
    _store = new InMemoryRateLimitStore();
  }

  return _store;
}

/** Reseta o singleton (útil em testes). */
export function resetRateLimitStore(): void {
  _store = null;
}
