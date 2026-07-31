/**
 * aiGovernanceRouter.ts
 * Módulo 1: AI Governance — Inventário de Sistemas e Modelos de IA
 * Endereça: R17 (sistemas sem owner), R18 (modelos sem metadados), R19 (decommissioning), R27 (inventários desconexos)
 */
import { z } from "zod";
import { eq, desc, and, or, like, isNull } from "drizzle-orm";
import { getDb } from "./db";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  aiSystems,
  type InsertAiSystem,
} from "../drizzle/schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const insertAiSystemSchema = z.object({
  name:           z.string().min(1).max(256),
  description:    z.string().optional(),
  systemType:     z.string().optional(),
  vendor:         z.string().optional(),
  criticality:    z.enum(["critico", "alto", "medio", "baixo", "nao_definido"]).default("nao_definido"),
  status:         z.enum(["ativo", "em_revisao", "descontinuado", "arquivado"]).default("ativo"),
  aiOwnerName:    z.string().optional(),
  itResponsible:  z.string().optional(),
  domainId:       z.number().optional(),
  domainName:     z.string().optional(),
  entraIdAppId:   z.string().optional(),
  certStatus:     z.string().optional(),
  certExpiresAt:  z.string().optional(),
  riskLevel:      z.string().optional(),
  linkedModelIds: z.string().optional(),
  notes:          z.string().optional(),
});

// ─── Router ───────────────────────────────────────────────────────────────────
export const aiGovernanceRouter = router({

  // Listar todos os sistemas de IA
  listSystems: publicProcedure
    .input(z.object({
      status:      z.enum(["ativo", "em_revisao", "descontinuado", "arquivado"]).optional(),
      criticality: z.enum(["critico", "alto", "medio", "baixo", "nao_definido"]).optional(),
      search:      z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions: any[] = [];
      if (input?.status)      conditions.push(eq(aiSystems.status, input.status));
      if (input?.criticality) conditions.push(eq(aiSystems.criticality, input.criticality));
      if (input?.search) {
        conditions.push(
          or(
            like(aiSystems.name, `%${input.search}%`),
            like(aiSystems.description, `%${input.search}%`),
          )
        );
      }
      return db
        .select()
        .from(aiSystems)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(aiSystems.updatedAt));
    }),

  // Buscar sistema por ID
  getSystemById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [sys] = await db.select().from(aiSystems).where(eq(aiSystems.id, input.id));
      return sys ?? null;
    }),

  // Criar sistema de IA
  createSystem: protectedProcedure
    .input(insertAiSystemSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const payload: InsertAiSystem = {
        ...input,
        certExpiresAt: input.certExpiresAt ? new Date(input.certExpiresAt) : undefined,
        createdById:   ctx.user?.id,
        createdByName: ctx.user?.name ?? undefined,
      };
      const [created] = await db.insert(aiSystems).values(payload).returning();
      return created;
    }),

  // Atualizar sistema de IA
  updateSystem: protectedProcedure
    .input(z.object({ id: z.number(), data: insertAiSystemSchema.partial() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const patch: Partial<InsertAiSystem> = {
        ...input.data,
        certExpiresAt: input.data.certExpiresAt ? new Date(input.data.certExpiresAt) : undefined,
        updatedAt: new Date(),
      };
      const [updated] = await db
        .update(aiSystems)
        .set(patch)
        .where(eq(aiSystems.id, input.id))
        .returning();
      return updated;
    }),

  // Decommissioning: arquivar sistema (R19)
  decommissionSystem: protectedProcedure
    .input(z.object({ id: z.number(), notes: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [updated] = await db
        .update(aiSystems)
        .set({ status: "arquivado", notes: input.notes, updatedAt: new Date() })
        .where(eq(aiSystems.id, input.id))
        .returning();
      return updated;
    }),

  // Sistemas sem owner (R17)
  listSystemsWithoutOwner: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(aiSystems)
        .where(isNull(aiSystems.aiOwnerName))
        .orderBy(desc(aiSystems.createdAt));
    }),

  // Sistemas com certificado expirado (R16)
  listExpiredCerts: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(aiSystems)
        .where(eq(aiSystems.certStatus, "expired"))
        .orderBy(desc(aiSystems.certExpiresAt));
    }),

  // KPIs do dashboard de AI Governance
  getAiGovernanceKpis: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { total: 0, semOwner: 0, descontinuados: 0, certExpirado: 0, criticos: 0 };
      const all = await db.select().from(aiSystems);
      return {
        total:          all.length,
        semOwner:       all.filter(s => !s.aiOwnerName).length,
        descontinuados: all.filter(s => s.status === "descontinuado" || s.status === "arquivado").length,
        certExpirado:   all.filter(s => s.certStatus === "expired").length,
        criticos:       all.filter(s => s.criticality === "critico" || s.criticality === "alto").length,
        ativos:         all.filter(s => s.status === "ativo").length,
      };
    }),
});
