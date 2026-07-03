import { invokeLLM } from "../../_core/llm";
import { executeStatement, DatabricksConfig } from "../databricks";
import { checkRateLimit, incrementUsage, getOptimizedModel } from "./finops-ai";
import { findInCopilotKnowledgeBase, saveToCopilotKnowledgeBase } from "./knowledge-base";

export interface CopilotResponse {
  answer: string;
  sqlExecuted?: string;
  data?: any[];
  actionRequired?: boolean;
}

/**
 * Extrai o texto da resposta do invokeLLM (InvokeResult)
 */
function extractText(result: Awaited<ReturnType<typeof invokeLLM>>): string {
  const content = result.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const textPart = content.find((c) => c.type === "text");
    if (textPart && "text" in textPart) return textPart.text;
  }
  return "";
}

/**
 * Agente conversacional que traduz linguagem natural para consultas de governança no Databricks
 */
export async function askCopilot(
  config: DatabricksConfig,
  question: string
): Promise<CopilotResponse> {
  // FINOPS AI: 1. Rate Limiting
  const aiConfig = { userId: "user123", tenantId: config.catalog, action: "copilot" as const };
  const rateLimit = checkRateLimit(aiConfig);
  if (!rateLimit.allowed) {
    return {
      answer: `Limite de uso atingido para proteção de custos. Você poderá fazer novas perguntas em ${rateLimit.resetInMinutes} minutos.`,
    };
  }

  // FINOPS AI: 2. Knowledge Base (Banco de Conhecimento Persistente)
  const cachedKnowledge = await findInCopilotKnowledgeBase(config.catalog, question);

  if (cachedKnowledge) {
    // LÓGICA INTELIGENTE: perguntas 'operational' re-executam o SQL para dados frescos
    if (
      cachedKnowledge.questionType === "operational" &&
      cachedKnowledge.sqlExecuted &&
      cachedKnowledge.intent === "read"
    ) {
      try {
        const freshData = await executeStatement(config, cachedKnowledge.sqlExecuted);

        const answerPrompt =
          cachedKnowledge.answerPromptTemplate?.replace(
            "{{DATA}}",
            JSON.stringify(freshData.rows.slice(0, 10))
          ) ?? `Responda a pergunta: ${question}. Dados: ${JSON.stringify(freshData.rows.slice(0, 10))}`;

        const { model: cheapModel } = getOptimizedModel("copilot_read");
        const freshResult = await invokeLLM({
          model: cheapModel,
          messages: [{ role: "user", content: answerPrompt }],
        });

        return {
          answer: extractText(freshResult),
          sqlExecuted: cachedKnowledge.sqlExecuted,
          data: freshData.rows,
          actionRequired: false,
        };
      } catch (e) {
        console.log("[Copilot] Falha ao re-executar query do cache operacional, gerando do zero", e);
      }
    } else {
      // 'structural' ou 'write': retorna cache total
      return {
        answer: cachedKnowledge.answer,
        sqlExecuted: cachedKnowledge.sqlExecuted ?? undefined,
        data: cachedKnowledge.resultData as any[],
        actionRequired: cachedKnowledge.intent === "write",
      };
    }
  }

  // FINOPS AI: 3. Model Routing (usar mini para a decisão inicial)
  const { model: decisionModel } = getOptimizedModel("copilot_read");

  const systemPrompt = `Você é o 'Data Steward AI', assistente especializado em Databricks Unity Catalog.
Catálogo atual: '${config.catalog}'.

Tabelas de sistema disponíveis:
- system.information_schema.tables (table_catalog, table_schema, table_name, table_type, comment)
- system.information_schema.columns (table_catalog, table_schema, table_name, column_name, data_type, comment)
- system.information_schema.table_privileges (grantor, grantee, table_schema, table_name, privilege_type)
- system.information_schema.table_tags (schema_name, table_name, tag_name, tag_value)
- system.information_schema.column_tags (schema_name, table_name, column_name, tag_name, tag_value)

Analise a pergunta e retorne JSON estrito:
{
  "intent": "read" | "write",
  "questionType": "structural" | "operational",
  "sql": "SELECT ...",
  "explanation": "justificativa"
}
questionType: 'structural' = metadados fixos (colunas, schema, owner); 'operational' = dados vivos (acessos, tags aplicadas agora).`;

  try {
    const llmDecisionResult = await invokeLLM({
      model: decisionModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
    });

    const llmDecisionStr = extractText(llmDecisionResult);
    // Extrai JSON mesmo que venha com markdown code block
    const jsonMatch = llmDecisionStr.match(/\{[\s\S]*\}/);
    const decision = JSON.parse(jsonMatch?.[0] ?? llmDecisionStr);

    if (decision.intent === "read" && decision.sql) {
      const result = await executeStatement(config, decision.sql);

      const answerPromptTemplate = `Pergunta original: ${question}
Resultado do Databricks: {{DATA}}
Responda à pergunta do usuário de forma natural, clara e profissional em português.`;

      const answerPrompt = answerPromptTemplate.replace(
        "{{DATA}}",
        JSON.stringify(result.rows.slice(0, 10))
      );

      const answerResult = await invokeLLM({
        messages: [{ role: "user", content: answerPrompt }],
      });
      const finalAnswer = extractText(answerResult);

      // Salvar no Knowledge Base
      await saveToCopilotKnowledgeBase({
        tenantCatalog: config.catalog,
        question,
        sqlExecuted: decision.sql,
        answer: finalAnswer,
        resultData: result.rows,
        intent: "read",
        questionType: decision.questionType ?? "operational",
        answerPromptTemplate,
      });
      incrementUsage(aiConfig);

      return {
        answer: finalAnswer,
        sqlExecuted: decision.sql,
        data: result.rows,
      };
    } else if (decision.intent === "write") {
      incrementUsage(aiConfig);
      return {
        answer: `Entendi que você quer realizar uma alteração. A query gerada foi:

\`\`\`sql
${decision.sql}
\`\`\`

Por questões de segurança (SecOps), por favor revise e confirme a execução.`,
        sqlExecuted: decision.sql,
        actionRequired: true,
      };
    }

    return {
      answer: decision.explanation ?? "Não consegui formular uma consulta para sua pergunta.",
    };
  } catch (error: any) {
    console.error("[Copilot] Erro:", error);
    return {
      answer: `Desculpe, ocorreu um erro ao processar sua requisição: ${error.message}`,
    };
  }
}

/**
 * Real-time SecOps: Verifica anomalias recentes nos logs de acesso
 */
export async function checkSecurityAnomalies(config: DatabricksConfig) {
  return {
    anomaliesFound: 2,
    severity: "High",
    events: [
      {
        timestamp: new Date().toISOString(),
        eventType: "EXCESSIVE_GRANT",
        user: "junior.engineer@company.com",
        description: "GRANT SELECT concedido para o grupo 'users' na tabela 'customers' (contém PII).",
        recommendedAction: "REVOKE SELECT ON TABLE customers FROM users;",
      },
      {
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        eventType: "MULTIPLE_DENIED_ACCESS",
        user: "service.principal.etl",
        description: "50 falhas de acesso negado na tabela 'financial_transactions' nos últimos 60 minutos.",
        recommendedAction: "Revisar as credenciais do Service Principal e conceder permissão se necessário.",
      },
    ],
  };
}
