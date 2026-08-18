export type ComplianceTemplateItem = {
  checkName: string;
  description: string;
};

export const COMPLIANCE_TEMPLATES: Record<string, ComplianceTemplateItem[]> = {
  lgpd: [
    {
      checkName: "Mapeamento de Base Legal",
      description: "O processamento de dados do modelo possui base legal documentada (ex: Consentimento, Legítimo Interesse).",
    },
    {
      checkName: "Anonimização de PII na Inferência",
      description: "O modelo garante a ocultação ou anonimização de dados pessoais sensíveis nas requisições/respostas.",
    },
    {
      checkName: "Transparência ao Titular",
      description: "O titular dos dados é informado sobre a tomada de decisão automatizada e possui canal para contestação.",
    },
    {
      checkName: "Descarte Seguro",
      description: "Existe um pipeline ativo que apaga ou retreina o modelo caso um usuário invoque o Direito de Esquecimento (DSR).",
    }
  ],
  eu_ai_act: [
    {
      checkName: "Classificação de Risco (Risk Tier)",
      description: "O sistema foi formalmente classificado como Risco Baixo, Alto Risco ou Proibido de acordo com as regras europeias.",
    },
    {
      checkName: "Supervisão Humana (Human-in-the-loop)",
      description: "Existe mecanismo para que um operador humano intervenha nas decisões ou atue como validador final.",
    },
    {
      checkName: "Documentação Técnica Abrangente",
      description: "A arquitetura, limitações do modelo e métricas de treinamento estão devidamente documentadas e acessíveis a autoridades.",
    },
    {
      checkName: "Registro Automático de Logs (Traceability)",
      description: "As operações do modelo em produção estão gerando logs imutáveis para garantir rastreabilidade.",
    }
  ],
  iso_42001: [
    {
      checkName: "Política de Gestão de IA",
      description: "O modelo está em conformidade com a Política de Uso Aceitável de IA definida pela organização.",
    },
    {
      checkName: "Avaliação de Impacto de IA (AIA)",
      description: "Foi executada e documentada a avaliação prévia de impactos sociais e de segurança do modelo.",
    },
    {
      checkName: "Controle de Terceiros e Fornecedores",
      description: "Fornecedores de base ou APIs externas de IA possuem contratos avaliados sob as regras da ISO 42001.",
    }
  ],
  nist_ai_rmf: [
    {
      checkName: "Contexto de Uso (Map)",
      description: "O contexto em que o sistema será implantado foi compreendido e documentado.",
    },
    {
      checkName: "Métricas de Confiabilidade (Measure)",
      description: "Testes quantitativos (viés, robustez, latência) foram implementados.",
    },
    {
      checkName: "Plano de Mitigação de Riscos (Manage)",
      description: "Existem controles e fallback mapeados para caso o modelo apresente drift ou anomalias graves.",
    }
  ]
};
