import { router, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { aiProjects } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export const aiPipelineRouter = router({
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not initialized");
    return await db.select().from(aiProjects).orderBy(aiProjects.createdAt);
  }),
  
  create: publicProcedure
    .input(z.object({
      name: z.string().min(1, "Nome é obrigatório"),
      description: z.string().optional(),
      department: z.string().optional(),
      riskLevel: z.enum(["baixo", "medio", "alto", "critico"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not initialized");
      const [newProject] = await db.insert(aiProjects).values({
        name: input.name,
        description: input.description,
        department: input.department,
        riskLevel: (input.riskLevel || "medio") as any,
        gate: "G0",
        status: "active",
      }).returning();
      return newProject;
    }),
    
  updateGate: publicProcedure
    .input(z.object({
      id: z.number(),
      gate: z.enum(["G0", "G1", "G2", "G3"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not initialized");
      const [updatedProject] = await db.update(aiProjects)
        .set({ gate: input.gate, updatedAt: new Date() })
        .where(eq(aiProjects.id, input.id))
        .returning();
      return updatedProject;
    }),
});
