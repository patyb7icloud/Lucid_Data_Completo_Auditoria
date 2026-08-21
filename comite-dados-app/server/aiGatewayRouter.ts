import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { mlPredictionLogs } from "../drizzle/schema";

export const aiGatewayRouter = router({
  chat: protectedProcedure
    .input(z.object({
      agentId: z.number().optional(), // In a real app this maps to a specific Databricks Endpoint
      prompt: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // 1. Autenticação/Identidade
      // Neste mock, usamos ctx.user.id (simulando a identidade do Entra ID propagada)
      const userId = ctx.user.id;
      const userName = ctx.user.name ?? "Usuário Desconhecido";

      // 2. Guardrails Interceptivos (Simulados)
      const normalizedPrompt = input.prompt.toLowerCase();
      if (normalizedPrompt.includes("ignore as instruções") || normalizedPrompt.includes("cpf")) {
        throw new Error("GUARDRAIL BLOCK: Prompt contem violação de segurança (PII ou Injeção). Requisição bloqueada antes de chegar ao LLM.");
      }

      // 3. Roteamento de LLM (Mock de chamada ao Databricks Model Serving)
      // Aqui o backend usaria o Token do Azure Key Vault (AKV) para chamar a API
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulando latência da rede

      const responseText = `Olá ${userName}, esta é uma resposta simulada do Agente ${input.agentId ?? "Global"}. Recebi o seu prompt: "${input.prompt}".`;

      // 4. Cálculo de FinOps (Tokens)
      // Simulando a contagem de tokens que a API real devolveria
      const promptTokens = Math.max(10, input.prompt.length / 4);
      const completionTokens = Math.max(20, responseText.length / 4);
      const totalCostUsd = (promptTokens * 0.00001) + (completionTokens * 0.00003); // Preço fictício

      // 5. Registro de FinOps e Telemetria no Banco
      await db.insert(mlPredictionLogs).values({
        modelId: input.agentId ?? 999,
        userId: userId,
        outputLabel: responseText, // Gravando a resposta gerada
        promptTokens: Math.round(promptTokens),
        completionTokens: Math.round(completionTokens),
        costUsd: totalCostUsd,
        flagged: false,
      });

      return {
        reply: responseText,
        telemetry: {
          promptTokens: Math.round(promptTokens),
          completionTokens: Math.round(completionTokens),
          costUsd: totalCostUsd.toFixed(6)
        }
      };
    }),
});
