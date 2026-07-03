import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  meetings, agendaItems, dataAssets, businessGlossary,
  dataQualityChecks, accessRequests, qualityRules,
  servicenowTickets, implementationChecklist,
} from "../drizzle/schema";

config({ path: ".env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function runSeed() {
  console.log("🌱 Iniciando seed para apresentação da diretoria...");

  // ─── 1. Ativos de Dados ────────────────────────────────────────────────────
  console.log("Populando Ativos de Dados...");
  const assets = await db.insert(dataAssets).values([
    {
      name: "Vendas por Região - Consolidado",
      description: "Tabela consolidada de vendas diárias agrupadas por região, produto e canal de vendas. Fonte primária para o relatório executivo mensal.",
      domainId: 1,
      type: "tabela",
      sensitivity: "interno",
      criticality: "alta",
      status: "ativo",
      ownerId: 1,
      stewardId: 6,
      platform: "Databricks",
      location: "catalog_prod.comercial.vendas_regiao",
      updateFrequency: "diario",
      tags: ["vendas", "comercial", "receita"],
    },
    {
      name: "Cadastro de Clientes B2B",
      description: "Base mestra de clientes pessoa jurídica (distribuidores e construtoras). Contém CNPJ, endereço, segmento e histórico de relacionamento.",
      domainId: 1,
      type: "tabela",
      sensitivity: "confidencial",
      criticality: "critica",
      status: "ativo",
      ownerId: 1,
      stewardId: 6,
      platform: "SAP ERP",
      location: "sap_prd.sd.kna1",
      updateFrequency: "real-time",
      tags: ["clientes", "b2b", "master-data", "lgpd"],
    },
    {
      name: "Eficiência de Fornos - Cimento",
      description: "Métricas de eficiência térmica e consumo de energia dos fornos rotativos por planta industrial.",
      domainId: 2,
      type: "dashboard",
      sensitivity: "interno",
      criticality: "alta",
      status: "ativo",
      ownerId: 5,
      stewardId: 10,
      platform: "Power BI",
      location: "workspace_producao/eficiencia_fornos",
      updateFrequency: "horario",
      tags: ["producao", "energia", "eficiencia", "oee"],
    },
    {
      name: "DRE Consolidado Mensal",
      description: "Demonstrativo de Resultados do Exercício consolidado por unidade de negócio. Alimentado pelo SAP FI.",
      domainId: 3,
      type: "tabela",
      sensitivity: "restrito",
      criticality: "critica",
      status: "ativo",
      ownerId: 3,
      stewardId: 7,
      platform: "Databricks",
      location: "catalog_prod.financeiro.dre_mensal",
      updateFrequency: "mensal",
      tags: ["financeiro", "dre", "resultados", "sap"],
    },
    {
      name: "Custo de Frete por Rota",
      description: "API de consulta do custo médio de frete por rota e tipo de veículo, integrada ao TMS.",
      domainId: 5,
      type: "api",
      sensitivity: "interno",
      criticality: "media",
      status: "ativo",
      stewardId: 9,
      platform: "API Gateway",
      location: "api.votorantimcimentos.com/logistica/fretes/v1",
      updateFrequency: "diario",
      tags: ["logistica", "frete", "custos", "tms"],
    },
    {
      name: "Headcount por Área",
      description: "Relatório de headcount ativo por área, nível hierárquico e localidade. Atualizado pelo sistema de RH.",
      domainId: 4,
      type: "tabela",
      sensitivity: "confidencial",
      criticality: "media",
      status: "ativo",
      ownerId: 4,
      stewardId: 8,
      platform: "SAP HCM",
      location: "sap_prd.hr.headcount_area",
      updateFrequency: "semanal",
      tags: ["rh", "headcount", "pessoas"],
    },
    {
      name: "Emissões de CO₂ por Planta",
      description: "Dados de emissões de gases de efeito estufa por planta industrial, para relatório ESG.",
      domainId: 6,
      type: "tabela",
      sensitivity: "interno",
      criticality: "alta",
      status: "ativo",
      platform: "Databricks",
      location: "catalog_prod.sustentabilidade.emissoes_co2",
      updateFrequency: "mensal",
      tags: ["esg", "sustentabilidade", "co2", "emissoes"],
    },
  ]).returning();
  console.log(`✅ Inseridos ${assets.length} ativos de dados.`);

  // ─── 2. Glossário de Negócios ──────────────────────────────────────────────
  console.log("Populando Glossário de Negócios...");
  await db.insert(businessGlossary).values([
    {
      term: "Receita Líquida",
      definition: "Faturamento bruto deduzido de devoluções, abatimentos, descontos comerciais e impostos incidentes sobre vendas (IPI, ICMS, PIS, COFINS).",
      domainId: 3,
      status: "aprovado",
      synonyms: "Vendas Líquidas",
      acronym: "RL",
      relatedTerms: "Receita Bruta, EBITDA, Margem Bruta",
      stewardId: 7,
    },
    {
      term: "Cliente Ativo",
      definition: "Cliente B2B que realizou pelo menos uma compra faturada nos últimos 180 dias corridos.",
      domainId: 1,
      status: "aprovado",
      synonyms: "Cliente Recorrente",
      stewardId: 6,
    },
    {
      term: "OEE (Overall Equipment Effectiveness)",
      definition: "Índice que mede a eficácia global do equipamento, calculado como o produto de Disponibilidade × Performance × Qualidade. Meta corporativa: ≥ 85%.",
      domainId: 2,
      status: "em_revisao",
      acronym: "OEE",
      relatedTerms: "Disponibilidade, Performance, MTBF, MTTR",
      stewardId: 10,
    },
    {
      term: "EBITDA",
      definition: "Lucro antes de juros, impostos, depreciação e amortização. Principal indicador de geração de caixa operacional.",
      domainId: 3,
      status: "aprovado",
      acronym: "EBITDA",
      relatedTerms: "Receita Líquida, EBIT, Lucro Líquido",
      stewardId: 7,
    },
    {
      term: "Lead Time de Entrega",
      definition: "Tempo decorrido entre a confirmação do pedido pelo cliente e a efetiva entrega do produto na obra ou depósito.",
      domainId: 5,
      status: "aprovado",
      synonyms: "Prazo de Entrega",
      stewardId: 9,
    },
    {
      term: "Dado Pessoal Sensível",
      definition: "Dado pessoal sobre origem racial ou étnica, convicção religiosa, opinião política, saúde, vida sexual, dado genético ou biométrico, conforme Art. 5º, II da LGPD.",
      domainId: 4,
      status: "aprovado",
      acronym: "DPS",
      relatedTerms: "LGPD, PII, Titular dos Dados",
      stewardId: 8,
    },
  ]);
  console.log("✅ Inseridos 6 termos no glossário.");

  // ─── 3. Reuniões ──────────────────────────────────────────────────────────
  console.log("Populando Reuniões do Comitê...");
  const d = (offsetDays: number) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + offsetDays);
    return dt;
  };

  const meetingsData = await db.insert(meetings).values([
    {
      title: "Comitê de Dados Executivo — Junho/2026",
      description: "Reunião mensal do comitê executivo para alinhamento de prioridades e aprovação de políticas de governança.",
      scheduledAt: d(-15),
      endAt: new Date(d(-15).getTime() + 90 * 60000),
      location: "Teams / Sala São Paulo",
      status: "realizada",
      type: "ordinaria",
      minutesContent: "1. Aprovada a nova Política de Acesso a Dados PII v2.0.\n2. Discutido o roadmap de migração para o Databricks Unity Catalog.\n3. Definidas metas de qualidade para o domínio Comercial (completude ≥ 98%).\n4. Apresentado o painel de maturidade de dados — nível atual: 2,4/5.",
      decisionsContent: "- Política PII v2.0 aprovada por unanimidade.\n- Meta de completude do Cadastro de Clientes elevada para 98%.\n- Aprovado orçamento de R$ 120k para capacitação em governança de dados.",
      actionsContent: "- [ ] Atualizar documentação do SAP (Thiago Mendes — prazo: 30/06)\n- [ ] Implementar regras de mascaramento de CPF (Carlos Eduardo — prazo: 15/07)\n- [ ] Publicar Política PII no portal interno (Juliana Ramos — prazo: 20/06)",
    },
    {
      title: "Comitê de Dados Executivo — Maio/2026",
      description: "Reunião ordinária de maio com foco em qualidade de dados do domínio Financeiro.",
      scheduledAt: d(-45),
      endAt: new Date(d(-45).getTime() + 90 * 60000),
      location: "Teams",
      status: "realizada",
      type: "ordinaria",
      minutesContent: "1. Revisão dos indicadores de qualidade do DRE.\n2. Aprovação de 4 novos termos no glossário de negócios.\n3. Apresentação do projeto de linhagem de dados.",
      decisionsContent: "- Aprovados 4 termos no glossário (Receita Líquida, EBITDA, Lead Time, DPS).\n- Iniciado projeto de mapeamento de linhagem de dados financeiros.",
      actionsContent: "- [ ] Mapear linhagem do DRE até o SAP FI (Mariana Costa — prazo: 30/05)\n- [ ] Configurar alertas de SLA para o DRE (Juliana Ramos — prazo: 15/05)",
    },
    {
      title: "Alinhamento — Domínio Financeiro",
      description: "Revisão dos SLAs de qualidade de dados financeiros e aprovação de novos termos do glossário.",
      scheduledAt: d(5),
      endAt: new Date(d(5).getTime() + 60 * 60000),
      location: "Teams",
      status: "agendada",
      type: "ordinaria",
      domainId: 3,
    },
    {
      title: "Workshop de Maturidade de Dados",
      description: "Avaliação do nível de maturidade atual e definição do plano de ação para atingir o Nível 3 até dezembro/2026.",
      scheduledAt: d(20),
      endAt: new Date(d(20).getTime() + 180 * 60000),
      location: "Sala Curitiba — Sede",
      status: "agendada",
      type: "workshop",
    },
    {
      title: "Comitê Extraordinário — Incidente de Qualidade",
      description: "Reunião convocada para tratar incidente de inconsistência nos dados de faturamento detectado em auditoria.",
      scheduledAt: d(-30),
      endAt: new Date(d(-30).getTime() + 45 * 60000),
      location: "Teams",
      status: "realizada",
      type: "extraordinaria",
      domainId: 3,
      minutesContent: "Identificada inconsistência de R$ 2,3M no faturamento de março causada por dupla contagem de notas fiscais de bonificação.",
      decisionsContent: "- Correção imediata dos dados no Databricks.\n- Implementação de regra de unicidade de NF no pipeline de ETL.",
      actionsContent: "- [ ] Corrigir dados históricos (Mariana Costa — URGENTE)\n- [ ] Implementar validação de NF duplicada (Carlos Eduardo — prazo: 48h)",
    },
  ]).returning();
  console.log(`✅ Inseridas ${meetingsData.length} reuniões.`);

  // Itens de Pauta
  await db.insert(agendaItems).values([
    { meetingId: meetingsData[0].id, order: 1, title: "Abertura e Aprovação da Ata Anterior", duration: 5, status: "concluido" },
    { meetingId: meetingsData[0].id, order: 2, title: "Revisão de Indicadores de Qualidade de Dados", duration: 25, status: "concluido" },
    { meetingId: meetingsData[0].id, order: 3, title: "Aprovação da Política PII v2.0", duration: 20, status: "concluido" },
    { meetingId: meetingsData[0].id, order: 4, title: "Roadmap Databricks Unity Catalog", duration: 30, status: "concluido" },
    { meetingId: meetingsData[0].id, order: 5, title: "Encerramento e Próximos Passos", duration: 10, status: "concluido" },
    { meetingId: meetingsData[2].id, order: 1, title: "Aprovação de Termos do Glossário", duration: 20, status: "pendente" },
    { meetingId: meetingsData[2].id, order: 2, title: "Revisão de SLA do DRE Consolidado", duration: 40, status: "pendente" },
    { meetingId: meetingsData[3].id, order: 1, title: "Apresentação do Modelo de Maturidade", duration: 30, status: "pendente" },
    { meetingId: meetingsData[3].id, order: 2, title: "Avaliação por Domínio", duration: 90, status: "pendente" },
    { meetingId: meetingsData[3].id, order: 3, title: "Plano de Ação 2026", duration: 60, status: "pendente" },
  ]);
  console.log("✅ Inseridos itens de pauta.");

  // ─── 4. Regras de Qualidade ────────────────────────────────────────────────
  console.log("Populando Regras de Qualidade...");
  const rules = await db.insert(qualityRules).values([
    { assetId: assets[1].id, ruleType: "completude", columnName: "cnpj", threshold: 99, isActive: true },
    { assetId: assets[0].id, ruleType: "validade",   columnName: "cod_produto", threshold: 100, isActive: true },
    { assetId: assets[3].id, ruleType: "consistencia", columnName: "receita_liquida", threshold: 100, isActive: true },
    { assetId: assets[1].id, ruleType: "unicidade",  columnName: "cnpj", threshold: 100, isActive: true },
    { assetId: assets[5].id, ruleType: "completude", columnName: "matricula", threshold: 98, isActive: true },
  ]).returning();
  console.log(`✅ Inseridas ${rules.length} regras de qualidade.`);

  // Histórico de Checks de Qualidade
  const now = new Date();
  await db.insert(dataQualityChecks).values([
    { assetId: assets[1].id, metricName: "Completude CNPJ",         score: 98.5,  threshold: 99,  lastRunAt: now, status: "alerta",  details: "300 registros sem CNPJ válido de um total de 20.000" },
    { assetId: assets[0].id, metricName: "Validade Código Produto",  score: 99.8,  threshold: 100, lastRunAt: now, status: "sucesso", details: "1.000 registros com código inválido de 500.000" },
    { assetId: assets[3].id, metricName: "Consistência DRE",         score: 100.0, threshold: 100, lastRunAt: now, status: "sucesso", details: "Nenhuma inconsistência detectada" },
    { assetId: assets[1].id, metricName: "Unicidade CNPJ",           score: 99.95, threshold: 100, lastRunAt: now, status: "alerta",  details: "10 CNPJs duplicados identificados" },
    { assetId: assets[5].id, metricName: "Completude Matrícula",     score: 100.0, threshold: 98,  lastRunAt: now, status: "sucesso", details: "Todos os colaboradores com matrícula preenchida" },
  ]);
  console.log("✅ Inseridos históricos de qualidade.");

  // ─── 5. Requisições de Acesso ──────────────────────────────────────────────
  console.log("Populando Requisições de Acesso...");
  await db.insert(accessRequests).values([
    {
      ticketNumber: "ACR-2026-0041",
      assetId: assets[0].id,
      requesterId: 4,
      requesterName: "Roberto Alves Neto",
      requesterEmail: "roberto.neto@votorantimcimentos.com.br",
      nivelAcesso: "leitura",
      papelGrupo: "Analista de RH Sênior",
      baseLegal: "legitimo_interesse",
      finalidade: "Cruzamento de dados de vendas com indicadores de RH para análise de performance de vendedores por região.",
      prazoNecessidade: "6 meses",
      status: "pendente_owner",
      flowType: "acesso_dados",
      priority: "media",
    },
    {
      ticketNumber: "ACR-2026-0038",
      assetId: assets[1].id,
      requesterId: 8,
      requesterName: "Paulo Henrique Santos",
      requesterEmail: "paulo.santos@votorantimcimentos.com.br",
      nivelAcesso: "leitura",
      papelGrupo: "Data Steward — Domínio RH",
      baseLegal: "legitimo_interesse",
      finalidade: "Projeto de análise de churn de clientes B2B para o time comercial.",
      prazoNecessidade: "3 meses",
      status: "aprovado",
      flowType: "dados_restritos",
      priority: "alta",
      statusOwner: "aprovado",
      ownerApprovedAt: d(-4),
      ownerComment: "Aprovado. Acesso restrito ao ambiente de sandbox.",
      statusSteward: "aprovado",
      stewardApprovedAt: d(-3),
      stewardComment: "Verificado que o acesso está alinhado com a base legal.",
    },
    {
      ticketNumber: "ACR-2026-0045",
      assetId: assets[6].id,
      requesterId: 11,
      requesterName: "Luciana Ferraz",
      requesterEmail: "luciana.ferraz@votorantimcimentos.com.br",
      nivelAcesso: "leitura_escrita",
      papelGrupo: "Analista de Sustentabilidade",
      baseLegal: "execucao_contrato",
      finalidade: "Atualização mensal dos dados de emissões para o relatório ESG anual.",
      prazoNecessidade: "Permanente",
      status: "pendente_steward",
      flowType: "acesso_dados",
      priority: "alta",
      statusOwner: "aprovado",
      ownerApprovedAt: d(-1),
    },
  ]);
  console.log("✅ Inseridas requisições de acesso.");

  // ─── 6. Tickets ServiceNow ─────────────────────────────────────────────────
  console.log("Populando Tickets ServiceNow...");
  await db.insert(servicenowTickets).values([
    {
      ticketNumber: "INC0014589",
      title: "Acesso negado ao Databricks — Catálogo Comercial",
      description: "Usuário relata erro 403 ao tentar consultar a tabela vendas_regiao no Databricks.",
      status: "In Progress",
      priority: "High",
      assignedTo: "Suporte Dados N2",
      domainId: 1,
    },
    {
      ticketNumber: "RITM0098234",
      title: "Solicitação de novo campo no DRE — Linha ESG",
      description: "Inclusão da linha de despesas com ESG no relatório consolidado mensal.",
      status: "New",
      priority: "Medium",
      assignedTo: "Engenharia de Dados",
      domainId: 3,
    },
    {
      ticketNumber: "INC0014612",
      title: "Dados de headcount desatualizados no Power BI",
      description: "Dashboard de headcount mostrando dados de 2 semanas atrás. Pipeline de atualização com falha.",
      status: "Resolved",
      priority: "High",
      assignedTo: "Engenharia de Dados",
      domainId: 4,
    },
  ]);
  console.log("✅ Inseridos tickets ServiceNow.");

  // ─── 7. Checklist de Implantação ──────────────────────────────────────────
  console.log("Populando Checklist de Implantação...");
  await db.insert(implementationChecklist).values([
    { domainId: 1, phase: "Estruturação", title: "Definição de Data Owner", order: 1, completed: true, completedAt: d(-60), completedBy: "Ana Paula Ferreira" },
    { domainId: 1, phase: "Estruturação", title: "Definição de Data Steward", order: 2, completed: true, completedAt: d(-58), completedBy: "Ana Paula Ferreira" },
    { domainId: 1, phase: "Catalogação", title: "Mapeamento de ativos de dados", order: 3, completed: true, completedAt: d(-45), completedBy: "Thiago Mendes" },
    { domainId: 1, phase: "Catalogação", title: "Classificação de sensibilidade", order: 4, completed: true, completedAt: d(-40), completedBy: "Thiago Mendes" },
    { domainId: 1, phase: "Qualidade", title: "Regras de qualidade configuradas", order: 5, completed: true, completedAt: d(-20), completedBy: "Thiago Mendes" },
    { domainId: 1, phase: "Governança", title: "Política de acesso publicada", order: 6, completed: false },
    { domainId: 3, phase: "Estruturação", title: "Definição de Data Owner", order: 1, completed: true, completedAt: d(-55), completedBy: "Mariana Costa Souza" },
    { domainId: 3, phase: "Estruturação", title: "Definição de Data Steward", order: 2, completed: true, completedAt: d(-53), completedBy: "Mariana Costa Souza" },
    { domainId: 3, phase: "Catalogação", title: "Mapeamento de ativos de dados", order: 3, completed: true, completedAt: d(-35), completedBy: "Juliana Ramos" },
    { domainId: 3, phase: "Catalogação", title: "Classificação de sensibilidade", order: 4, completed: true, completedAt: d(-30), completedBy: "Juliana Ramos" },
    { domainId: 3, phase: "Qualidade", title: "Regras de qualidade configuradas", order: 5, completed: false },
    { domainId: 3, phase: "Governança", title: "Política de acesso publicada", order: 6, completed: false },
    { domainId: 2, phase: "Estruturação", title: "Definição de Data Owner", order: 1, completed: true, completedAt: d(-50), completedBy: "Fernanda Oliveira" },
    { domainId: 2, phase: "Estruturação", title: "Definição de Data Steward", order: 2, completed: true, completedAt: d(-48), completedBy: "Fernanda Oliveira" },
    { domainId: 2, phase: "Catalogação", title: "Mapeamento de ativos de dados", order: 3, completed: false },
    { domainId: 2, phase: "Catalogação", title: "Classificação de sensibilidade", order: 4, completed: false },
  ]);
  console.log("✅ Inseridos itens do checklist de implantação.");

  console.log("\n🎉 Seed de apresentação finalizado com sucesso!");
  await pool.end();
  process.exit(0);
}

runSeed().catch((err) => {
  console.error("❌ Erro ao rodar o seed:", err);
  pool.end();
  process.exit(1);
});
