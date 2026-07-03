import { z } from "zod";

// Cache em memória (em produção seria Redis/Memcached)
const queryCache = new Map<string, { result: string, timestamp: number }>();
const rateLimits = new Map<string, { count: number, resetAt: number }>();

const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 horas
const RATE_LIMIT_COPILOT = 10; // max 10 perguntas por hora
const RATE_LIMIT_WINDOW = 1000 * 60 * 60; // 1 hora

export interface AIControlConfig {
  userId: string;
  tenantId: string;
  action: "copilot" | "self_healing" | "secops";
  cacheKey?: string;
}

/**
 * Verifica se a requisição está dentro do limite (Rate Limiting)
 */
export function checkRateLimit(config: AIControlConfig): { allowed: boolean; remaining: number; resetInMinutes: number } {
  const key = `${config.tenantId}:${config.userId}:${config.action}`;
  const now = Date.now();
  
  let limitData = rateLimits.get(key);
  
  // Se não existe ou expirou a janela, reseta
  if (!limitData || now > limitData.resetAt) {
    limitData = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
    rateLimits.set(key, limitData);
  }
  
  // Limites por ação
  let maxCalls = 100; // default alto
  if (config.action === "copilot") maxCalls = RATE_LIMIT_COPILOT;
  if (config.action === "self_healing") maxCalls = 50; // max 50 tabelas/hora
  
  if (limitData.count >= maxCalls) {
    return {
      allowed: false,
      remaining: 0,
      resetInMinutes: Math.ceil((limitData.resetAt - now) / 60000)
    };
  }
  
  return {
    allowed: true,
    remaining: maxCalls - limitData.count,
    resetInMinutes: Math.ceil((limitData.resetAt - now) / 60000)
  };
}

/**
 * Incrementa o contador após chamada bem sucedida
 */
export function incrementUsage(config: AIControlConfig) {
  const key = `${config.tenantId}:${config.userId}:${config.action}`;
  const limitData = rateLimits.get(key);
  if (limitData) {
    limitData.count += 1;
    rateLimits.set(key, limitData);
  }
}

/**
 * Tenta buscar resposta do cache (Semantic Caching)
 */
export function getFromCache(cacheKey: string): string | null {
  const cached = queryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }
  return null;
}

/**
 * Salva resposta no cache
 */
export function saveToCache(cacheKey: string, result: string) {
  queryCache.set(cacheKey, {
    result,
    timestamp: Date.now()
  });
}

/**
 * Otimiza/Trunca o contexto para reduzir custo de tokens
 * @param data Array de dados (ex: amostra do Databricks)
 * @param maxItems Máximo de itens a enviar pro LLM
 */
export function truncateContext(data: any[], maxItems: number = 3): any[] {
  if (!data || !Array.isArray(data)) return [];
  return data.slice(0, maxItems);
}

/**
 * Define qual modelo usar baseado na complexidade/custo
 */
export function getOptimizedModel(action: string): { model: string; temperature: number } {
  // SecOps é background/repetitivo, usa modelo mais barato
  if (action === "secops") {
    return { model: "claude-haiku-4-5", temperature: 0.1 };
  }
  
  // Copilot de leitura simples pode usar modelo eficiente
  if (action === "copilot_read") {
    return { model: "claude-haiku-4-5", temperature: 0.1 };
  }
  
  // Self-Healing e Copilot de Escrita (geração de políticas) exigem mais raciocínio
  return { model: "claude-sonnet-4-6", temperature: 0.2 };
}
