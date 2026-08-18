import { invokeLLM } from "../../_core/llm";
import { executeStatement, DatabricksConfig } from "../databricks";
import { checkRateLimit, incrementUsage, truncateContext, getOptimizedModel } from "./finops-ai";
import { findInSelfHealingKnowledgeBase, saveToSelfHealingKnowledgeBase } from "./knowledge-base";

export interface SelfHealingSuggestion {
  tableName: string;
  columnName?: string;
  suggestedDescription: string;
  suggestedTags: string[];
  confidenceScore: number;
  reasoning: string;
  sqlCommand: string;
}

/**
 * Analisa tabelas sem descrição e usa LLM para sugerir descrições e tags LGPD
 */
export async function generateSelfHealingSuggestions(
  config: DatabricksConfig,
  schema: string,
  tableName: string
): Promise<SelfHealingSuggestion[]> {
  // FINOPS AI: Rate Limiting
  const aiConfig = { userId: "user123", tenantId: config.catalog, action: "self_healing" as const };
  const rateLimit = checkRateLimit(aiConfig);
  if (!rateLimit.allowed) {
    throw new Error(`Limite de IA atingido. Tente novamente em ${rateLimit.resetInMinutes} minutos.`);
  }

  // FINOPS AI: Knowledge Base (Banco de Conhecimento Persistente)
  // Verifica se esta tabela já foi analisada recentemente (evita reprocessamento caro)
  const cachedSuggestions = await findInSelfHealingKnowledgeBase(config.catalog, schema, tableName);
  if (cachedSuggestions) {
    return cachedSuggestions as SelfHealingSuggestion[];
  }

  // 1. Obter metadados da tabela
  const tableMetadata = await executeStatement(
    config,
    `DESCRIBE TABLE EXTENDED ${config.catalog}.${schema}.${tableName}`
  );

  // 2. Obter amostra de dados (apenas 5 linhas, de forma segura)
  const dataSample = await executeStatement(
    config,
    `SELECT * FROM ${config.catalog}.${schema}.${tableName} LIMIT 5`
  );

  // FINOPS AI: Truncar contexto para economizar tokens
  const safeMetadata = truncateContext(tableMetadata.rows.filter(r => !r.col_name?.startsWith('#')), 20);
  const safeDataSample = truncateContext(dataSample.rows, 3);

  // 3. Preparar prompt para o LLM
  const prompt = `
    Atue como um Especialista em Governança de Dados Sênior e DPO (Data Protection Officer).
    Analise os seguintes metadados e amostra de dados de uma tabela do Databricks Unity Catalog.
    
    Tabela: ${config.catalog}.${schema}.${tableName}
    
    Colunas e Tipos (truncado):
    ${JSON.stringify(safeMetadata, null, 2)}
    
    Amostra de Dados (truncado):
    ${JSON.stringify(safeDataSample, null, 2)}
    
    Sua tarefa:
    1. Gere uma descrição de negócio clara e profissional para a tabela.
    2. Identifique se a tabela contém dados sensíveis ou PII (Personal Identifiable Information) segundo a LGPD.
    3. Para cada coluna, sugira uma descrição.
    4. Sugira tags de governança (ex: PII, LGPD, CONFIDENCIAL, FINANCEIRO, PUBLICO).
    
    Retorne EXATAMENTE no seguinte formato JSON, sem formatação markdown:
    {
      "tableDescription": "descrição da tabela",
      "tableTags": ["tag1", "tag2"],
      "columns": [
        {
          "name": "nome_coluna",
          "description": "descrição da coluna",
          "tags": ["tag1"]
        }
      ],
      "reasoning": "Sua justificativa para as tags de LGPD/PII escolhidas"
    }
  `;

  try {
    const { model } = getOptimizedModel("self_healing");
    const llmResult = await invokeLLM({
      model,
      messages: [
        { role: "system", content: "Você é um assistente de IA especializado em governança de dados, LGPD e Databricks Unity Catalog. Retorne apenas JSON válido, sem markdown." },
        { role: "user", content: prompt }
      ],
    });

    incrementUsage(aiConfig);

    const llmText = llmResult.choices?.[0]?.message?.content;
    const llmStr = typeof llmText === "string" ? llmText : (Array.isArray(llmText) ? (llmText.find((c: any) => c.type === "text") as any)?.text ?? "" : "");
    const jsonMatch = llmStr.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch?.[0] ?? llmStr);
    const suggestions: SelfHealingSuggestion[] = [];

    // Sugestão para a tabela
    const tableTags = result.tableTags ?? [];
    const tableTagsSql = tableTags.map((tag: string) => `ALTER TABLE ${config.catalog}.${schema}.${tableName} SET TAGS ('${tag}' = 'true');`).join('\n');
    suggestions.push({
      tableName,
      suggestedDescription: result.tableDescription,
      suggestedTags: tableTags,
      confidenceScore: 0.95,
      reasoning: result.reasoning,
      sqlCommand: `COMMENT ON TABLE ${config.catalog}.${schema}.${tableName} IS '${result.tableDescription.replace(/'/g, "''")}';` +
                  (tableTagsSql ? '\n' + tableTagsSql : '')
    });

    // Sugestões para as colunas
    for (const col of result.columns) {
      let sql = `COMMENT ON COLUMN ${config.catalog}.${schema}.${tableName}.${col.name} IS '${col.description.replace(/'/g, "''")}';`;
      if (col.tags && col.tags.length > 0) {
        const colTagsSql = col.tags.map((tag: string) => `ALTER TABLE ${config.catalog}.${schema}.${tableName} ALTER COLUMN ${col.name} SET TAGS ('${tag}' = 'true');`).join('\n');
        sql += '\n' + colTagsSql;
      }

      suggestions.push({
        tableName,
        columnName: col.name,
        suggestedDescription: col.description,
        suggestedTags: col.tags || [],
        confidenceScore: 0.9,
        reasoning: "Gerado baseado no nome da coluna e amostra de dados.",
        sqlCommand: sql
      });
    }

    // FINOPS AI: Salvar no Knowledge Base para reutilização futura
    await saveToSelfHealingKnowledgeBase({
      tenantCatalog: config.catalog,
      schemaName: schema,
      tableName: tableName,
      suggestions: suggestions
    });

    return suggestions;
  } catch (error) {
    console.error("Erro ao gerar sugestões de auto-cura:", error);
    throw new Error("Falha ao gerar sugestões com IA. Verifique a configuração do LLM.");
  }
}

/**
 * Aplica as correções sugeridas no Databricks
 * DEVE ser acionado manualmente pelo usuário após revisão
 */
export async function applySelfHealing(
  config: DatabricksConfig,
  sqlCommands: string[]
): Promise<{ success: boolean; executedCommands: number; error?: string }> {
  try {
    let count = 0;
    for (const cmd of sqlCommands) {
      // O Databricks SQL Statement API executa um comando por vez.
      // Se houver múltiplos comandos na string (separados por \n), precisamos dividir.
      const individualCommands = cmd.split(';').filter(c => c.trim().length > 0);
      for (const singleCmd of individualCommands) {
        await executeStatement(config, singleCmd.trim());
        count++;
      }
    }
    return { success: true, executedCommands: count };
  } catch (error: any) {
    return { success: false, executedCommands: 0, error: error.message };
  }
}
