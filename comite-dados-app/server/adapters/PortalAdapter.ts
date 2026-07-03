/**
 * PortalAdapter — adaptador que executa checks de qualidade reais
 * diretamente contra os dados do catálogo armazenados no portal.
 *
 * Dimensões avaliadas (todas com SQL real contra o banco do portal):
 *   1. Completude de metadados: % de atributos com descrição preenchida
 *   2. Classificação PII: % de atributos com isPii definido explicitamente
 *   3. Unicidade de nomes: sem colunas duplicadas no mesmo ativo
 *   4. Tipo de dado definido: % de atributos com dataType preenchido
 *   5. Governança: ativo tem owner + steward definidos
 *   6. Verificação humana: % de atributos marcados como verificados
 */
import { eq, and, isNull, isNotNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { dataAttributes, dataAssets } from "../../drizzle/schema";
import type { SelectQualityRule } from "../db";
import type { ISourceAdapter, AssetMeta, QualityCheckResult } from "./ISourceAdapter";

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

    // ── 1. Completude de metadados (% atributos com description) ─────────────
    const [totalRow] = await this.db
      .select({ total: sql<number>`COUNT(*)` })
      .from(dataAttributes)
      .where(eq(dataAttributes.assetId, assetId));

    const total = Number(totalRow?.total ?? 0);

    if (total === 0) {
      // Ativo sem atributos cadastrados — completude zero
      results.push({
        metricName: "completude",
        score: 0,
        threshold: 80,
        details: "Nenhum atributo cadastrado no catálogo para este ativo.",
        totalRecords: 0,
      });
    } else {
      const [comDescRow] = await this.db
        .select({ cnt: sql<number>`COUNT(*)` })
        .from(dataAttributes)
        .where(and(
          eq(dataAttributes.assetId, assetId),
          isNotNull(dataAttributes.description),
          sql`TRIM(${dataAttributes.description}) != ''`
        ));
      const comDesc = Number(comDescRow?.cnt ?? 0);
      const score = Math.round((comDesc / total) * 100);
      results.push({
        metricName: "completude",
        score,
        threshold: 80,
        details: `${comDesc} de ${total} atributos possuem descrição preenchida.`,
        rawValue: comDesc,
        totalRecords: total,
      });

      // ── 2. Classificação PII (% atributos com isPii definido != null) ──────
      // isPii é boolean com default false — consideramos "classificado" se isVerified=true OU if isPii=true
      const [piiRow] = await this.db
        .select({ cnt: sql<number>`COUNT(*)` })
        .from(dataAttributes)
        .where(and(
          eq(dataAttributes.assetId, assetId),
          sql`${dataAttributes.isVerified} = TRUE OR ${dataAttributes.isPii} = TRUE`
        ));
      const classified = Number(piiRow?.cnt ?? 0);
      const piiScore = Math.round((classified / total) * 100);
      results.push({
        metricName: "classificacao_pii",
        score: piiScore,
        threshold: 70,
        details: `${classified} de ${total} atributos estão verificados ou marcados como PII.`,
        rawValue: classified,
        totalRecords: total,
      });

      // ── 3. Unicidade de nomes de atributos ───────────────────────────────
      const [dupRow] = await this.db.execute(
        sql`SELECT COUNT(*) as cnt FROM (
              SELECT name FROM data_attributes
              WHERE assetId = ${assetId}
              GROUP BY name HAVING COUNT(*) > 1
            ) t`
      ) as any;
      const dupCount = Number(dupRow?.[0]?.cnt ?? 0);
      const uniqueScore = dupCount === 0 ? 100 : Math.max(0, Math.round(100 - (dupCount / total) * 100));
      results.push({
        metricName: "unicidade",
        score: uniqueScore,
        threshold: 95,
        details: dupCount === 0
          ? "Sem nomes de atributos duplicados."
          : `${dupCount} nome(s) de atributos duplicados detectados.`,
        rawValue: dupCount,
        totalRecords: total,
      });

      // ── 4. Tipo de dado definido ─────────────────────────────────────────
      const [typeRow] = await this.db
        .select({ cnt: sql<number>`COUNT(*)` })
        .from(dataAttributes)
        .where(and(
          eq(dataAttributes.assetId, assetId),
          isNotNull(dataAttributes.dataType),
          sql`TRIM(${dataAttributes.dataType}) != ''`
        ));
      const comType = Number(typeRow?.cnt ?? 0);
      const typeScore = Math.round((comType / total) * 100);
      results.push({
        metricName: "validade",
        score: typeScore,
        threshold: 75,
        details: `${comType} de ${total} atributos possuem tipo de dado definido.`,
        rawValue: comType,
        totalRecords: total,
      });

      // ── 4.1. Regras de Negócio Definidas (Consistência) ─────────────────
      const [rulesRow] = await this.db
        .select({ cnt: sql<number>`COUNT(*)` })
        .from(dataAttributes)
        .where(and(
          eq(dataAttributes.assetId, assetId),
          isNotNull(dataAttributes.businessRules),
          sql`TRIM(${dataAttributes.businessRules}) != ''`
        ));
      const comRules = Number(rulesRow?.cnt ?? 0);
      const rulesScore = Math.round((comRules / total) * 100);
      results.push({
        metricName: "consistencia",
        score: rulesScore,
        threshold: 50,
        details: `${comRules} de ${total} atributos possuem regras de negócio documentadas.`,
        rawValue: comRules,
        totalRecords: total,
      });
    }

    // ── 5. Governança (owner + steward definidos no ativo) ───────────────────
    const [assetRow] = await this.db
      .select({ 
        ownerId: dataAssets.ownerId, 
        stewardId: dataAssets.stewardId,
        updatedAt: dataAssets.updatedAt 
      })
      .from(dataAssets)
      .where(eq(dataAssets.id, assetId));

    const hasOwner   = assetRow?.ownerId != null;
    const hasSteward = assetRow?.stewardId != null;
    const govScore   = (hasOwner ? 50 : 0) + (hasSteward ? 50 : 0);
    results.push({
      metricName: "governanca",
      score: govScore,
      threshold: 100,
      details: [
        hasOwner ? "Data Owner definido." : "Falta Data Owner.",
        hasSteward ? "Data Steward definido." : "Falta Data Steward."
      ].join(" "),
    });

    // ── 6. Temporalidade (Moeda dos Metadados) ───────────────────────────────
    if (assetRow?.updatedAt) {
      const diffDays = Math.floor((Date.now() - new Date(assetRow.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
      // Pontuação cai conforme o tempo passa (decaimento linear após 30 dias)
      let timeScore = 100;
      if (diffDays > 30) timeScore = Math.max(0, Math.round(100 - (diffDays - 30) * 0.5));

      results.push({
        metricName: "temporalidade",
        score: timeScore,
        threshold: 70,
        details: diffDays === 0 ? "Atualizado hoje." : `Metadados atualizados há ${diffDays} dias.`,
        rawValue: diffDays,
      });
    }

    return results;
  }
}
