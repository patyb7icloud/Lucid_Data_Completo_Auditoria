import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { 
  dataAssets, 
  dataLineage,
  accessRequests,
  intakeRequests,
  slaViolations,
  aiProjects,
  aiRiskAssessments,
  llmAgentAssets,
  mlModels,
  systemSettings
} from "../drizzle/schema";
import { eq, isNotNull, notInArray, sql } from "drizzle-orm";

export const executiveMetricsRouter = router({
  getMetrics: protectedProcedure.query(async () => {
    let catalog = {
      catalogedPercent: 0,
      ownerDefinedPercent: 0,
      mipClassificationPercent: 0,
      lineageDocumentedPercent: 0,
    };
    
    const access = {
      recertifiedPercent: 0,
      directGrantsReduction: 0,
      spnGroupGrantedPercent: 0,
      manageAllPrivilegesReviewed: 0,
      hasPermissionError: false,
    };
    
    let intake = {
      mandatoryFormPercent: 0,
      mipOwnerRiskPercent: 0,
      firstReviewApprovalRate: 0,
      avgFillValidationDays: 0, 
    };
    
    let audit = {
      completeEvidencePercent: 0,
      avgTimeToFindOwnerDays: 0,
      avgNonCompliancesPerCycle: 0,
      avgResolutionDays: 0,
    };
    
    let aiGov = {
      riskClassifiedPercent: 0,
      p1p2GatesCompletedPercent: 0,
      modelDataLineagePercent: 0,
      fairnessTestsCoveragePercent: 0,
    };

    try {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // --- 1. CATÁLOGO DE DADOS ---
      const allAssets = await db.select().from(dataAssets);
      const totalAssets = allAssets.length;
      if (totalAssets > 0) {
        const withOwner = allAssets.filter(a => a.ownerId !== null).length;
        // MIP: consideramos "interno", "confidencial", "restrito"
        const withMip = allAssets.filter(a => a.sensitivity && a.sensitivity !== 'publico').length;
        
        const lineageData = await db.select().from(dataLineage);
        const assetsInLineage = new Set([
          ...lineageData.map(l => l.sourceAssetId),
          ...lineageData.map(l => l.targetAssetId)
        ]);

        catalog.catalogedPercent = 100; // Todos os ativos da base estão no catálogo
        catalog.ownerDefinedPercent = Math.round((withOwner / totalAssets) * 100);
        catalog.mipClassificationPercent = Math.round((withMip / totalAssets) * 100);
        catalog.lineageDocumentedPercent = Math.round((assetsInLineage.size / totalAssets) * 100);
      }

      // --- 2. GESTÃO DE ACESSOS ---
      const allRequests = await db.select().from(accessRequests);
      const totalRequests = allRequests.length;
      const dbxMetricsRow = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, "databricks_access_metrics"))
        .limit(1);
      
      let dbxMetrics: any = null;
      if (dbxMetricsRow.length > 0 && dbxMetricsRow[0].value) {
        try {
          dbxMetrics = JSON.parse(dbxMetricsRow[0].value);
        } catch (e) {}
      }

      if (dbxMetrics) {
        access.recertifiedPercent = dbxMetrics.recertifiedPercent || 0;
        access.directGrantsReduction = dbxMetrics.directGrantsReduction || 0;
        access.manageAllPrivilegesReviewed = dbxMetrics.manageAllPrivilegesReviewed || 0;
        access.hasPermissionError = !!dbxMetrics.hasPermissionError;
      } else {
        access.recertifiedPercent = 0; 
        access.directGrantsReduction = 0;
        access.manageAllPrivilegesReviewed = 0;
        access.hasPermissionError = false;
      }

      if (totalRequests > 0) {
        const groupSpRequests = allRequests.filter(r => r.papelGrupo && r.papelGrupo.length > 0).length;
        access.spnGroupGrantedPercent = Math.round((groupSpRequests / totalRequests) * 100);
      }

      // --- 3. DEMANDAS (INTAKE) ---
      const allIntakes = await db.select().from(intakeRequests);
      const totalIntakes = allIntakes.length;
      if (totalIntakes > 0) {
        const notDrafts = allIntakes.filter(i => i.status !== 'rascunho').length;
        const withMipOwnerRisk = allIntakes.filter(i => i.dataSensitivity && i.dataOwnerName && i.identifiedRisks).length;
        
        let totalValidationDays = 0;
        let validatedCount = 0;
        allIntakes.forEach(i => {
          if (i.createdAt && i.validatedAt) {
            const diff = i.validatedAt.getTime() - i.createdAt.getTime();
            totalValidationDays += (diff / (1000 * 3600 * 24));
            validatedCount++;
          }
        });

        intake.mandatoryFormPercent = Math.round((notDrafts / totalIntakes) * 100);
        intake.mipOwnerRiskPercent = Math.round((withMipOwnerRisk / totalIntakes) * 100);
        intake.avgFillValidationDays = validatedCount > 0 ? Math.round(totalValidationDays / validatedCount) : 0;
        intake.firstReviewApprovalRate = 0; // Tracking não modelado
      }

      // --- 4. AUDITORIA E EVIDÊNCIAS ---
      const allViolations = await db.select().from(slaViolations);
      audit.avgNonCompliancesPerCycle = allViolations.length;
      if (allViolations.length > 0) {
        let totalDays = 0;
        let resolvedCount = 0;
        allViolations.forEach(v => {
          if (v.detectedAt && v.resolvedAt) {
            const diff = v.resolvedAt.getTime() - v.detectedAt.getTime();
            totalDays += (diff / (1000 * 3600 * 24));
            resolvedCount++;
          }
        });
        audit.avgResolutionDays = resolvedCount > 0 ? Math.round(totalDays / resolvedCount) : 0;
      }

      // --- 5. GOVERNANÇA DE IA ---
      const allAiProjects = await db.select().from(aiProjects);
      const allModels = await db.select().from(mlModels);
      const allRiskAssessments = await db.select().from(aiRiskAssessments);
      const allLlmAgentAssets = await db.select().from(llmAgentAssets);

      const totalAiEntities = allAiProjects.length + allModels.length;
      if (totalAiEntities > 0) {
        // Quantos modelos/projetos têm risk assessment
        const withRisk = allRiskAssessments.length;
        const boundedRisk = withRisk > totalAiEntities ? totalAiEntities : withRisk;
        aiGov.riskClassifiedPercent = Math.round((boundedRisk / totalAiEntities) * 100);

        // Projetos de IA além do gate G1 (G2, G3, G4)
        const gatesCompleted = allAiProjects.filter(p => p.gate === 'G2' || p.gate === 'G3').length;
        aiGov.p1p2GatesCompletedPercent = allAiProjects.length > 0 ? Math.round((gatesCompleted / allAiProjects.length) * 100) : 0;

        // Modelos com linhagem documentada (associações llm_agent_assets)
        aiGov.modelDataLineagePercent = allModels.length > 0 ? Math.round((allLlmAgentAssets.length / allModels.length) * 100) : 0;
      }

    } catch (e) {
      console.error("Failed to compute real executive metrics:", e);
    }

    return { catalog, access, intake, audit, aiGov };
  })
});
