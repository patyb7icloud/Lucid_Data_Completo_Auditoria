/**
 * LGPD (Lei Geral de Proteção de Dados) Compliance Module
 * Analyzes and reports on LGPD/GDPR compliance for data assets
 */

import { DatabricksConfig } from "./databricks";

export interface LGPDAnalysis {
  summary: {
    complianceScore: number; // 0-100
    riskLevel: "critical" | "high" | "medium" | "low";
    criticalIssues: number;
    highRiskAssets: number;
    lastUpdated: string;
  };
  piiDetection: {
    totalColumns: number;
    piiColumnsIdentified: number;
    piiTagged: number;
    untaggedPiiRisk: number;
    categories: Array<{ name: string; count: number; samples: string[] }>;
  };
  dataMinimization: {
    assessment: "compliant" | "partial" | "noncompliant";
    unnecessaryColumns: string[];
    recommendations: string[];
  };
  retention: {
    assessment: "defined" | "partial" | "undefined";
    policies: Array<{
      table: string;
      retentionDays?: number;
      deletePolicy?: string;
      assessment: "defined" | "undefined";
    }>;
    gaps: string[];
  };
  consent: {
    assessment: "tracked" | "partial" | "untracked";
    consentFields: string[];
    missingSources: string[];
  };
  encryption: {
    assessment: "enabled" | "partial" | "disabled";
    encryptedTables: number;
    unencryptedTables: number;
    recommendations: string[];
  };
  audit: {
    accessLogsEnabled: boolean;
    logRetention: number; // days
    lastAuditDate?: string;
    accessEvents: number;
  };
  dsr: {
    readyForDSR: boolean;
    readyForDeletion: boolean;
    readyForExport: boolean;
    gaps: string[];
  };
  responsibilities: {
    dataController: string; // e.g., "Casas Bahia"
    dataProcessor?: string; // e.g., "Databricks"
    dpo?: string; // Data Protection Officer contact
    owner: string; // table/schema owner
  };
}

export interface PiiPattern {
  name: string;
  keywords: string[];
  patterns: RegExp[];
  dataTypes: string[];
  severity: "critical" | "high" | "medium";
}

const PII_PATTERNS: PiiPattern[] = [
  {
    name: "Email",
    keywords: ["email", "mail", "e_mail"],
    patterns: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/],
    dataTypes: ["STRING", "VARCHAR"],
    severity: "high",
  },
  {
    name: "CPF (Cadastro de Pessoa Física)",
    keywords: ["cpf", "documento"],
    patterns: [/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, /^\d{11}$/],
    dataTypes: ["STRING", "VARCHAR"],
    severity: "critical",
  },
  {
    name: "CNPJ",
    keywords: ["cnpj"],
    patterns: [/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, /^\d{14}$/],
    dataTypes: ["STRING", "VARCHAR"],
    severity: "critical",
  },
  {
    name: "Telefone",
    keywords: ["telefone", "phone", "celular", "mobile"],
    patterns: [/^\(\d{2}\)\s?\d{4,5}-\d{4}$/, /^\d{10,11}$/],
    dataTypes: ["STRING", "VARCHAR", "BIGINT"],
    severity: "high",
  },
  {
    name: "Endereço",
    keywords: ["endereco", "address", "rua", "avenida", "logradouro"],
    patterns: [],
    dataTypes: ["STRING", "VARCHAR"],
    severity: "high",
  },
  {
    name: "Data de Nascimento",
    keywords: ["data_nascimento", "birthdate", "dob", "nascimento"],
    patterns: [/^\d{2}\/\d{2}\/\d{4}$/],
    dataTypes: ["DATE", "TIMESTAMP", "STRING"],
    severity: "high",
  },
  {
    name: "RG",
    keywords: ["rg", "registro_geral"],
    patterns: [/^\d{1,2}\.\d{3}\.\d{3}-[\dX]$/],
    dataTypes: ["STRING", "VARCHAR"],
    severity: "high",
  },
  {
    name: "Cartão de Crédito",
    keywords: ["cartao", "credit_card", "cc_number"],
    patterns: [/^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/],
    dataTypes: ["STRING", "VARCHAR"],
    severity: "critical",
  },
];

export async function analyzeLGPDCompliance(
  config: DatabricksConfig
): Promise<LGPDAnalysis> {
  // TODO: Implement full LGPD analysis
  // This is a template/scaffold for LGPD compliance checks

  const analysis: LGPDAnalysis = {
    summary: {
      complianceScore: 45, // Placeholder
      riskLevel: "high",
      criticalIssues: 3,
      highRiskAssets: 12,
      lastUpdated: new Date().toISOString(),
    },
    piiDetection: {
      totalColumns: 0,
      piiColumnsIdentified: 0,
      piiTagged: 0,
      untaggedPiiRisk: 0,
      categories: [],
    },
    dataMinimization: {
      assessment: "partial",
      unnecessaryColumns: [],
      recommendations: [
        "Review and remove unused columns containing PII",
        "Implement column-level deletion policies",
        "Archive historical data older than 2 years",
      ],
    },
    retention: {
      assessment: "undefined",
      policies: [],
      gaps: [
        "No retention policy defined for customer tables",
        "No automatic deletion mechanism detected",
      ],
    },
    consent: {
      assessment: "untracked",
      consentFields: [],
      missingSources: [
        "No consent tracking fields found in customer/user tables",
      ],
    },
    encryption: {
      assessment: "partial",
      encryptedTables: 2,
      unencryptedTables: 10,
      recommendations: [
        "Enable encryption at rest for all PII-containing tables",
        "Implement column-level encryption for critical identifiers (CPF, email)",
      ],
    },
    audit: {
      accessLogsEnabled: false,
      logRetention: 0,
      accessEvents: 0,
    },
    dsr: {
      readyForDSR: false,
      readyForDeletion: false,
      readyForExport: false,
      gaps: [
        "Data Subject Request (DSR) workflow not automated",
        "No pseudonymization/anonymization utilities available",
        "Lineage tracking incomplete for audit trail",
      ],
    },
    responsibilities: {
      dataController: "Casas Bahia",
      dataProcessor: "Databricks",
      dpo: "dpo@casasbahia.com.br",
      owner: "Data Governance Team",
    },
  };

  return analysis;
}

/**
 * Detect PII columns based on name patterns and data characteristics
 */
export function detectPIIColumns(
  columns: Array<{ name: string; type: string }>,
  sampleData?: Record<string, unknown>[]
): Array<{
  columnName: string;
  detectedAs: string;
  confidence: number;
  severity: string;
}> {
  const detected: Array<{
    columnName: string;
    detectedAs: string;
    confidence: number;
    severity: string;
  }> = [];

  for (const col of columns) {
    const colLower = col.name.toLowerCase();

    for (const pattern of PII_PATTERNS) {
      let confidence = 0;

      // Name-based detection
      if (pattern.keywords.some((kw) => colLower.includes(kw))) {
        confidence += 0.5;
      }

      // Type-based detection
      if (pattern.dataTypes.includes(col.type.toUpperCase())) {
        confidence += 0.2;
      }

      // Sample data pattern matching
      if (sampleData && sampleData.length > 0) {
        const sampleValue = sampleData[0]?.[col.name];
        if (typeof sampleValue === "string") {
          const matchCount = pattern.patterns.filter((p) =>
            p.test(sampleValue)
          ).length;
          if (matchCount > 0) confidence += 0.3;
        }
      }

      if (confidence >= 0.5) {
        detected.push({
          columnName: col.name,
          detectedAs: pattern.name,
          confidence: Math.min(confidence, 1),
          severity: pattern.severity,
        });
        break; // Avoid duplicate detections
      }
    }
  }

  return detected;
}

/**
 * Generate LGPD compliance gaps and recommendations
 */
export function generateLGPDRecommendations(
  analysis: LGPDAnalysis
): Array<{ priority: "critical" | "high" | "medium"; action: string }> {
  const recommendations: Array<{
    priority: "critical" | "high" | "medium";
    action: string;
  }> = [];

  // PII gaps
  if (analysis.piiDetection.untaggedPiiRisk > 0) {
    recommendations.push({
      priority: "critical",
      action: `Apply PII tags to ${analysis.piiDetection.untaggedPiiRisk} untagged PII columns`,
    });
  }

  // Retention gaps
  if (analysis.retention.assessment === "undefined") {
    recommendations.push({
      priority: "critical",
      action:
        "Define and implement data retention policies (e.g., delete customer data after 5 years)",
    });
  }

  // Encryption gaps
  if (analysis.encryption.unencryptedTables > 5) {
    recommendations.push({
      priority: "high",
      action: `Enable encryption for ${analysis.encryption.unencryptedTables} tables containing PII`,
    });
  }

  // Audit gaps
  if (!analysis.audit.accessLogsEnabled) {
    recommendations.push({
      priority: "high",
      action: "Enable comprehensive access logging for compliance audit trails",
    });
  }

  // DSR gaps
  if (!analysis.dsr.readyForDSR) {
    recommendations.push({
      priority: "high",
      action:
        "Implement automated Data Subject Request (DSR) workflow for export/deletion",
    });
  }

  // Consent tracking
  if (analysis.consent.assessment === "untracked") {
    recommendations.push({
      priority: "medium",
      action:
        "Add consent tracking fields to tables containing personal data",
    });
  }

  return recommendations;
}
