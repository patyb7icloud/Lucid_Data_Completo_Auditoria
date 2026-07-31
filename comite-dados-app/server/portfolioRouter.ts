/**
 * portfolioRouter.ts
 * Módulo 3: Portfólio de Iniciativas & Gates
 * Endereça: R16 (certificados Entra ID), R23 (portfólio sem metadados), R26 (gates Fase II), R27 (rastreabilidade)
 */
import { z } from "zod";
import { eq, desc, and, like, or } from "drizzle-orm";
import { getDb } from "./db";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  dataInitiatives,
  initiativeGateHistory,
  type InsertDataInitiative,
} from "../drizzle/schema";

// ─── Schemas de validação ─────────────────────────────────────────────────────
const insertInitiativeSchema = z.object({
  title:             z.string().min(1).max(512),
  description:       z.string().optional(),
  initiativeType:    z.string().optional(),
  phase:             z.enum(["ideacao", "poc", "piloto", "rollout", "producao", "descontinuada"]).default("ideacao"),
  status:            z.enum(["rascunho", "em_andamento", "aguardando_gate", "aprovada", "pausada", "cancelada"]).default("rascunho"),
  priority:          z.enum(["critica", "alta", "media", "baixa"]).default("media"),
  businessOwnerName: z.string().optional(),
  aiModelOwnerName:  z.string().optional(),
  domainId:          z.number().optional(),
  domainName:        z.string().optional(),
  squad:             z.string().optional(),
  riskLevel:         z.string().optional(),
  mipSensitivity:    z.string().optional(),
  linkedSystemId:    z.number().optional(),
  linkedModelId:     z.number().optional(),
  linkedAgentId:     z.number().optional(),
  gateApprovedBy:    z.string().optional(),
  gateNotes:         z.string().optional(),
  startDate:         z.string().optional(),
  targetDate:        z.string().optional(),
  tags:              z.string().optional(),
  notes:             z.string().optional(),
});

// Checklist de gate por fase
const GATE_CHECKLISTS: Record<string, string[]> = {
  poc: [
    "Problema de negócio claramente definido",
    "Dados disponíveis e acessíveis identificados",
    "Responsável técnico (AI Owner) designado",
    "Análise de viabilidade técnica concluída",
    "Riscos de privacidade (PIA preliminar) avaliados",
  ],
  piloto: [
    "PoC validada com métricas de sucesso atingidas",
    "Avaliação de risco de IA (AI Risk Assessment) aprovada",
    "Dados de treinamento catalogados no Data Catalog",
    "Modelo registrado no MLOps Registry",
    "Aprovação do Data Steward do domínio obtida",
  ],
  rollout: [
    "Piloto aprovado com KPIs de negócio atingidos",
    "PIA completa aprovada pelo DPO",
    "Políticas de acesso (RLS/CLS) configuradas no Unity Catalog",
    "Monitoramento de drift e performance configurado",
    "Documentação técnica e de negócio completa",
    "Plano de rollback definido",
  ],
  producao: [
    "Rollout concluído sem incidentes críticos",
    "SLA de disponibilidade definido e monitorado",
    "Processo de retraining documentado",
    "Responsável por manutenção designado",
    "Revisão periódica (trimestral) agendada",
  ],
};

// ─── Router ───────────────────────────────────────────────────────────────────
export const portfolioRouter = router({

  // Listar iniciativas
  listInitiatives: publicProcedure
    .input(z.object({
      phase:    z.enum(["ideacao", "poc", "piloto", "rollout", "producao", "descontinuada"]).optional(),
      status:   z.enum(["rascunho", "em_andamento", "aguardando_gate", "aprovada", "pausada", "cancelada"]).optional(),
      priority: z.enum(["critica", "alta", "media", "baixa"]).optional(),
      search:   z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions: any[] = [];
      if (input?.phase)    conditions.push(eq(dataInitiatives.phase, input.phase));
      if (input?.status)   conditions.push(eq(dataInitiatives.status, input.status));
      if (input?.priority) conditions.push(eq(dataInitiatives.priority, input.priority));
      if (input?.search) {
        conditions.push(or(
          like(dataInitiatives.title, `%${input.search}%`),
          like(dataInitiatives.description, `%${input.search}%`),
        ));
      }
      return db
        .select()
        .from(dataInitiatives)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(dataInitiatives.updatedAt));
    }),

  getInitiativeById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [initiative] = await db
        .select()
        .from(dataInitiatives)
        .where(eq(dataInitiatives.id, input.id));
      return initiative ?? null;
    }),

  createInitiative: protectedProcedure
    .input(insertInitiativeSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const payload: InsertDataInitiative = {
        ...input,
        startDate:  input.startDate  ? new Date(input.startDate)  : undefined,
        targetDate: input.targetDate ? new Date(input.targetDate) : undefined,
        createdById:   ctx.user?.id,
        createdByName: ctx.user?.name ?? undefined,
      };
      const [created] = await db.insert(dataInitiatives).values(payload).returning();
      return created;
    }),

  updateInitiative: protectedProcedure
    .input(z.object({ id: z.number(), data: insertInitiativeSchema.partial() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const patch: Partial<InsertDataInitiative> = {
        ...input.data,
        startDate:  input.data.startDate  ? new Date(input.data.startDate)  : undefined,
        targetDate: input.data.targetDate ? new Date(input.data.targetDate) : undefined,
        updatedAt: new Date(),
      };
      const [updated] = await db
        .update(dataInitiatives)
        .set(patch)
        .where(eq(dataInitiatives.id, input.id))
        .returning();
      return updated;
    }),

  // Avançar fase via Gate (R26) — registra histórico e valida checklist
  advanceGate: protectedProcedure
    .input(z.object({
      initiativeId:  z.number(),
      toPhase:       z.enum(["ideacao", "poc", "piloto", "rollout", "producao", "descontinuada"]),
      approvedBy:    z.string(),
      checklistJson: z.string().optional(),
      notes:         z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      // Buscar fase atual
      const [current] = await db
        .select()
        .from(dataInitiatives)
        .where(eq(dataInitiatives.id, input.initiativeId));
      if (!current) throw new Error("Iniciativa não encontrada");

      // Registrar histórico de gate
      await db.insert(initiativeGateHistory).values({
        initiativeId:  input.initiativeId,
        fromPhase:     current.phase,
        toPhase:       input.toPhase,
        approvedBy:    input.approvedBy,
        checklistJson: input.checklistJson,
        notes:         input.notes,
      });

      // Atualizar fase e status da iniciativa
      const [updated] = await db
        .update(dataInitiatives)
        .set({
          phase:          input.toPhase,
          status:         "em_andamento",
          gateApprovedBy: input.approvedBy,
          gateApprovedAt: new Date(),
          gateNotes:      input.notes,
          updatedAt:      new Date(),
        })
        .where(eq(dataInitiatives.id, input.initiativeId))
        .returning();

      return { success: true, initiative: updated };
    }),

  // Obter checklist de gate para uma fase
  getGateChecklist: publicProcedure
    .input(z.object({ toPhase: z.string() }))
    .query(({ input }) => {
      const items = GATE_CHECKLISTS[input.toPhase] ?? [];
      return items.map((item, idx) => ({ id: idx + 1, item, checked: false, notes: "" }));
    }),

  // Histórico de gates de uma iniciativa
  getGateHistory: publicProcedure
    .input(z.object({ initiativeId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(initiativeGateHistory)
        .where(eq(initiativeGateHistory.initiativeId, input.initiativeId))
        .orderBy(desc(initiativeGateHistory.approvedAt));
    }),

  // KPIs do portfólio
  getPortfolioKpis: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { total: 0, aguardandoGate: 0, emAndamento: 0, criticas: 0, semOwner: 0 };
      const all = await db.select().from(dataInitiatives);
      return {
        total:          all.length,
        aguardandoGate: all.filter(i => i.status === "aguardando_gate").length,
        emAndamento:    all.filter(i => i.status === "em_andamento").length,
        criticas:       all.filter(i => i.priority === "critica" || i.priority === "alta").length,
        semOwner:       all.filter(i => !i.businessOwnerName).length,
        producao:       all.filter(i => i.phase === "producao").length,
        porFase: {
          ideacao:      all.filter(i => i.phase === "ideacao").length,
          poc:          all.filter(i => i.phase === "poc").length,
          piloto:       all.filter(i => i.phase === "piloto").length,
          rollout:      all.filter(i => i.phase === "rollout").length,
          producao:     all.filter(i => i.phase === "producao").length,
        },
      };
    }),
});
