/**
 * Sistema de internacionalização leve — sem dependências externas.
 * Suporta: pt-BR (padrão), en, es
 */

export type Locale = "pt-BR" | "en" | "es";

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "pt-BR", label: "Português", flag: "🇧🇷" },
  { code: "en",    label: "English",   flag: "🇺🇸" },
  { code: "es",    label: "Español",   flag: "🇪🇸" },
];

// ─── Dicionário de Traduções ──────────────────────────────────────────────────
const translations: Record<Locale, Record<string, string>> = {
  "pt-BR": {
    // ── Grupos de navegação ────────────────────────────────────────────────────
    "nav.group.strategic":      "Visão Executiva",
    "nav.group.catalog":        "Descoberta & Catálogo",
    "nav.group.privacy":        "Privacidade & Segurança",
    "nav.group.quality":        "Operação & Qualidade",
    "nav.group.committee":      "Organização do Comitê",
    "nav.group.system":         "Configurações & Sistema",
    "nav.group.ai_mlops":        "IA & MLOps",
    "nav.group.help":           "Ajuda & Documentação",
    "nav.group.operational":    "Operacional",
    "nav.group.admin":          "Administração",
    // ── Itens do menu ─────────────────────────────────────────────────────────
    "nav.governance":           "Portal de Governança",
    "nav.group.auditoria": "Auditoria & Compliance",
    "nav.auditoriaDashboard": "Dashboard Auditoria",
    "nav.auditoriaNova": "Nova Auditoria",
    "nav.auditoriaHistorico": "Histórico",
    "nav.auditoriaCompliance": "Relatório Compliance",

    "nav.participants":         "Participantes",
    "nav.organogram":           "Organograma",
    "nav.raci":                 "Matriz RACI",
    "nav.catalog":              "Catálogo de Dados",
    "nav.dictionary":           "Dicionário",
    "nav.tagPolicies":          "Tags Governadas",
    "nav.glossary":             "Glossário de Negócios",
    "nav.lineage":              "Linhagem",
    "nav.contracts":            "Data Contracts",
    "nav.quality":              "Qualidade",
    "nav.piiPolicies":          "Políticas PII",
    "nav.autonomiaTiers":        "Autonomia por Tier",
    "nav.dictionaryCuration":    "Dicionário & Curadoria",
    "nav.portalLgpd":           "Portal LGPD & Privacidade",
    "nav.organization":         "Organização do Comitê",
    "nav.qualitySla":           "Qualidade & SLA",
    "nav.demands":              "Gestão de Demandas",
    "nav.integrationsConnectors": "Integrações & Conectores",
    "nav.compliance":           "Compliance LGPD",
    "nav.lgpd":                 "Relatório LGPD",
    "nav.pia":                  "PIA / DPIA",
    "nav.dsar":                 "DSAR — Direitos do Titular",
    "nav.sla":                  "SLA de Dados",
    "nav.maturity":             "Maturidade de Dados",
    "nav.checklist":            "Checklist Implantação",
    "nav.mlops":                 "MLOps & LLMOps",
    "nav.aiRisk":                "Riscos de IA",
    "nav.biConnectors":          "Integrações BI/SAP",
    "nav.aiAssistant":          "Assistente IA",
    "nav.help":                 "Sobre o Sistema",
    "nav.auditLog":             "Log de Auditoria",
    "nav.integrations":         "Integrações & API",
    "nav.status":               "Status do Sistema",
    "nav.intake":                "Entrada de Demandas",
    "nav.meetings":             "Reuniões",
    "nav.servicenow":           "ServiceNow",
    "nav.approvals":            "Aprovações",
    "nav.notifications":        "Notificações",
    "nav.exports":              "Exportações",
    "nav.roles":                "Papéis",
    "nav.settings":             "Configurações",
    "nav.feedback":             "Feedback",
    // ── Interface geral ────────────────────────────────────────────────────────
    "ui.loading":               "Carregando...",
    "ui.logout":                "Sair",
    "ui.menu":                  "Menu",
    "ui.language":              "Idioma",
    "ui.header.title":          "Lucid Data Governance",
    "nav.marketplace":          "Marketplace de Conectores",
    "ui.darkMode":              "Modo escuro",
    "ui.lightMode":             "Modo claro",
  },

  "en": {
    "nav.group.strategic":      "Executive View",
    "nav.group.catalog":        "Discovery & Catalog",
    "nav.group.privacy":        "Privacy & Security",
    "nav.group.quality":        "Operations & Quality",
    "nav.group.committee":      "Committee Organization",
    "nav.group.system":         "Settings & System",
    "nav.group.ai_mlops":        "AI & MLOps",
    "nav.group.help":           "Help & Documentation",
    "nav.group.operational":    "Operational",
    "nav.group.admin":          "Administration",
    "nav.governance":           "Governance Portal",
    "nav.participants":         "Participants",
    "nav.organogram":           "Organogram",
    "nav.raci":                 "RACI Matrix",
    "nav.catalog":              "Data Catalog",
    "nav.dictionary":           "Dictionary",
    "nav.tagPolicies":          "Governed Tags",
    "nav.glossary":             "Business Glossary",
    "nav.lineage":              "Lineage",
    "nav.contracts":            "Data Contracts",
    "nav.quality":              "Quality",
    "nav.piiPolicies":          "PII Policies",
    "nav.autonomiaTiers":        "Autonomy Tiers",
    "nav.dictionaryCuration":    "Dictionary & Curation",
    "nav.portalLgpd":           "LGPD & Privacy Portal",
    "nav.organization":         "Committee Organization",
    "nav.qualitySla":           "Quality & SLA",
    "nav.demands":              "Demand Management",
    "nav.integrationsConnectors": "Integrations & Connectors",
    "nav.compliance":           "LGPD Compliance",
    "nav.lgpd":                 "LGPD Report",
    "nav.pia":                  "PIA / DPIA",
    "nav.dsar":                 "DSAR — Data Subject Rights",
    "nav.sla":                  "Data SLA",
    "nav.maturity":             "Data Maturity",
    "nav.checklist":            "Deployment Checklist",
    "nav.mlops":                 "MLOps & LLMOps",
    "nav.aiRisk":                "AI Risk Management",
    "nav.biConnectors":          "BI/SAP Integrations",
    "nav.aiAssistant":          "AI Assistant",
    "nav.help":                 "About the System",
    "nav.auditLog":             "Audit Log",
    "nav.integrations":         "Integrations & API",
    "nav.status":               "System Status",
    "nav.intake":                "Demand Intake",
    "nav.meetings":             "Meetings",
    "nav.servicenow":           "ServiceNow",
    "nav.approvals":            "Approvals",
    "nav.notifications":        "Notifications",
    "nav.exports":              "Exports",
    "nav.roles":                "Roles",
    "nav.settings":             "Settings",
    "nav.feedback":             "Feedback",
    "ui.loading":               "Loading...",
    "ui.logout":                "Sign out",
    "ui.menu":                  "Menu",
    "ui.language":              "Language",
    "ui.header.title":          "Data Committee — Lucid Data Governance",
    "nav.marketplace":          "Connector Marketplace",
    "ui.darkMode":              "Dark mode",
    "ui.lightMode":             "Light mode",
  },

  "es": {
    "nav.group.strategic":      "Visión Ejecutiva",
    "nav.group.catalog":        "Descubrimiento & Catálogo",
    "nav.group.privacy":        "Privacidad & Seguridad",
    "nav.group.quality":        "Operación & Calidad",
    "nav.group.committee":      "Organización del Comité",
    "nav.group.system":         "Configuración & Sistema",
    "nav.group.ai_mlops":        "IA & MLOps",
    "nav.group.help":           "Ayuda & Documentación",
    "nav.group.operational":    "Operacional",
    "nav.group.admin":          "Administración",
    "nav.governance":           "Portal de Gobernanza",
    "nav.participants":         "Participantes",
    "nav.organogram":           "Organigrama",
    "nav.raci":                 "Matriz RACI",
    "nav.catalog":              "Catálogo de Datos",
    "nav.dictionary":           "Diccionario",
    "nav.tagPolicies":          "Etiquetas Gobernadas",
    "nav.glossary":             "Glosario de Negocio",
    "nav.lineage":              "Linaje",
    "nav.contracts":            "Data Contracts",
    "nav.quality":              "Calidad",
    "nav.piiPolicies":          "Políticas PII",
    "nav.autonomiaTiers":        "Autonomía por Tier",
    "nav.dictionaryCuration":    "Diccionario & Curación",
    "nav.portalLgpd":           "Portal LGPD & Privacidad",
    "nav.organization":         "Organización del Comité",
    "nav.qualitySla":           "Calidad & SLA",
    "nav.demands":              "Gestión de Demandas",
    "nav.integrationsConnectors": "Integraciones & Conectores",
    "nav.compliance":           "Cumplimiento LGPD",
    "nav.lgpd":                 "Informe LGPD",
    "nav.pia":                  "PIA / DPIA",
    "nav.dsar":                 "DSAR — Derechos del Titular",
    "nav.sla":                  "SLA de Datos",
    "nav.maturity":             "Madurez de Datos",
    "nav.checklist":            "Checklist de Implantación",
    "nav.mlops":                 "MLOps & LLMOps",
    "nav.aiRisk":                "Riesgos de IA",
    "nav.biConnectors":          "Integraciones BI/SAP",
    "nav.aiAssistant":          "Asistente IA",
    "nav.help":                 "Acerca del Sistema",
    "nav.auditLog":             "Registro de Auditoría",
    "nav.integrations":         "Integraciones & API",
    "nav.status":               "Estado del Sistema",
    "nav.intake":                "Entrada de Demandas",
    "nav.meetings":             "Reuniones",
    "nav.servicenow":           "ServiceNow",
    "nav.approvals":            "Aprobaciones",
    "nav.notifications":        "Notificaciones",
    "nav.exports":              "Exportaciones",
    "nav.roles":                "Roles",
    "nav.settings":             "Configuraciones",
    "nav.feedback":             "Feedback",
    "ui.loading":               "Cargando...",
    "ui.logout":                "Cerrar sesión",
    "ui.menu":                  "Menú",
    "ui.language":              "Idioma",
    "ui.header.title":          "Comité de Datos — Lucid Data Governance",
    "nav.marketplace":          "Mercado de Conectores",
    "ui.darkMode":              "Modo oscuro",
    "ui.lightMode":             "Modo claro",
  },
};

const STORAGE_KEY = "vc_locale";

/** Retorna o locale salvo ou detecta pelo browser */
export function getStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in translations) return stored as Locale;
    const browser = navigator.language;
    if (browser.startsWith("es")) return "es";
    if (browser.startsWith("en")) return "en";
  } catch {
    // SSR ou bloqueado
  }
  return "pt-BR";
}

export function saveLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {}
}

/** Cria um helper de tradução para um locale específico */
export function createT(locale: Locale) {
  const dict = translations[locale] ?? translations["pt-BR"];
  return function t(key: string, fallback?: string): string {
    return dict[key] ?? translations["pt-BR"][key] ?? fallback ?? key;
  };
}
