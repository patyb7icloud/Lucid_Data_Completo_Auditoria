import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";

const blockedPrompt = (prompt: string): boolean => {
  const normalizedPrompt = prompt.normalize("NFKC").toLocaleLowerCase();
  return /ignore\s+(?:as|todas\s+as)\s+instruções|revel(?:e|ar)\s+(?:o|as)\s+instruções|\bcpf\b|número\s+de\s+documento/.test(normalizedPrompt);
};

const responseText = (content: string | Array<{ type: string; text?: string }>): string => {
  if (typeof content === "string") return content;
  return content
    .filter(part => part.type === "text" && typeof part.text === "string")
    .map(part => part.text)
    .join("\n");
};

export const aiGatewayRouter = router({
  chat: protectedProcedure
    .input(z.object({
      agentId: z.number().optional(), // In a real app this maps to a specific Databricks Endpoint
      prompt: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      if (blockedPrompt(input.prompt)) {
        return {
          blocked: true,
          reply: "Sua solicitação foi bloqueada pelos controles de segurança.",
          telemetry: { promptTokens: null, completionTokens: null, totalTokens: null, costUsd: null },
        };
      }

      const result = await invokeLLM({
        messages: [{ role: "user", content: input.prompt }],
      });
      const content = result.choices?.[0]?.message?.content ?? "";

      return {
        blocked: false,
        reply: responseText(content),
        ...(result.usage ? { usage: result.usage } : {}),
        telemetry: {
          promptTokens: result.usage?.prompt_tokens ?? null,
          completionTokens: result.usage?.completion_tokens ?? null,
          totalTokens: result.usage?.total_tokens ?? null,
          costUsd: null,
        },
      };
    }),
});
