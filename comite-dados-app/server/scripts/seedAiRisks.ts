import { getDb } from "../db";
import { aiRiskAssessments, mlModels } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

async function seedAiRisks() {
  const db = await getDb();
  if (!db) return console.error("Database not available");

  // Fetch some imported Databricks models
  const models = await db.select().from(mlModels).limit(5);

  if (models.length === 0) {
    console.log("No ML Models found. Run databricksMLSync first.");
    return;
  }

  const risksToInsert = [
    {
      modelId: models[0].id,
      modelName: models[0].name,
      title: "Risco de Viés em Dados de Treinamento",
      description: "A base de treinamento original pode conter viés histórico que afeta grupos sub-representados.",
      category: "vies" as const,
      level: "alto" as const,
      status: "aberto" as const,
      probability: 4,
      impact: 4,
      riskScore: 16,
      ownerName: models[0].ownerName || "Equipe de Ciência de Dados",
    },
    {
      modelId: models[1]?.id || models[0].id,
      modelName: models[1]?.name || models[0].name,
      title: "Falta de Explicabilidade no Modelo",
      description: "O modelo atua como caixa preta, dificultando a auditoria regulatória das decisões automáticas.",
      category: "explicabilidade" as const,
      level: "critico" as const,
      status: "em_mitigacao" as const,
      probability: 5,
      impact: 5,
      riskScore: 25,
      ownerName: models[1]?.ownerName || "Equipe MLOps",
    },
    {
      modelId: models[2]?.id || models[0].id,
      modelName: models[2]?.name || models[0].name,
      title: "Deriva de Dados (Data Drift)",
      description: "A distribuição dos dados em produção começou a divergir da distribuição de treino, podendo degradar a performance.",
      category: "operacional" as const,
      level: "medio" as const,
      status: "aberto" as const,
      probability: 3,
      impact: 3,
      riskScore: 9,
      ownerName: "Engenharia de Machine Learning",
    },
    {
      modelId: models[3]?.id || models[0].id,
      modelName: models[3]?.name || models[0].name,
      title: "Vazamento de Dados Sensíveis na Inferência",
      description: "Risco de exposição de PII através da API do modelo.",
      category: "privacidade" as const,
      level: "baixo" as const,
      status: "mitigado" as const,
      probability: 1,
      impact: 5,
      riskScore: 5,
      ownerName: "Segurança da Informação",
    }
  ];

  for (const risk of risksToInsert) {
    await db.insert(aiRiskAssessments).values(risk);
    console.log(`Inserido risco: ${risk.title}`);
  }

  console.log("Seed de Riscos de IA concluído com sucesso!");
}

seedAiRisks()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
