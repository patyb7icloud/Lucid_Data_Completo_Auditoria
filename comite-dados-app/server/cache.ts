/**
 * cache.ts
 * Cache em dois níveis:
 *   1. Redis (via ioredis) — quando REDIS_URL estiver configurado no .env
 *   2. Map em memória — fallback automático sem Redis (ideal para dev local)
 *
 * Instalar Redis: npm install ioredis @types/ioredis
 * Configurar: REDIS_URL=redis://127.0.0.1:6379 no .env
 *
 * Uso:
 *   import { cache } from "./cache";
 *   await cache.get("key");
 *   await cache.set("key", value, 300); // TTL em segundos
 *   await cache.del("key");
 *   await cache.flush("prefix:"); // limpa todas as chaves com prefixo
 */
import { logger } from "./_core/logger";

type CacheValue = string;

interface CacheAdapter {
  get(key: string): Promise<CacheValue | null>;
  set(key: string, value: CacheValue, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  keys(pattern: string): Promise<string[]>;
}

// ─── Adaptador Redis ─────────────────────────────────────────────────────────
class RedisAdapter implements CacheAdapter {
  private client: any;

  constructor(client: any) {
    this.client = client;
  }

  async get(key: string) {
    return this.client.get(key);
  }

  async set(key: string, value: CacheValue, ttl?: number) {
    if (ttl) {
      await this.client.setex(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string) {
    await this.client.del(key);
  }

  async keys(pattern: string) {
    return this.client.keys(pattern);
  }
}

// ─── Adaptador em memória ─────────────────────────────────────────────────────
class MemoryAdapter implements CacheAdapter {
  private store = new Map<string, { value: CacheValue; expiresAt: number | null }>();

  private prune() {
    const now = Date.now();
    for (const [k, v] of this.store.entries()) {
      if (v.expiresAt !== null && v.expiresAt < now) this.store.delete(k);
    }
  }

  async get(key: string) {
    this.prune();
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: CacheValue, ttl?: number) {
    this.store.set(key, { value, expiresAt: ttl ? Date.now() + ttl * 1000 : null });
  }

  async del(key: string) {
    this.store.delete(key);
  }

  async keys(pattern: string) {
    this.prune();
    // Converte glob simples (* e ?) para RegExp
    const re = new RegExp("^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
    return Array.from(this.store.keys()).filter((k) => re.test(k));
  }
}

// ─── Fachada principal ────────────────────────────────────────────────────────
class Cache {
  private adapter: CacheAdapter | null = null;
  private initPromise: Promise<void> | null = null;
  private isRedis = false;

  private async init() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        const { default: Redis } = await import("ioredis");
        const client = new Redis(redisUrl, { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1 });
        await client.connect();
        await client.ping();
        this.adapter = new RedisAdapter(client);
        this.isRedis = true;
        logger.info("cache.redis_connected", { url: redisUrl.replace(/\/\/[^@]+@/, "//***@") });
      } catch (err) {
        logger.warn("cache.redis_unavailable", { error: String(err) });
        this.adapter = new MemoryAdapter();
      }
    } else {
      this.adapter = new MemoryAdapter();
      logger.info("cache.memory_mode", { hint: "Defina REDIS_URL para usar Redis em produção" });
    }
  }

  private async getAdapter(): Promise<CacheAdapter> {
    if (!this.initPromise) {
      this.initPromise = this.init();
    }
    await this.initPromise;
    return this.adapter!;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const adapter = await this.getAdapter();
    const raw = await adapter.get(key);
    if (raw === null) return null;
    try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const adapter = await this.getAdapter();
    await adapter.set(key, JSON.stringify(value), ttlSeconds);
  }

  async del(key: string): Promise<void> {
    const adapter = await this.getAdapter();
    await adapter.del(key);
  }

  /** Remove todas as chaves que começam com `prefix` */
  async flush(prefix: string): Promise<void> {
    const adapter = await this.getAdapter();
    const keys = await adapter.keys(`${prefix}*`);
    await Promise.all(keys.map((k) => adapter.del(k)));
  }

  /**
   * Wrapper "cache-aside": retorna valor do cache ou executa `fn` e armazena.
   * @param key    chave do cache
   * @param fn     função assíncrona que retorna o valor fresco
   * @param ttl    TTL em segundos (default: 300 = 5 min)
   */
  async wrap<T>(key: string, fn: () => Promise<T>, ttl = 300): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const fresh = await fn();
    await this.set(key, fresh, ttl);
    return fresh;
  }

  get backend() { return this.isRedis ? "redis" : "memory"; }
}

export const cache = new Cache();

// ─── Constantes de TTL convenientes ──────────────────────────────────────────
export const TTL = {
  SHORT:  60,         // 1 min — dados que mudam frequentemente
  MEDIUM: 5 * 60,     // 5 min — listagens padrão
  LONG:   10 * 60,    // 10 min — organizações, planos
  SESSION: 60 * 60,   // 1h — sessões JWT
} as const;
