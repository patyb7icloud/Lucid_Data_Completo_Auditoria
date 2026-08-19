import { router, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { aiProjects } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const aiPipelineRouter = router({
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not initialized");
    return await db.select().from(aiProjects).orderBy(aiProjects.createdAt);
  }),
  
  metrics: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not initialized");
    
    const all = await db.select().from(aiProjects);
    const total = all.length;
    const evaluated = all.filter(p => p.goNoGoStatus !== "pending").length;
    const approved = all.filter(p => p.goNoGoStatus === "go").length;
    const rejected = all.filter(p => p.goNoGoStatus === "no_go").length;
    
    return {
      total,
      evaluated,
      approved,
      rejected,
      approvedPercentage: evaluated > 0 ? Math.round((approved / evaluated) * 100) : 0,
      rejectedPercentage: evaluated > 0 ? Math.round((rejected / evaluated) * 100) : 0,
    };
  }),
  
  create: publicProcedure
    .input(z.object({
      name: z.string().min(3, "Nome muito curto"),
      description: z.string().optional(),
      department: z.string().optional(),
      projectType: z.string().optional(),
      riskLevel: z.enum(["baixo", "medio", "alto", "critico"]).optional(),
      servicenowTicket: z.string().optional(),
      azureDevopsUrl: z.string().url("URL do Azure DevOps inválida").optional().or(z.literal("")),
      termsAccepted: z.boolean().refine(val => val === true, {
        message: "Você deve aceitar as políticas de uso para criar um Intake."
      })
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not initialized");
      
      const { aiProjects } = await import("../drizzle/schema");
      
      const [newProject] = await db.insert(aiProjects).values({
        name: input.name,
        description: input.description,
        department: input.department,
        projectType: input.projectType || "IA",
        riskLevel: (input.riskLevel || "medio") as any,
        servicenowTicket: input.servicenowTicket,
        azureDevopsUrl: input.azureDevopsUrl || undefined,
        termsAccepted: input.termsAccepted,
        gate: "G0",
        status: "active",
        goNoGoStatus: "pending",
      }).returning();
      
      return newProject;
    }),
    
  updateGoNoGo: publicProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["go", "no_go"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not initialized");
      
      const [updatedProject] = await db.update(aiProjects)
        .set({ goNoGoStatus: input.status as any, updatedAt: new Date() })
        .where(eq(aiProjects.id, input.id))
        .returning();
        
      return updatedProject;
    }),
    
  submitChecklist: publicProcedure
    .input(z.object({
      projectId: z.number(),
      gate: z.enum(["G0", "G1", "G2", "G3"]),
      items: z.array(z.object({
        itemText: z.string(),
        evidenceLink: z.string().optional()
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not initialized");
      
      const { aiProjectChecklists } = await import("../drizzle/schema");
      
      const values = input.items.map(item => ({
        projectId: input.projectId,
        gate: input.gate as any,
        itemText: item.itemText,
        evidenceLink: item.evidenceLink || undefined,
      }));
      
      if (values.length > 0) {
        await db.insert(aiProjectChecklists).values(values);
      }
      return { success: true };
    }),
    
  updateGate: publicProcedure
    .input(z.object({
      id: z.number(),
      gate: z.enum(["G0", "G1", "G2", "G3"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not initialized");
      
      // Validação Go/No-go: Só permite sair do G0 se o status for "go"
      if (input.gate !== "G0") {
        const [project] = await db.select().from(aiProjects).where(eq(aiProjects.id, input.id));
        if (project && project.goNoGoStatus !== "go") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "O projeto precisa ser aprovado (GO) no Business Case antes de avançar para as próximas etapas."
          });
        }
      }
      
      const [updatedProject] = await db.update(aiProjects)
        .set({ gate: input.gate, updatedAt: new Date() })
        .where(eq(aiProjects.id, input.id))
        .returning();
      return updatedProject;
    }),
});
