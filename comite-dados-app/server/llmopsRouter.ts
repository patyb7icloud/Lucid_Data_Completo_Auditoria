/**
 * llmopsRouter.ts
 * Módulo 2: LLMOps & GenAI Risk — Agentes GenAI, Herança de Permissões, Mapeamento MIP→Databricks
 * Endereça: R20 (taxonomia MIP/DLP), R22 (schemas ML DEV), R24 (agentes GenAI sem governança)
 */
import { z } from "zod";
import { eq, desc, and, like, or } from "drizzle-orm";
import { getDb } from "./db";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  genaiAgents,
  mipDatabricksMapping,
  type InsertGenaiAgent,
  type InsertMipDatabricksMapping,
} from "../drizzle/schema";

// ─── Schemas de validação ─────────────────────────────────────────────────────
const insertAgentSchema = z.object({
  name:                z.string().min(1).max(256),
  description:         z.string().optional(),
  agentType:           z.string().optional(),
  llmProvider:         z.string().optional(),
  llmModel:            z.string().optional(),
  status:              z.enum(["producao", "staging", "desenvolvimento", "descontinuado"]).default("desenvolvimento"),
  riskLevel:           z.enum(["critico", "alto", "medio", "baixo"]).default("medio"),
  aiOwnerName:         z.string().optional(),
  domainId:            z.number().optional(),
  domainName:          z.string().optional(),
  dataSourcesJson:     z.string().optional(),
  permissionsInherited: z.boolean().default(false),
  promptInjectionRisk: z.string().optional(),
  dataLeakageRisk:     z.string().optional(),
  piiExposed:          z.boolean().default(false),
  ragSourcesCount:     z.number().default(0),
  linkedSystemId:      z.number().optional(),
  mipClassification:   z.string().optional(),
  databricksTag:       z.string().optional(),
  notes:               z.string().optional(),
});

const insertMipMappingSchema = z.object({
  mipLevel:      z.string().min(1),
  mipCode:       z.string().min(1).max(16),
  databricksTag: z.string().min(1),
  dlpAction:     z.string().optional(),
  description:   z.string().optional(),
});

// ─── Router ───────────────────────────────────────────────────────────────────
export const llmopsRouter = router({

  // ── Agentes GenAI ──────────────────────────────────────────────────────────

  listAgents: publicProcedure
    .input(z.object({
      status:    z.enum(["producao", "staging", "desenvolvimento", "descontinuado"]).optional(),
      riskLevel: z.enum(["critico", "alto", "medio", "baixo"]).optional(),
      search:    z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions: any[] = [];
      if (input?.status)    conditions.push(eq(genaiAgents.status, input.status));
      if (input?.riskLevel) conditions.push(eq(genaiAgents.riskLevel, input.riskLevel));
      if (input?.search) {
        conditions.push(or(
          like(genaiAgents.name, `%${input.search}%`),
          like(genaiAgents.description, `%${input.search}%`),
        ));
      }
      return db
        .select()
        .from(genaiAgents)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(genaiAgents.updatedAt));
    }),

  getAgentById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [agent] = await db.select().from(genaiAgents).where(eq(genaiAgents.id, input.id));
      return agent ?? null;
    }),

  createAgent: protectedProcedure
    .input(insertAgentSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const payload: InsertGenaiAgent = {
        ...input,
        createdById:   ctx.user?.id,
        createdByName: ctx.user?.name ?? undefined,
      };
      const [created] = await db.insert(genaiAgents).values(payload).returning();
      return created;
    }),

  updateAgent: protectedProcedure
    .input(z.object({ id: z.number(), data: insertAgentSchema.partial() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [updated] = await db
        .update(genaiAgents)
        .set({ ...input.data, updatedAt: new Date() })
        .where(eq(genaiAgents.id, input.id))
        .returning();
      return updated;
    }),

  // Aplicar herança de permissões do catálogo ao agente (R24)
  applyPermissionInheritance: protectedProcedure
    .input(z.object({ agentId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      // Marca o agente como tendo permissões herdadas do catálogo
      const [updated] = await db
        .update(genaiAgents)
        .set({ permissionsInherited: true, updatedAt: new Date() })
        .where(eq(genaiAgents.id, input.agentId))
        .returning();
      return { success: true, agent: updated };
    }),

  // KPIs do dashboard LLMOps
  getLlmopsKpis: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { total: 0, emProducao: 0, comPii: 0, semPermissoes: 0, altaRisco: 0 };
      const all = await db.select().from(genaiAgents);
      return {
        total:           all.length,
        emProducao:      all.filter(a => a.status === "producao").length,
        comPii:          all.filter(a => a.piiExposed).length,
        semPermissoes:   all.filter(a => !a.permissionsInherited).length,
        altaRisco:       all.filter(a => a.riskLevel === "critico" || a.riskLevel === "alto").length,
        promptRisco:     all.filter(a => a.promptInjectionRisk === "alto" || a.promptInjectionRisk === "critico").length,
      };
    }),

  // ── Mapeamento MIP → Databricks (R20) ─────────────────────────────────────

  listMipMappings: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(mipDatabricksMapping).orderBy(mipDatabricksMapping.mipCode);
    }),

  createMipMapping: protectedProcedure
    .input(insertMipMappingSchema)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [created] = await db.insert(mipDatabricksMapping).values(input).returning();
      return created;
    }),

  updateMipMapping: protectedProcedure
    .input(z.object({ id: z.number(), data: insertMipMappingSchema.partial() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [updated] = await db
        .update(mipDatabricksMapping)
        .set(input.data)
        .where(eq(mipDatabricksMapping.id, input.id))
        .returning();
      return updated;
    }),

  deleteMipMapping: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.delete(mipDatabricksMapping).where(eq(mipDatabricksMapping.id, input.id));
      return { success: true };
    }),
});
