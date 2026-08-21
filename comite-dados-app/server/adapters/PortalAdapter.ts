import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { dataAttributes, qualityDimensions } from "../../drizzle/schema.js";
import type { QualityRule as SelectQualityRule } from "../../drizzle/schema.js";
import type { ISourceAdapter, AssetMeta, QualityCheckResult } from "./ISourceAdapter.js";
import { RuleEngine } from "./RuleEngine.js";

export class PortalAdapter implements ISourceAdapter {
  readonly name = "portal";
  private db: ReturnType<typeof drizzle>;

  constructor(connectionUrl: string) {
    const pool = new Pool({ connectionString: connectionUrl });
    this.db = drizzle(pool);
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return true;
    } catch {
      return false;
    }
  }

  async runChecks(assetId: number, assetMeta: AssetMeta, rules?: SelectQualityRule[]): Promise<QualityCheckResult[]> {
    const results: QualityCheckResult[] = [];
    
    // Total attributes
    const [totalRow] = await this.db
      .select({ total: sql<number>`COUNT(*)` })
      .from(dataAttributes)
      .where(eq(dataAttributes.assetId, assetId));
    const total = Number(totalRow?.total ?? 0);

    if (total === 0) return results; // No attributes to check
    
    // Fetch dimensions dictionary
    const dims = await this.db.select().from(qualityDimensions);
    const dimMap = new Map(dims.map(d => [d.id, d.name]));

    // Se não houver regras, retornamos vazio para este ativo.
    if (!rules || rules.length === 0) return results;

    for (const rule of rules) {
      if (!rule.isActive) continue;
      
      const dimensionName = dimMap.get(rule.dimensionId) || `dim_${rule.dimensionId}`;
      const conditionSql = RuleEngine.parseExpression(rule.expressionJson);
      
      if (!conditionSql) {
        console.warn(`[PortalAdapter] Regra ignorada por falha de compilação JSON:`, rule.expressionJson);
        continue;
      }

      try {
        const [hitsRow] = await this.db
          .select({ cnt: sql<number>`COUNT(*)` })
          .from(dataAttributes)
          .where(sql`${dataAttributes.assetId} = ${assetId} AND (${conditionSql})`);

        const hits = Number(hitsRow?.cnt ?? 0);
        const score = Math.round((hits / total) * 100);

        results.push({
          metricName: dimensionName,
          score,
          threshold: rule.threshold || 0,
          details: `${hits} de ${total} atributos atendem à regra da dimensão ${dimensionName}.`,
          rawValue: hits,
          totalRecords: total,
        });
      } catch (err: any) {
        console.error(`[PortalAdapter] Erro ao executar regra de ${dimensionName}:`, err.message);
      }
    }

    return results;
  }
}
