import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../../_core/cookies";
import { systemRouter } from "../../_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "../../_core/trpc";
import { z } from "zod";
import {
  testConnection,
  analyzeStructure,
  analyzeGlossary,
  analyzeTags,
  analyzeAccess,
  analyzeLineage,
  analyzeSecurity,
  computeGovernanceScore,
  GovernanceAnalysisData,
} from "../databricks";
import {
  createAuditSession,
  updateAuditSession,
  getAuditSession,
  getAuditSessionsByUser,
  createAnalysisResult,
  updateAnalysisResult,
  getAnalysisResultsBySession,
} from "../../db";
import { analyzeLGPDCompliance, detectPIIColumns, generateLGPDRecommendations } from "../services/lgpd-compliance";
import { generateSelfHealingSuggestions, applySelfHealing } from "../services/self-healing";
import { analyzeDataROI } from "../services/finops";
import { askCopilot, checkSecurityAnomalies } from "../services/copilot";

const databricksConfigSchema = z.object({
  host: z.string().min(1),
  token: z.string().min(1),
  catalog: z.string().min(1),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  databricks: router({
    // Test connection
    testConnection: protectedProcedure
      .input(databricksConfigSchema)
      .mutation(async ({ input }) => {
        return testConnection(input);
      }),

    // Start a full audit session
    startAudit: protectedProcedure
      .input(databricksConfigSchema)
      .mutation(async ({ input, ctx }) => {
        const sessionId = await createAuditSession({
          userId: ctx.user.id,
          databricksHost: input.host,
          targetCatalog: input.catalog,
          status: "running",
        });

        // Run all 6 analyses sequentially
        const analysisTypes = ["structure", "glossary", "tags", "access", "lineage", "security"] as const;
        const resultIds: Record<string, number> = {};

        for (const type of analysisTypes) {
          const rid = await createAnalysisResult({
            sessionId,
            analysisType: type,
            status: "running",
          });
          resultIds[type] = rid;
        }

        const results: Partial<GovernanceAnalysisData> = {};
        const errors: Record<string, string> = {};

        // Structure
        try {
          const t0 = Date.now();
          const data = await analyzeStructure(input);
          results.structure = data;
          await updateAnalysisResult(resultIds.structure, {
            status: "completed",
            resultData: data as any,
            executionMs: Date.now() - t0,
            score: 100,
          });
        } catch (e: any) {
          errors.structure = e.message;
          await updateAnalysisResult(resultIds.structure, { status: "failed", errorMessage: e.message });
        }

        // Glossary
        try {
          const t0 = Date.now();
          const data = await analyzeGlossary(input);
          results.glossary = data;
          await updateAnalysisResult(resultIds.glossary, {
            status: "completed",
            resultData: data as any,
            executionMs: Date.now() - t0,
            score: data.summary.tableDocCoverage,
          });
        } catch (e: any) {
          errors.glossary = e.message;
          await updateAnalysisResult(resultIds.glossary, { status: "failed", errorMessage: e.message });
        }

        // Tags
        try {
          const t0 = Date.now();
          const data = await analyzeTags(input);
          results.tags = data;
          await updateAnalysisResult(resultIds.tags, {
            status: "completed",
            resultData: data as any,
            executionMs: Date.now() - t0,
          });
        } catch (e: any) {
          errors.tags = e.message;
          await updateAnalysisResult(resultIds.tags, { status: "failed", errorMessage: e.message });
        }

        // Access
        try {
          const t0 = Date.now();
          const data = await analyzeAccess(input);
          results.access = data;
          await updateAnalysisResult(resultIds.access, {
            status: "completed",
            resultData: data as any,
            executionMs: Date.now() - t0,
          });
        } catch (e: any) {
          errors.access = e.message;
          await updateAnalysisResult(resultIds.access, { status: "failed", errorMessage: e.message });
        }

        // Lineage
        try {
          const t0 = Date.now();
          const data = await analyzeLineage(input);
          results.lineage = data;
          await updateAnalysisResult(resultIds.lineage, {
            status: "completed",
            resultData: data as any,
            executionMs: Date.now() - t0,
          });
        } catch (e: any) {
          errors.lineage = e.message;
          await updateAnalysisResult(resultIds.lineage, { status: "failed", errorMessage: e.message });
        }

        // Security
        try {
          const t0 = Date.now();
          const data = await analyzeSecurity(input);
          results.security = data;
          await updateAnalysisResult(resultIds.security, {
            status: "completed",
            resultData: data as any,
            executionMs: Date.now() - t0,
          });
        } catch (e: any) {
          errors.security = e.message;
          await updateAnalysisResult(resultIds.security, { status: "failed", errorMessage: e.message });
        }

        // Compute governance score
        let governanceScore = 0;
        let recommendations: string[] = [];
        let gaps: string[] = [];

        if (results.structure && results.glossary && results.tags && results.access && results.lineage && results.security) {
          const computed = computeGovernanceScore(results as GovernanceAnalysisData);
          governanceScore = computed.score;
          recommendations = computed.recommendations;
          gaps = computed.gaps;

          // Update each analysis with recommendations
          for (const type of analysisTypes) {
            if (resultIds[type]) {
              await updateAnalysisResult(resultIds[type], {
                recommendations: recommendations as any,
                gaps: gaps as any,
              });
            }
          }
        }

        const hasErrors = Object.keys(errors).length > 0;
        const allFailed = Object.keys(errors).length === analysisTypes.length;

        await updateAuditSession(sessionId, {
          status: allFailed ? "failed" : "completed",
          governanceScore,
          totalCatalogs: results.structure?.summary.totalCatalogs ?? 0,
          totalSchemas: results.structure?.summary.totalSchemas ?? 0,
          totalTables: (results.structure?.summary.totalTables ?? 0) + (results.structure?.summary.totalViews ?? 0),
          docCoverage: results.glossary?.summary.tableDocCoverage ?? 0,
          tagCoverage: results.tags && results.structure ? Math.round((results.tags.summary.tablesWithTags / Math.max(1, (results.structure.summary.totalTables + results.structure.summary.totalViews))) * 100) : 0,
          errorMessage: hasErrors ? JSON.stringify(errors) : undefined,
        });

        return {
          sessionId,
          governanceScore,
          recommendations,
          gaps,
          errors,
          hasErrors,
        };
      }),

    // Get session details with all analysis results
    getSession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input, ctx }) => {
        const session = await getAuditSession(input.sessionId);
        if (!session || session.userId !== ctx.user.id) {
          throw new Error("Session not found");
        }
        const analyses = await getAnalysisResultsBySession(input.sessionId);
        return { session, analyses };
      }),

    // Public read-only session fetch (useful for local dev without auth)
    getSessionPublic: publicProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        const session = await getAuditSession(input.sessionId);
        const analyses = await getAnalysisResultsBySession(input.sessionId);
        return { session, analyses };
      }),

    // List sessions for current user
    listSessions: protectedProcedure.query(async ({ ctx }) => {
      return getAuditSessionsByUser(ctx.user.id);
    }),

    // Compare two audit sessions
    compareSessions: protectedProcedure
      .input(z.object({ sessionIdA: z.number(), sessionIdB: z.number() }))
      .query(async ({ input, ctx }) => {
        const [sessionA, sessionB] = await Promise.all([
          getAuditSession(input.sessionIdA),
          getAuditSession(input.sessionIdB),
        ]);
        if (!sessionA || sessionA.userId !== ctx.user.id) throw new Error("Session A not found");
        if (!sessionB || sessionB.userId !== ctx.user.id) throw new Error("Session B not found");

        const [analysesA, analysesB] = await Promise.all([
          getAnalysisResultsBySession(input.sessionIdA),
          getAnalysisResultsBySession(input.sessionIdB),
        ]);

        // Extract grants count from access analysis resultData
        const getGrantsCount = (analyses: typeof analysesA) => {
          const access = analyses.find((a) => a.analysisType === "access");
          if (!access?.resultData) return null;
          const data = access.resultData as any;
          return data?.summary?.totalGrants ?? data?.grants?.length ?? null;
        };

        // Build checklist comparison: each analysis status + score
        const analysisLabels: Record<string, string> = {
          structure: "Mapeamento de Estrutura",
          glossary: "Glossário de Dados",
          tags: "Classificação por Tags",
          access: "Políticas de Acesso",
          lineage: "Linhagem de Dados",
          security: "Segurança Dinâmica",
        };

        const checklistA = analysesA.map((a) => ({
          type: a.analysisType,
          label: analysisLabels[a.analysisType] ?? a.analysisType,
          status: a.status,
          score: a.score,
        }));
        const checklistB = analysesB.map((a) => ({
          type: a.analysisType,
          label: analysisLabels[a.analysisType] ?? a.analysisType,
          status: a.status,
          score: a.score,
        }));

        return {
          sessionA: { ...sessionA, grantsCount: getGrantsCount(analysesA) },
          sessionB: { ...sessionB, grantsCount: getGrantsCount(analysesB) },
          checklistA,
          checklistB,
        };
      }),

    // Export report data
    exportReport: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input, ctx }) => {
        const session = await getAuditSession(input.sessionId);
        if (!session || session.userId !== ctx.user.id) {
          throw new Error("Session not found");
        }
        const analyses = await getAnalysisResultsBySession(input.sessionId);

        const report = {
          metadata: {
            exportedAt: new Date().toISOString(),
            databricksHost: session.databricksHost,
            targetCatalog: session.targetCatalog,
            auditDate: session.createdAt,
            governanceScore: session.governanceScore,
          },
          summary: {
            totalCatalogs: session.totalCatalogs,
            totalSchemas: session.totalSchemas,
            totalTables: session.totalTables,
            docCoverage: session.docCoverage,
            tagCoverage: session.tagCoverage,
          },
          analyses: analyses.map((a) => ({
            type: a.analysisType,
            status: a.status,
            score: a.score,
            executionMs: a.executionMs,
            data: a.resultData,
            recommendations: a.recommendations,
            gaps: a.gaps,
          })),
        };

        return report;
      }),
  }),

  // Revolucionário: Auto-Cura (Self-Healing)
  selfHealing: router({
    analyzeTable: protectedProcedure
      .input(z.object({
        host: z.string(),
        token: z.string(),
        catalog: z.string(),
        schema: z.string(),
        tableName: z.string(),
      }))
      .mutation(async ({ input }) => {
        return generateSelfHealingSuggestions(input, input.schema, input.tableName);
      }),
    applyFixes: protectedProcedure
      .input(z.object({
        host: z.string(),
        token: z.string(),
        catalog: z.string(),
        sqlCommands: z.array(z.string()),
      }))
      .mutation(async ({ input }) => {
        return applySelfHealing(input, input.sqlCommands);
      }),
  }),

  // Revolucionário: FinOps (Data ROI)
  finops: router({
    analyzeROI: protectedProcedure
      .input(z.object({
        host: z.string(),
        token: z.string(),
        catalog: z.string(),
      }))
      .query(async ({ input }) => {
        return analyzeDataROI(input);
      }),
  }),

  // Revolucionário: Copiloto e SecOps
  copilot: router({
    ask: publicProcedure
      .input(z.object({
        host: z.string(),
        token: z.string(),
        catalog: z.string(),
        question: z.string(),
      }))
      .mutation(async ({ input }) => {
        return askCopilot(input, input.question);
      }),
    checkAnomalies: publicProcedure
      .input(z.object({
        host: z.string(),
        token: z.string(),
        catalog: z.string(),
      }))
      .query(async ({ input }) => {
        return checkSecurityAnomalies(input);
      }),
  }),

  // Monitoramento Semanal do Copiloto
  monitoring: router({
    getWeeklyMetrics: protectedProcedure
      .input(z.object({ tenantCatalog: z.string() }))
      .query(async ({ input }) => {
        const { getLatestWeeklyMetrics } = await import("../services/monitoring");
        return await getLatestWeeklyMetrics(input.tenantCatalog);
      }),

    generateWeeklyMetrics: protectedProcedure
      .input(z.object({ tenantCatalog: z.string() }))
      .mutation(async ({ input }) => {
        const { generateWeeklyMetrics } = await import("../services/monitoring");
        return await generateWeeklyMetrics(input.tenantCatalog);
      }),

    setupWeeklyJob: protectedProcedure
      .input(z.object({ tenantCatalog: z.string() }))
      .mutation(async ({ input }) => {
        // O agendamento de job semântico no Databricks ainda não foi implementado.
        // A geração de métricas semanais pode ser executada sob demanda via
        // generateWeeklyMetrics ou agendada externamente (cron) chamando este endpoint.
        const { generateWeeklyMetrics } = await import("../services/monitoring");
        await generateWeeklyMetrics(input.tenantCatalog);
        return {
          success: true,
          message: "Métricas semanais geradas. Para execução recorrente, agende uma chamada periódica (cron) a este endpoint.",
        };
      }),
  }),

  // LGPD/GDPR Compliance Router
  lgpd: router({
    analyzeCompliance: protectedProcedure
      .input(z.object({
        databricksHost: z.string(),
        databricksToken: z.string(),
        catalog: z.string(),
      }))
      .mutation(async ({ input }) => {
        // TODO: Implement real analysis with Databricks queries
        // For now, return mock data with structure matching real analysis
        return analyzeLGPDCompliance({
          host: input.databricksHost,
          token: input.databricksToken,
          catalog: input.catalog,
        });
      }),

    detectTablePII: protectedProcedure
      .input(z.object({
        columns: z.array(z.object({
          name: z.string(),
          type: z.string(),
        })),
        sampleData: z.array(z.record(z.string(), z.unknown())).optional(),
      }))
      .query(({ input }) => {
        return detectPIIColumns(input.columns, input.sampleData as Record<string, unknown>[] | undefined);
      }),

    generateRecommendations: protectedProcedure
      .input(z.object({
        analysis: z.any(),
      }))
      .query(({ input }) => {
        return generateLGPDRecommendations(input.analysis);
      }),
  }),
});

export type AppRouter = typeof appRouter;
