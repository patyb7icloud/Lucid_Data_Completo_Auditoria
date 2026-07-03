/**
 * piiScanner.ts — Detector automático de PII (Personally Identifiable Information)
 *
 * Analisa nomes de colunas e tipos de dados para identificar automaticamente
 * campos que contêm dados pessoais sob a LGPD.
 *
 * Categorias detectadas:
 *   - Identificadores diretos: CPF, CNPJ, RG, CNH, Passaporte
 *   - Dados de contato: e-mail, telefone, celular, endereço
 *   - Dados biométricos/sensíveis: biometria, raça, saúde, religião
 *   - Dados financeiros: conta bancária, cartão, salário
 *   - Localização: GPS, CEP, coordenadas
 */

export interface PiiScanResult {
  isPii: boolean;
  /** Categoria LGPD do dado detectado */
  category?: PiiCategory;
  /** Nível de risco: 'alto' = dado sensível (art. 11 LGPD), 'medio' = dado pessoal, 'baixo' = provável PII */
  riskLevel?: "alto" | "medio" | "baixo";
  /** Descrição do motivo da detecção */
  reason?: string;
  /** Sugestão de sensibilidade para o ativo */
  suggestedSensitivity?: "confidencial" | "restrito";
}

export type PiiCategory =
  | "identificador_fiscal"     // CPF, CNPJ, RG, CNH
  | "contato"                  // e-mail, telefone, celular
  | "nome"                     // nome completo, razão social
  | "endereco"                 // endereço, CEP, cidade
  | "financeiro"               // conta, agência, cartão, salário
  | "saude"                    // diagnóstico, prontuário, convênio
  | "biometrico"               // impressão digital, face, voz
  | "sensivel_lgpd"            // raça, religião, orientação, filiação sindical
  | "localizacao"              // GPS, coordenadas, rastreamento
  | "credencial";              // senha, token, chave

// ─── Padrões por categoria ────────────────────────────────────────────────────

interface PiiPattern {
  pattern: RegExp;
  category: PiiCategory;
  riskLevel: "alto" | "medio" | "baixo";
  reason: string;
}

const PII_PATTERNS: PiiPattern[] = [
  // ── Identificadores Fiscais (RISCO ALTO) ──
  { pattern: /\b(cpf|cnpj|rg|cnh|passaporte|passport|tax_id|taxid|documento|doc_num|num_doc|stcd[12]|nif)\b/i,
    category: "identificador_fiscal", riskLevel: "alto",
    reason: "Identificador fiscal ou documento de identidade (CPF/CNPJ/RG)" },

  // ── Dados de Saúde / Biométricos (RISCO ALTO — Art. 11 LGPD) ──
  { pattern: /\b(diagnostico|diagnosis|cid|cid10|prontuario|convenio|plano_saude|health|doenca|disease|sinistro|biometri|impressao_digital|fingerprint|face_id|iris|retina|dna|sangue|blood)\b/i,
    category: "saude", riskLevel: "alto",
    reason: "Dado de saúde ou biométrico — categoria sensível (Art. 11 LGPD)" },

  // ── Dados Sensíveis LGPD (RISCO ALTO — Art. 11) ──
  { pattern: /\b(raca|etnia|race|ethnicity|religiao|religion|crenca|belief|orientacao_sexual|sexual|sindic|filiacao_part|partido|politico|political|criminal|ficha)\b/i,
    category: "sensivel_lgpd", riskLevel: "alto",
    reason: "Dado sensível sob Art. 11 da LGPD (raça, religião, orientação sexual, político)" },

  // ── Credenciais (RISCO ALTO) ──
  { pattern: /\b(senha|password|passwd|pwd|secret|token|api_key|apikey|hash|salt|credential|private_key|chave)\b/i,
    category: "credencial", riskLevel: "alto",
    reason: "Credencial ou segredo — nunca deve estar em dados analíticos" },

  // ── Nome (RISCO MÉDIO) ──
  { pattern: /\b(nome|name|razao_social|full_name|fullname|first_name|last_name|firstname|lastname|sobrenome|apelido|alias|name1|name2|nam_[a-z])\b/i,
    category: "nome", riskLevel: "medio",
    reason: "Nome de pessoa física — dado pessoal identificador" },

  // ── Contato: e-mail (RISCO MÉDIO) ──
  { pattern: /\b(email|e_mail|e-mail|smtp|mail_addr|smtp_addr|correio|contato_email|contact_email)\b/i,
    category: "contato", riskLevel: "medio",
    reason: "Endereço de e-mail — dado de contato pessoal" },

  // ── Contato: telefone (RISCO MÉDIO) ──
  { pattern: /\b(telefone|fone|celular|phone|mobile|cel|tel|ddd|whatsapp|numero_contato)\b/i,
    category: "contato", riskLevel: "medio",
    reason: "Número de telefone ou celular — dado de contato pessoal" },

  // ── Endereço (RISCO MÉDIO) ──
  { pattern: /\b(endereco|address|logradouro|rua|avenida|bairro|cidade|municipio|estado|uf|cep|zipcode|zip_code|pais|country|stras|ort01|regio)\b/i,
    category: "endereco", riskLevel: "medio",
    reason: "Dado de endereço — localização residencial ou comercial" },

  // ── Financeiro (RISCO MÉDIO) ──
  { pattern: /\b(conta|agencia|banco|bank|cartao|card|credito|debito|salary|salario|remuneracao|rendimento|renda|income|revenue|iban|bic|swift|pix)\b/i,
    category: "financeiro", riskLevel: "medio",
    reason: "Dado financeiro — conta bancária, cartão ou renda" },

  // ── Localização (RISCO BAIXO) ──
  { pattern: /\b(latitude|longitude|lat|lng|gps|coordenada|coordinate|geo|localizacao|location|track|rastreio)\b/i,
    category: "localizacao", riskLevel: "baixo",
    reason: "Dado de geolocalização — pode identificar deslocamentos pessoais" },
];

// Tipos de dados que raramente contêm PII (para reduzir falsos positivos)
const NON_PII_TYPES = new Set([
  "INT", "INTEGER", "BIGINT", "SMALLINT", "TINYINT",
  "FLOAT", "DOUBLE", "DECIMAL", "NUMERIC", "NUMBER",
  "BOOLEAN", "BOOL", "BIT",
  "DATE", "TIME", "TIMESTAMP", "DATETIME",
  "JSON", "JSONB", "ARRAY",
]);

// Colunas técnicas que nunca são PII
const TECHNICAL_COLUMNS = /^(id$|[a-z_]+_id$|created_at|updated_at|deleted_at|version|seq|row_num|rownum|status|flag|tipo|type|code|codigo|chave_primaria|pk|fk|score|pct|perc|valor|value|amount|qty|quantity|count|total|avg|sum|min|max)$/i;

/**
 * Analisa um campo de tabela e retorna o resultado do scan de PII.
 *
 * @param columnName  Nome da coluna (ex: "CPF_CLIENTE", "SMTP_ADDR", "VALOR_VENDA")
 * @param dataType    Tipo do dado (ex: "VARCHAR(11)", "NUMBER", "DATE")
 */
export function scanTableForPii(columnName: string, dataType: string = ""): PiiScanResult {
  // Colunas técnicas conhecidas nunca são PII
  if (TECHNICAL_COLUMNS.test(columnName)) {
    return { isPii: false };
  }

  // Tipos numéricos/datas raramente contêm PII diretamente
  const baseType = dataType.replace(/\(.*\)/, "").trim().toUpperCase();
  const isNumericType = NON_PII_TYPES.has(baseType);

  // Testar cada padrão
  for (const { pattern, category, riskLevel, reason } of PII_PATTERNS) {
    if (pattern.test(columnName)) {
      // Credenciais e identificadores fiscais sempre são PII mesmo em tipos numéricos
      const forceFlag = category === "credencial" || category === "identificador_fiscal" || category === "sensivel_lgpd";
      if (isNumericType && !forceFlag && category !== "financeiro") continue;

      return {
        isPii: true,
        category,
        riskLevel,
        reason,
        suggestedSensitivity: riskLevel === "alto" ? "restrito" : "confidencial",
      };
    }
  }

  return { isPii: false };
}

/**
 * Escaneia uma lista de colunas de uma tabela e retorna um resumo.
 * Útil para determinar a sensibilidade sugerida do ativo como um todo.
 */
export function scanTable(columns: Array<{ name: string; type?: string }>): {
  piiColumns: Array<{ name: string; result: PiiScanResult }>;
  hasSensitiveLgpd: boolean;
  suggestedSensitivity: "publico" | "interno" | "confidencial" | "restrito";
  piiCount: number;
  riskSummary: string;
} {
  const piiColumns: Array<{ name: string; result: PiiScanResult }> = [];

  for (const col of columns) {
    const result = scanTableForPii(col.name, col.type);
    if (result.isPii) {
      piiColumns.push({ name: col.name, result });
    }
  }

  const hasSensitiveLgpd = piiColumns.some(c =>
    c.result.riskLevel === "alto" &&
    ["sensivel_lgpd", "saude", "biometrico"].includes(c.result.category ?? "")
  );

  const hasHighRisk = piiColumns.some(c => c.result.riskLevel === "alto");
  const hasMediumRisk = piiColumns.some(c => c.result.riskLevel === "medio");

  let suggestedSensitivity: "publico" | "interno" | "confidencial" | "restrito";
  if (hasSensitiveLgpd || hasHighRisk) suggestedSensitivity = "restrito";
  else if (hasMediumRisk) suggestedSensitivity = "confidencial";
  else if (piiColumns.length > 0) suggestedSensitivity = "interno";
  else suggestedSensitivity = "publico";

  const categories = [...new Set(piiColumns.map(c => c.result.category).filter(Boolean))];
  const riskSummary = piiColumns.length === 0
    ? "Nenhum dado pessoal detectado"
    : `${piiColumns.length} campo(s) PII detectado(s): ${categories.join(", ")}`;

  return { piiColumns, hasSensitiveLgpd, suggestedSensitivity, piiCount: piiColumns.length, riskSummary };
}
