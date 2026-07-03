import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Info, Book, Scale, Activity, RefreshCw, HelpCircle, FileText, CheckCircle2,
  LayoutDashboard, Users, GitBranch, Table2, Database, BookText, Network,
  ShieldCheck, Lock, CheckSquare, Bot, CalendarDays, Ticket, Bell, History,
  UserCog, Settings2, Download, Star, Zap, Target, AlertTriangle, Clock,
  Building2, Search, BarChart3, MessageSquare, Inbox, ListChecks, Trophy,
  ShieldAlert, ClipboardCheck, TrendingUp
} from "lucide-react";

const modules = [
  {
    icon: LayoutDashboard, color: "text-blue-700", border: "border-l-blue-700",
    label: "Portal de Governança", href: "/",
    desc: "Painel central com KPIs do Lucid Data Governance: total de participantes, reuniões realizadas, tarefas abertas e tickets do ServiceNow. Gráficos de evolução de reuniões por mês, distribuição de papéis e status das tarefas. Acesso rápido às principais seções do sistema."
  },
  {
    icon: Users, color: "text-indigo-700", border: "border-l-indigo-700",
    label: "Participantes", href: "/participantes",
    desc: "Cadastro e gerenciamento de todos os membros do Lucid Data Governance. Cada participante possui nome, e-mail, telefone, papel (ex: Data Owner, Data Steward, AI Ethics Officer) e status (ativo/inativo). Suporta pesquisa, filtro por papel e edição inline."
  },
  {
    icon: GitBranch, color: "text-purple-700", border: "border-l-purple-700",
    label: "Organograma", href: "/organograma",
    desc: "Visualização hierárquica da estrutura do Lucid Data Governance. Exibe a árvore de responsabilidades com camadas para Data Owners por domínio, Data Stewards, líderes técnicos e representantes de negócio."
  },
  {
    icon: Table2, color: "text-amber-700", border: "border-l-amber-700",
    label: "Matriz RACI", href: "/raci",
    desc: "Define quem é Responsável (R), Aprovador (A), Consultado (C) ou Informado (I) em cada atividade de governança. Suporta adição de novas atividades, categorização e edição por papel. Papéis disponíveis: Data Owner, Data Steward, Product Owner, Project Manager, AI Owner, AI Steward, AI Ethics Officer, ML Engineer, Model Manager."
  },
  {
    icon: Database, color: "text-cyan-700", border: "border-l-cyan-700",
    label: "Catálogo de Dados", href: "/catalogo",
    desc: "Inventário centralizado de todos os ativos de dados da VC. Cada ativo exibe: nome técnico, nome de negócio, domínio, sistema de origem, classificação de sensibilidade (público, interno, confidencial, restrito), score de qualidade e score de valor de negócio. Pesquisa avançada por texto e filtros por região/domínio. Painel lateral com linhagem, responsáveis e histórico."
  },
  {
    icon: BookText, color: "text-teal-700", border: "border-l-teal-700",
    label: "Dicionário de Dados", href: "/dicionario",
    desc: "Glossário oficial de termos técnicos e de negócio. Cada verbete contém definição, fórmula de cálculo (quando aplicável), domínio, responsável e status de aprovação pelo Comitê. Permite edição com controle de auditoria e exportação em CSV."
  },
  {
    icon: Network, color: "text-violet-700", border: "border-l-violet-700",
    label: "Linhagem de Dados", href: "/linhagem",
    desc: "Mapeamento visual do fluxo dos dados desde a origem até o consumo. Camadas: Origem (SAP HANA, Salesforce, IoT), Transformação (Azure Data Factory, Databricks), Armazenamento (Snowflake, Azure SQL) e Visualização (Power BI, Tableau). Permite selecionar um nó para ver os ativos que passam por ele."
  },
  {
    icon: ShieldCheck, color: "text-green-700", border: "border-l-green-700",
    label: "Qualidade de Dados", href: "/qualidade",
    desc: "Painel de monitoramento de qualidade dos ativos. Métricas automáticas de completude (% de campos preenchidos) e unicidade (% de registros sem duplicatas). Gráficos de distribuição por faixa de qualidade e evolução histórica. Permite configurar limiares de alerta por ativo e executar validações sob demanda."
  },
  {
    icon: Lock, color: "text-rose-700", border: "border-l-rose-700",
    label: "Compliance LGPD", href: "/compliance",
    desc: "Monitoramento de conformidade para dados sensíveis (confidencial e restrito). Calcula o score de compliance como proporção de ativos sensíveis com qualidade ≥ 80%. Identifica ativos em risco crítico. Gráfico radar com 5 eixos de conformidade: Catalogação, Proteção, Linhagem, Qualidade e Aprovação."
  },
  {
    icon: CheckSquare, color: "text-orange-700", border: "border-l-orange-700",
    label: "Checklist de Implantação", href: "/implantacao",
    desc: "Roteiro estruturado para implementação de novos programas de governança de dados. Divide o processo em fases (Descoberta, Catalogação, Qualidade, Conformidade, Operacionalização) com tarefas verificáveis e responsáveis por etapa."
  },
  {
    icon: Bot, color: "text-blue-500", border: "border-l-blue-500",
    label: "Assistente de IA", href: "/assistente-ia",
    desc: "Chatbot especializado em governança de dados corporativos. Responde perguntas sobre políticas internas, normas da LGPD, boas práticas de catalogação, Databricks, Snowflake e estruturação de Comitês de Dados. Histórico de conversa por sessão. Sugestões de perguntas frequentes exibidas na tela inicial."
  },
  {
    icon: CalendarDays, color: "text-sky-700", border: "border-l-sky-700",
    label: "Reuniões do Comitê", href: "/reunioes",
    desc: "Agendamento e gestão de reuniões do Lucid Data Governance. Tipos: Ordinária, Extraordinária, Piloto e Workshop. Cada reunião possui título, descrição, data/hora, local, link do Teams e domínio responsável. Geração automática de convites e detecção de conflitos de horário antes de confirmar. Exportação de ata em PDF/Word."
  },
  {
    icon: Ticket, color: "text-pink-700", border: "border-l-pink-700",
    label: "ServiceNow (Tickets)", href: "/servicenow",
    desc: "Central de tickets integrada ao ServiceNow da VC. Permite abrir, filtrar e acompanhar chamados de acesso a dados, incidentes de qualidade e solicitações de governança. Prioridades: Crítica, Alta, Média, Baixa. Alerta automático para tickets de alta/crítica parados há mais de 7 dias. Status em tempo real via polling."
  },
  {
    icon: Inbox, color: "text-blue-600", border: "border-l-blue-600",
    label: "Entrada de Demandas (Intake)", href: "/intake",
    desc: "Portal estruturado para submissão e gestão de demandas ao Lucid Data Governance. Formulário multi-etapas (Seções A–H) com 7 passos: Identificação, Caso de Uso, Dados, Qualidade, Critérios de Sucesso, Governança e Riscos. Cada demanda recebe código único INT-AAAAMMDD-NNN. Triagem pelo Comitê usa matriz P1–P4 com 8 critérios ponderados (máx. 100 pts): Financeiro, Urgência, Alcance, Estratégia, Completude, Viabilidade, Reuso e Data Owner. Inclui abas de Ranking de Prioridade, Pauta do Comitê e Checklist de Implementação."
  },
  {
    icon: Bell, color: "text-yellow-600", border: "border-l-yellow-600",
    label: "Notificações", href: "/notificacoes",
    desc: "Central de alertas do sistema. Receba notificações sobre: tickets críticos sem resposta, reuniões agendadas, aprovações pendentes no ServiceNow, ativos com qualidade abaixo do limiar configurado e convites para o Comitê. Suporte a leitura individual ou em massa."
  },
  {
    icon: History, color: "text-slate-700", border: "border-l-slate-700",
    label: "Exportações", href: "/exportacoes",
    desc: "Histórico completo de documentos gerados pela plataforma: Atas de Reunião (PDF e Word), Organogramas (PDF), Relatórios de Métricas (PDF) e planilhas Excel de ativos. Cada registro mostra quem gerou, quando, tamanho do arquivo e permite re-download. Suporte a exclusão e pesquisa por tipo ou data."
  },
  {
    icon: UserCog, color: "text-gray-700", border: "border-l-gray-700",
    label: "Gestão de Papéis", href: "/papeis",
    desc: "Administração de permissões de usuários. Papéis disponíveis: admin, data_owner, data_steward, viewer. Administradores podem promover ou rebaixar usuários. Controle de acesso baseado em papel (RBAC) aplicado a todas as rotas sensíveis da API."
  },
  {
    icon: ShieldAlert, color: "text-red-700", border: "border-l-red-700",
    label: "Relatório LGPD", href: "/lgpd",
    desc: "Consolida o Inventário de Dados Pessoais e Sensíveis exigido por reguladores e gera o Sumário do Relatório de Impacto à Proteção de Dados (RIPD). Suporta filtros rápidos e exportação completa em formato CSV."
  },
  {
    icon: ClipboardCheck, color: "text-orange-700", border: "border-l-orange-700",
    label: "Avaliações de Impacto (PIA)", href: "/pia",
    desc: "Plataforma para conduzir avaliações de impacto à proteção de dados (PIA/DPIA) em conformidade com o art. 38 da LGPD. Registra finalidades, bases legais, retenção e recomendações do DPO."
  },
  {
    icon: TrendingUp, color: "text-emerald-700", border: "border-l-emerald-700",
    label: "Maturidade de Dados", href: "/maturidade",
    desc: "Scorecard de governança em 5 dimensões (Descrição, Governança, Qualidade, Acessos, Glossário) calculado dinamicamente com base nas informações do catálogo, incluindo drill-down interativo e recomendações automatizadas."
  },
];

const scoringRules = [
  {
    icon: Scale, color: "border-l-blue-600", iconColor: "text-blue-600",
    title: "Business Value Score",
    subtitle: "Priorização estratégica de ativos",
    items: [
      { label: "Criticidade Operacional (40%)", desc: "O ativo é essencial para continuidade de processos críticos de negócio (produção, faturamento, logística)? Ativos marcados como 'crítico' recebem pontuação máxima neste pilar." },
      { label: "Impacto Regulatório (35%)", desc: "Dados classificados como 'restrito' ou 'confidencial' sob a LGPD ou normativas da ANM (Agência Nacional de Mineração) recebem peso máximo, pois exigem controles rigorosos." },
      { label: "Uso Estratégico (25%)", desc: "Frequência de acesso pelos usuários, quantidade de dashboards de BI que dependem deste ativo e o número de domínios que o consomem. Ativos amplamente utilizados recebem maior pontuação." },
    ]
  },
  {
    icon: Activity, color: "border-l-green-600", iconColor: "text-green-600",
    title: "Data Health Score",
    subtitle: "Qualidade técnica e de metadados",
    items: [
      { label: "Completude de Metadados", desc: "Verifica se os campos obrigatórios estão preenchidos: descrição técnica, descrição de negócio, responsável (Data Owner), classificação de sensibilidade, domínio e sistema de origem." },
      { label: "Acurácia (Completude dos Registros)", desc: "Percentual de campos não nulos nos dados reais do ativo, calculado automaticamente pelo Quality Engine a cada ciclo de sincronização." },
      { label: "Unicidade", desc: "Percentual de registros sem duplicatas. Um limiar de 100% é exigido por padrão, mas pode ser configurado por ativo no módulo de Qualidade." },
      { label: "Linhagem Mapeada", desc: "Bônus de qualidade para ativos cujo fluxo de origem até consumo está completamente mapeado na plataforma." },
    ]
  },
  {
    icon: Star, color: "border-l-amber-500", iconColor: "text-amber-500",
    title: "Selos de Certificação",
    subtitle: "Níveis de maturidade dos ativos",
    items: [
      { label: "🥉 Bronze - Raw", desc: "Metadados básicos preenchidos: nome, descrição e domínio definidos. Score de qualidade entre 40% e 69%." },
      { label: "🥈 Silver - Cleansed", desc: "Linhagem mapeada e responsáveis (Data Owner + Data Steward) vinculados. Score entre 70% e 89%." },
      { label: "🥇 Gold - Curated", desc: "Todas as métricas de qualidade acima dos limiares configurados, aprovação pelo Data Steward e linhagem completa. Score ≥ 90%." },
    ]
  },
];

const roles = [
  { role: "Data Owner", color: "bg-blue-100 text-blue-800", desc: "Responsável executivo pelo domínio de dados. Aprova acessos, define políticas de classificação e garante a qualidade estratégica dos ativos sob sua responsabilidade." },
  { role: "Data Steward", color: "bg-indigo-100 text-indigo-800", desc: "Curador operacional dos dados. Mantém o catálogo atualizado, valida metadados, aplica regras de qualidade e é o ponto de contato técnico para dúvidas sobre os ativos." },
  { role: "Product Owner", color: "bg-amber-100 text-amber-800", desc: "Define as prioridades de capacidades de dados alinhadas ao roadmap de produto. Participa das reuniões do Comitê representando a visão de produto." },
  { role: "Project Manager", color: "bg-orange-100 text-orange-800", desc: "Coordena iniciativas de dados e projetos de governança. Gerencia o checklist de implantação e acompanha o progresso das entregas." },
  { role: "AI Owner", color: "bg-purple-100 text-purple-800", desc: "Responsável pelos modelos e iniciativas de Inteligência Artificial. Garante que os dados usados nos modelos estejam catalogados e em conformidade com as políticas de dados." },
  { role: "AI Steward", color: "bg-violet-100 text-violet-800", desc: "Operacionaliza as políticas de IA definidas pelo AI Owner. Monitora a qualidade dos dados de treinamento e mantém a documentação dos modelos." },
  { role: "AI Ethics Officer", color: "bg-rose-100 text-rose-800", desc: "Avalia os riscos éticos e de viés nos modelos de IA. Garante conformidade com políticas de IA responsável e LGPD no contexto de modelos preditivos." },
  { role: "ML Engineer", color: "bg-cyan-100 text-cyan-800", desc: "Constrói e mantém pipelines de dados para ML. Atua na camada de transformação (Azure Data Factory / Databricks) e garante a rastreabilidade dos dados de treino." },
  { role: "Data Engineer", color: "bg-sky-100 text-sky-800", desc: "Desenvolve e mantém as integrações e pipelines de dados. Responsável pela ingestão de dados do SAP HANA, Salesforce e fontes IoT para o Snowflake." },
  { role: "Data Architect", color: "bg-slate-100 text-slate-800", desc: "Define os padrões de modelagem, taxonomia de domínios e arquitetura da plataforma de dados. Valida decisões técnicas de catalogação e linhagem." },
];

const automations = [
  { icon: RefreshCw, color: "text-purple-600", label: "MetadataScheduler", freq: "A cada 1 hora", desc: "Varre os conectores SAP HANA e Snowflake para descobrir novos ativos e sincronizar metadados com o catálogo. Ao final, aciona o QualityEngine." },
  { icon: Activity, color: "text-green-600", label: "QualityEngine", freq: "Após cada ciclo de metadados", desc: "Executa testes de completude e unicidade em todos os ativos cadastrados. Persiste os resultados na tabela de qualidade e atualiza os scores exibidos no catálogo." },
  { icon: CalendarDays, color: "text-sky-600", label: "AttendanceScheduler", freq: "A cada 5 minutos", desc: "Sincroniza a presença de participantes em reuniões encerradas há 10 minutos ou mais, garantindo que as atas reflitam os presentes reais." },
  { icon: AlertTriangle, color: "text-red-600", label: "TicketAlertScheduler", freq: "Diariamente às 8h", desc: "Verifica tickets de alta e crítica prioridade sem atualização há mais de 7 dias e envia notificações automáticas para os responsáveis pelo domínio afetado." },
];

export default function Home() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-[#1B3A8C]">Documentação & Ajuda</h1>
        <p className="text-muted-foreground text-lg">
          Referência completa de funcionalidades, regras de negócio e manual de usabilidade da plataforma.
        </p>
      </div>

      <Tabs defaultValue="funcionalidades" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="funcionalidades" className="gap-2">
            <Info size={18} />
            Regras & Funcionalidades
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-2">
            <Book size={18} />
            Manual de Usabilidade
          </TabsTrigger>
        </TabsList>

        {/* ─── ABA 1: REGRAS & FUNCIONALIDADES ─── */}
        <TabsContent value="funcionalidades" className="space-y-10">

          {/* Módulos do sistema */}
          <section>
            <h2 className="text-xl font-bold text-[#1B3A8C] mb-1 flex items-center gap-2">
              <LayoutDashboard size={20} /> Módulos da Plataforma
            </h2>
            <p className="text-sm text-muted-foreground mb-5">Descrição detalhada de todos os módulos disponíveis no menu lateral.</p>
            <Accordion type="single" collapsible className="w-full space-y-2">
              {modules.map((mod, idx) => (
                <AccordionItem key={idx} value={`mod-${idx}`} className={`border-l-4 ${mod.border} rounded-lg border border-gray-200 px-4`}>
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <mod.icon size={20} className={mod.color} />
                      <span className="font-semibold text-gray-900">{mod.label}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-600 leading-relaxed pb-4 pl-8">
                    {mod.desc}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>

          {/* Regras de Scoring */}
          <section>
            <h2 className="text-xl font-bold text-[#1B3A8C] mb-1 flex items-center gap-2">
              <Target size={20} /> Lógica de Scoring & Certificação
            </h2>
            <p className="text-sm text-muted-foreground mb-5">Entenda como os scores de valor de negócio e saúde dos dados são calculados automaticamente.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {scoringRules.map((rule, idx) => (
                <Card key={idx} className={`border-l-4 ${rule.color} shadow-sm`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <rule.icon size={18} className={rule.iconColor} />
                      {rule.title}
                    </CardTitle>
                    <CardDescription>{rule.subtitle}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible>
                      {rule.items.map((item, i) => (
                        <AccordionItem key={i} value={`rule-${idx}-${i}`} className="border-b border-gray-100">
                          <AccordionTrigger className="text-sm font-medium text-gray-800 hover:no-underline py-2">
                            {item.label}
                          </AccordionTrigger>
                          <AccordionContent className="text-xs text-gray-600 leading-relaxed pb-2">
                            {item.desc}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Papéis e Responsabilidades */}
          <section>
            <h2 className="text-xl font-bold text-[#1B3A8C] mb-1 flex items-center gap-2">
              <Users size={20} /> Papéis e Responsabilidades
            </h2>
            <p className="text-sm text-muted-foreground mb-5">Definição oficial de cada papel no Lucid Data Governance.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roles.map((r, idx) => (
                <div key={idx} className="flex gap-4 p-4 border rounded-lg bg-white hover:bg-gray-50 transition-colors">
                  <Badge className={`${r.color} shrink-0 h-fit mt-0.5 border-0`}>{r.role}</Badge>
                  <p className="text-sm text-gray-600 leading-relaxed">{r.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Automações */}
          <section>
            <h2 className="text-xl font-bold text-[#1B3A8C] mb-1 flex items-center gap-2">
              <Zap size={20} /> Automações & Agendadores
            </h2>
            <p className="text-sm text-muted-foreground mb-5">Processos automáticos que rodam em segundo plano para manter os dados atualizados.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {automations.map((a, idx) => (
                <div key={idx} className="p-5 border rounded-xl bg-white flex gap-4 items-start hover:shadow-sm transition-shadow">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <a.icon size={20} className={a.color} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900">{a.label}</span>
                      <Badge variant="outline" className="text-xs font-normal flex items-center gap-1">
                        <Clock size={10} /> {a.freq}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{a.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ técnico */}
          <section>
            <h2 className="text-xl font-bold text-[#1B3A8C] mb-1 flex items-center gap-2">
              <HelpCircle size={20} /> Perguntas Frequentes (FAQ)
            </h2>
            <p className="text-sm text-muted-foreground mb-5">Dúvidas técnicas e de processo mais comuns dos usuários da plataforma.</p>
            <Card>
              <CardContent className="pt-4">
                <Accordion type="single" collapsible className="w-full">
                  {[
                    {
                      q: "Por que meu ativo ainda está com score baixo mesmo após preencher todos os campos?",
                      a: "O score de qualidade é atualizado pelo QualityEngine a cada ciclo automático (a cada hora). Se você acabou de preencher os metadados, aguarde o próximo ciclo ou acesse o módulo de Qualidade e acione a validação manual clicando em 'Executar Testes'."
                    },
                    {
                      q: "Como faço para solicitar acesso a um dado restrito?",
                      a: "No Catálogo de Dados, localize o ativo desejado e clique nos três pontos (⋯) ao lado do nome. Selecione 'Solicitar Acesso'. Um modal será aberto para você informar a justificativa de negócio. Ao confirmar, um ticket é criado automaticamente no ServiceNow e o Data Owner do domínio recebe uma notificação para aprovação conforme o SLA definido."
                    },
                    {
                      q: "O que acontece quando um ticket de alta prioridade fica sem resposta?",
                      a: "O TicketAlertScheduler executa diariamente às 8h e verifica tickets de prioridade Alta ou Crítica sem atualização há mais de 7 dias. Ao detectar, envia automaticamente notificações para os responsáveis pelo domínio afetado e registra o alerta no histórico de notificações."
                    },
                    {
                      q: "Como o sistema detecta conflito de horário em reuniões?",
                      a: "Ao criar uma reunião, antes de salvar, o sistema consulta todas as reuniões já cadastradas no mesmo domínio e verifica sobreposição de horário. Se houver conflito, um aviso é exibido com os detalhes da reunião conflitante para que o organizador decida como proceder."
                    },
                    {
                      q: "O que são os códigos INT e como são gerados?",
                      a: "Ao submeter uma demanda no módulo 'Entrada de Demandas', o sistema gera automaticamente um código único no formato INT-AAAAMMDD-NNN (ex: INT-20260529-001). 'AAAAMMDD' é a data de criação e 'NNN' é um sequencial diário com três dígitos. O código garante rastreabilidade da demanda em todo o ciclo de vida, do intake até a entrega."
                    },
                    {
                      q: "Como funciona o sistema de prioridade P1-P4 nas demandas?",
                      a: "Após a submissão, membros com papel de admin, Data Owner ou Data Steward realizam a triagem usando a Matriz de Priorização com 8 critérios: Impacto Financeiro (peso 10), Urgência/SLA (10), Alcance/Usuários Impactados (8), Alinhamento Estratégico (8), Completude da Demanda (6), Viabilidade Técnica (5), Potencial de Reuso (4) e Engajamento do Data Owner (4). Cada critério é pontuado de 1 a 3. O resultado define o tier: P1 (≥ 85 pts, SLA: 2 dias úteis), P2 (≥ 70 pts, SLA: 5 dias úteis), P3 (≥ 60 pts, SLA: 15 dias úteis) ou P4 (< 60 pts, Backlog sem SLA definido)."
                    },
                    {
                      q: "Como usar a aba 'Pauta do Comitê' no módulo de Intake?",
                      a: "A aba 'Pauta do Comitê' (visível apenas para admin, Data Owner e Data Steward) exibe todas as demandas que estão em triagem ou aguardando votação do Comitê, organizadas em três seções: 'Em Triagem — Aguardando Score P1-P4', 'Aprovação Estratégica — Votação em Curso' e 'Aprovação Operacional — Aguardando Início'. Clique em qualquer card para abrir os detalhes completos da demanda, incluindo o painel de triagem, formulário completo das seções A-H e histórico de execução."
                    },
                    {
                      q: "O que mostra a aba 'Implementação' no módulo de Intake?",
                      a: "A aba 'Checklist de Implementação' exibe todas as demandas aprovadas e em fase de execução. Para cada demanda, mostra um card com barra de progresso e 5 etapas visuais: Kickoff → Desenvolvimento → Qualidade → Entrega → Validação. As etapas são preenchidas automaticamente conforme o status avança (Em Execução, Em Validação, Concluído). Clique no card para gerenciar a execução diretamente pelo painel de ações."
                    },
                    {
                      q: "O Assistente de IA tem acesso aos meus dados reais?",
                      a: "Não. O Assistente de IA é um chatbot baseado em LLM treinado com documentações públicas sobre governança de dados, LGPD e boas práticas de plataforma. Ele não acessa o banco de dados da aplicação nem informações confidenciais dos ativos cadastrados."
                    },
                    {
                      q: "Como exportar um relatório de métricas?",
                      a: "Acesse o módulo 'Exportações' no menu Operacional. Clique em 'Novo Documento', selecione o tipo 'Relatório de Métricas (PDF)' e confirme. O relatório será gerado assincronamente e aparecerá no histórico assim que pronto, disponível para download."
                    },
                    {
                      q: "Qual é a diferença entre Data Owner e Data Steward?",
                      a: "O Data Owner é o responsável executivo e de negócio pelo domínio: toma decisões sobre acesso, política de uso e classificação dos dados. O Data Steward é o responsável operacional: mantém o catálogo atualizado, valida metadados e é o ponto de contato técnico do dia a dia."
                    },
                    {
                      q: "Como interpretar o gráfico Radar no módulo de Compliance LGPD?",
                      a: "O gráfico Radar exibe 5 eixos de conformidade para os dados sensíveis: Catalogação (metadados preenchidos), Proteção (acesso restrito configurado), Linhagem (fluxo mapeado), Qualidade (score acima do limiar) e Aprovação (validado pelo Data Steward). Quanto mais preenchida a área, maior a maturidade de compliance."
                    },
                  ].map((faq, idx) => (
                    <AccordionItem key={idx} value={`faq-${idx}`}>
                      <AccordionTrigger className="text-blue-900 font-semibold text-left hover:no-underline">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-gray-600 leading-relaxed">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        {/* ─── ABA 2: MANUAL DE USABILIDADE ─── */}
        <TabsContent value="manual" className="space-y-10">

          {/* Passo a passo por módulo */}
          <section>
            <h2 className="text-xl font-bold text-[#1B3A8C] mb-1 flex items-center gap-2">
              <FileText size={20} /> Guia Passo a Passo por Módulo
            </h2>
            <p className="text-sm text-muted-foreground mb-5">Instruções detalhadas de como usar cada funcionalidade da plataforma.</p>
            <Accordion type="multiple" className="w-full space-y-2">
              {[
                {
                  idx: 1, icon: Search, title: "Como pesquisar no Catálogo de Dados",
                  steps: [
                    "Acesse 'Catálogo de Dados' no menu lateral (ícone de banco de dados).",
                    "Digite um termo no campo de busca: pode ser o nome técnico (ex: TB_VENDA_SAP), nome de negócio (ex: Faturamento) ou qualquer palavra-chave.",
                    "Use o filtro 'Região / Domínio' no topo para restringir a busca a um domínio específico (ex: Cimento, Agregados, Logística).",
                    "Clique no número de Consumidores do ativo para abrir o painel lateral com detalhes completos de consumo, dashboards associados e histórico de acessos.",
                    "Use o menu de três pontos (⋯) para ações rápidas: 'Detalhes de Consumo' (abre painel lateral), 'Dicionário Global' (vai ao Dicionário de Dados), 'Linhagem de Fluxo' (vai ao mapa de linhagem) ou 'Solicitar Acesso' (abre formulário de solicitação que gera um ticket automático no ServiceNow)."
                  ]
                },
                {
                  idx: 2, icon: ShieldCheck, title: "Como monitorar a qualidade de um ativo",
                  steps: [
                    "Acesse 'Qualidade de Dados' no menu lateral.",
                    "Use a barra de pesquisa para encontrar o ativo desejado.",
                    "Clique no nome do ativo para ver o painel de detalhes com os scores de Completude e Unicidade.",
                    "Para configurar limiares personalizados, clique no ícone de engrenagem (⚙️) ao lado do ativo.",
                    "Defina os percentuais mínimos de completude e unicidade e clique em 'Salvar Regras'.",
                    "O sistema executará os testes automaticamente a cada hora. Para execução imediata, clique em 'Executar Testes'."
                  ]
                },
                {
                  idx: 3, icon: Ticket, title: "Como abrir e acompanhar um ticket no ServiceNow",
                  steps: [
                    "Acesse 'ServiceNow' no menu Operacional.",
                    "Clique no botão '+ Novo Ticket' no canto superior direito.",
                    "Preencha o título, descrição, domínio afetado e prioridade (Crítica, Alta, Média ou Baixa).",
                    "Clique em 'Criar Ticket'. O sistema enviará automaticamente para o ServiceNow e exibirá o número do chamado.",
                    "Para acompanhar, use os filtros de status na parte superior da lista (Novo, Em Andamento, Pendente, Resolvido).",
                    "Tickets de alta/crítica prioridade sem atualização há 7+ dias recebem uma tag de alerta em vermelho."
                  ]
                },
                {
                  idx: 4, icon: CalendarDays, title: "Como agendar uma reunião do Comitê",
                  steps: [
                    "Acesse 'Reuniões' no menu Operacional.",
                    "Clique em '+ Nova Reunião'.",
                    "Preencha título, tipo (Ordinária, Extraordinária, Workshop ou Piloto), data e hora de início e fim.",
                    "Informe o local físico e/ou o link do Teams para acesso remoto.",
                    "Selecione o domínio responsável pela reunião.",
                    "Clique em 'Criar'. O sistema verificará conflitos de horário automaticamente antes de salvar.",
                    "Após a reunião, acesse os detalhes e exporte a ata em PDF ou Word pelo botão 'Exportar Ata'."
                  ]
                },
                {
                  idx: 5, icon: Network, title: "Como visualizar e gerenciar a linhagem de dados",
                  steps: [
                    "Acesse 'Linhagem' no menu Catálogo & Ativos.",
                    "Para ver a linhagem de um ativo específico (ex: dim_canal), pesquise pelo nome no campo de busca e clique no resultado.",
                    "Detecção Automática (Multipadronizada): O motor identifica e monta o grafo usando tanto a convenção clássica de camadas (bronze → silver → gold) quanto modelagem dimensional (dim_ → fato_ no mesmo esquema).",
                    "Ingestão Inteligente (SQL/dbt): No rodapé da tela de linhagem, você pode colar queries SQL complexas (JOINs, INSERTs) ou o arquivo manifest.json do seu projeto dbt para importar fluxos personalizados.",
                    "Inspector & Simulador What-If: Ao clicar em um nó, use a barra lateral para ver detalhes ou use o botão 'Simular Mudança' para analisar o impacto em cascata (tabelas e dashboards downstream afetados)."
                  ]
                },
                {
                  idx: 6, icon: Bot, title: "Como usar o Assistente de IA",
                  steps: [
                    "Acesse 'Assistente IA' no menu Qualidade & Conformidade.",
                    "Digite sua pergunta no campo de texto na parte inferior da tela. Ex: 'Quais são os requisitos da LGPD para dados de RH?'",
                    "Alternativamente, clique em uma das sugestões de perguntas frequentes exibidas na tela inicial.",
                    "O assistente responderá em tempo real com formatação rica (listas, títulos, código).",
                    "O histórico da conversa é mantido durante a sessão. Para iniciar uma nova sessão, recarregue a página.",
                    "O assistente é especializado em: governança de dados, LGPD, Databricks, Snowflake, RACI e boas práticas de Lucid Data Governance."
                  ]
                },
                {
                  idx: 7, icon: History, title: "Como exportar relatórios e documentos",
                  steps: [
                    "Acesse 'Exportações' no menu Operacional.",
                    "Clique em 'Novo Documento' e selecione o tipo: Ata de Reunião (PDF ou Word), Organograma (PDF) ou Relatório de Métricas (PDF).",
                    "Para atas, selecione a reunião desejada na lista. Para outros tipos, confirme a geração.",
                    "O documento será gerado assincronamente. Ao finalizar, aparecerá na lista com status 'Concluído'.",
                    "Clique em 'Download' para baixar o arquivo. O histórico completo é mantido com data, hora, usuário e tamanho.",
                    "Para remover um documento do histórico, clique no ícone de lixeira (confirmação exigida)."
                  ]
                },
                {
                  idx: 8, icon: BookText, title: "Como pesquisar no Dicionário de Dados",
                  steps: [
                    "Acesse 'Dicionário' no menu Catálogo & Ativos.",
                    "Use o campo de busca para pesquisar por termos de negócio ou técnicos (ex: 'EBITDA', 'Faturamento Bruto').",
                    "Clique em um verbete para ver: definição completa, fórmula de cálculo, domínio, responsável e status de aprovação.",
                    "Administradores e Data Stewards podem editar verbetes clicando no ícone de lápis.",
                    "Termos aprovados pelo Comitê exibem um selo de verificação (✓) em verde.",
                    "Para exportar o dicionário completo, clique em 'Exportar CSV' no topo da página."
                  ]
                },
                {
                  idx: 9, icon: Lock, title: "Como verificar o status de Compliance LGPD",
                  steps: [
                    "Acesse 'Compliance LGPD' no menu Qualidade & Conformidade.",
                    "O painel exibe os KPIs principais: total de dados sensíveis, protegidos, em risco crítico e o score global.",
                    "O score de compliance é calculado como: (ativos sensíveis com qualidade ≥ 80%) ÷ (total de ativos sensíveis) × 100.",
                    "O gráfico radar mostra o nível de maturidade em 5 eixos: Catalogação, Proteção, Linhagem, Qualidade e Aprovação.",
                    "Use o campo de busca para localizar um ativo sensível específico e ver seu status detalhado.",
                    "Clique em qualquer ativo para navegar direto ao Catálogo com o painel de detalhes aberto."
                  ]
                },
                {
                  idx: 10, icon: Inbox, title: "Como submeter e gerenciar uma demanda ao Comitê (Intake)",
                  steps: [
                    "Acesse 'Entrada de Demandas' no menu. Clique em 'Nova Demanda' no canto superior direito.",
                    "Preencha as 7 seções do formulário: (A) Identificação — título, tipo, prioridade, área e submissor; (B) Caso de Uso — contexto, justificativa de negócio, domínios e usuários impactados; (C) Dados — sistemas de origem, ativos envolvidos, volume e frequência; (D) Qualidade — dimensões de DQ, score atual e metas; (E) Critérios de Sucesso — KPIs, hipóteses de valor e critérios de aceite; (F) Governança — data owner, steward e responsáveis técnicos; (G+H) Riscos e Declaração — riscos identificados, mitigações e aceite de políticas.",
                    "Ao confirmar, o sistema gera automaticamente o código INT-AAAAMMDD-NNN. A demanda aparece na lista com status 'Submetido'.",
                    "Usuários com papel Admin, Data Owner ou Data Steward acessam a aba 'Todas as Demandas' para ver todas as submissões. Clicam no item e acessam o painel de triagem.",
                    "No painel de triagem, pontue os 8 critérios (1 = Baixo, 2 = Médio, 3 = Alto). O score total (máx. 100 pts) define automaticamente o tier: P1 (≥ 85), P2 (≥ 70), P3 (≥ 60) ou P4 (< 60). Marque os 15 itens do checklist de conformidade e confirme.",
                    "Use a aba 'Ranking de Prioridade' para comparar todas as demandas triadas por score P1-P4 e SLA. A aba 'Pauta do Comitê' agrupa por estágio de votação. A aba 'Implementação' mostra o progresso de execução com barra de progresso e 5 etapas visuais.",
                    "Após aprovação, clique em 'Iniciar Execução' no painel de detalhes, preencha as notas de planejamento, marque como 'Entregue' ao concluir o desenvolvimento e depois 'Validar Entrega' para encerrar o ciclo como Concluído."
                  ]
                },
                {
                  idx: 11, icon: Trophy, title: "Como interpretar o Ranking de Prioridade P1-P4",
                  steps: [
                    "Acesse 'Entrada de Demandas' e clique na aba 'Ranking de Prioridade' (visível para admin, Data Owner e Data Steward).",
                    "A lista exibe todas as demandas que passaram pela triagem, ordenadas por score decrescente.",
                    "Cada linha mostra: código INT, título, submissor, badge do tier (P1/P2/P3/P4 com a pontuação), SLA e status atual.",
                    "P1 (vermelho) = Máxima prioridade, SLA de 2 dias úteis. P2 (laranja) = Alta prioridade, SLA de 5 dias. P3 (amarelo) = Média prioridade, SLA de 15 dias. P4 (verde) = Backlog, sem SLA definido.",
                    "Clique em qualquer linha para abrir os detalhes completos da demanda, incluindo os scores individuais de cada critério da triagem.",
                    "Demandas sem triagem realizada não aparecem no ranking — realize a triagem primeiro pelo painel de detalhes do item."
                  ]
                },
                {
                  idx: 12, icon: ShieldAlert, title: "Como gerar o Relatório LGPD & RIPD",
                  steps: [
                    "Acesse 'Relatório LGPD' no menu lateral sob o grupo Qualidade.",
                    "O painel exibe o total de ativos de dados do catálogo, destacando a quantidade classificada como restrita, confidencial ou sem Data Owner atribuído.",
                    "Analise o quadro 'Sumário RIPD' para ver uma síntese dos escopos de dados pessoais, riscos de curadoria sem proprietário designado e orientações sobre a Base Legal.",
                    "Use o filtro de busca textual ou selecione a classificação de interesse (ex: Restrito, Confidencial) para refinar a listagem de ativos.",
                    "Para baixar a base completa formatada para conformidade legal, clique no botão 'Exportar CSV' no canto superior direito."
                  ]
                },
                {
                  idx: 13, icon: ClipboardCheck, title: "Como criar e revisar uma Avaliação de Impacto (PIA)",
                  steps: [
                    "Acesse o módulo 'PIA' no menu lateral.",
                    "Para iniciar uma nova avaliação, clique em '+ Nova Avaliação' no canto superior direito.",
                    "Preencha as seções da avaliação: Nome do processo/ativo, finalidade do tratamento, base legal regulatória, tempo de retenção, se há transferência de dados, e riscos/medidas de mitigação.",
                    "Clique em 'Salvar' para arquivar a avaliação em status 'Rascunho'.",
                    "Usuários com papel DPO ou Administrador podem alterar o status (Rascunho, Em revisão, Aprovado, Rejeitado), adicionar notas de revisão e o parecer oficial do DPO."
                  ]
                },
                {
                  idx: 14, icon: TrendingUp, title: "Como auditar e evoluir o Scorecard de Maturidade de Dados",
                  steps: [
                    "Acesse 'Maturidade de Dados' no menu lateral.",
                    "O painel central exibe a nota geral do programa (0 a 100) e classifica a maturidade em Inicial, Repetível, Definido, Gerenciado ou Otimizado.",
                    "Analise o gráfico de radar para visualizar quais dimensões (Descrição, Governança, Qualidade, Acessos, Glossário) precisam de atenção prioritária.",
                    "Clique em qualquer indicador com pendências no grid 'Indicadores do Catálogo' (ex: 'Com Data Owner' ou 'Alta Qualidade') para abrir um painel lateral dinâmico (Sheet) listando precisamente os ativos que precisam ser corrigidos.",
                    "Role até o final da tela e siga as sugestões na seção 'Recomendações de Melhoria' para elevar a nota de maturidade do seu domínio."
                  ]
                },
              ].map((guide) => (
                <AccordionItem key={guide.idx} value={`guide-${guide.idx}`} className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-sm">
                        {guide.idx}
                      </div>
                      <guide.icon size={16} className="text-blue-700 shrink-0" />
                      <span className="font-semibold text-gray-900 text-left">{guide.title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pl-4">
                    <ol className="space-y-2">
                      {guide.steps.map((step, si) => (
                        <li key={si} className="flex gap-3 text-sm text-gray-700">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-blue-700 text-white text-xs flex items-center justify-center font-bold mt-0.5">{si + 1}</span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>

          {/* Atalhos e dicas */}
          <section>
            <h2 className="text-xl font-bold text-[#1B3A8C] mb-1 flex items-center gap-2">
              <Zap size={20} /> Dicas & Atalhos Úteis
            </h2>
            <p className="text-sm text-muted-foreground mb-5">Recursos que agilizam o uso cotidiano da plataforma.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { icon: Bell, title: "Notificações em tempo real", desc: "O sino no topo da tela exibe alertas não lidos. Clique nele para ver notificações de tickets, reuniões e aprovações pendentes sem sair da página atual." },
                { icon: Building2, title: "Filtro por Domínio", desc: "A maioria dos módulos (Catálogo, Qualidade, ServiceNow) possui filtro por domínio/região. Use-o para focar apenas nos ativos da sua área de responsabilidade." },
                { icon: MessageSquare, title: "Feedback & Sugestões", desc: "Utilize o módulo de Feedback para registrar sugestões de melhoria, reportar inconsistências nos dados ou solicitar novos verbetes no dicionário." },
                { icon: BarChart3, title: "Dashboard como ponto de partida", desc: "O Portal de Governança (tela inicial) exibe os KPIs mais importantes. Use-o para ter uma visão rápida do estado geral antes de navegar para módulos específicos." },
                { icon: CheckCircle2, title: "Checklist de Implantação", desc: "Se você está iniciando um novo programa de governança em seu domínio, o Checklist de Implantação oferece um roteiro estruturado com as etapas obrigatórias e recomendadas." },
                { icon: Settings2, title: "Preferências de Alerta (Tickets)", desc: "Administradores podem configurar os limiares de alerta de tickets por domínio em 'Configurações de Alerta'. O padrão global é: Crítico = 3 dias, Alta = 7 dias." },
                { icon: Inbox, title: "Intake: rastreie pelo código INT", desc: "Cada demanda submetida ganha um código único INT-AAAAMMDD-NNN visível na listagem e no detalhe. Use-o para referenciar a demanda em e-mails, reuniões e tickets do ServiceNow sem ambiguidade." },
                { icon: ListChecks, title: "Triagem P1-P4: faça antes de votar", desc: "A aba 'Pauta do Comitê' mostra demandas em triagem e votação. Para priorizar corretamente, realize sempre a triagem (8 critérios ponderados) antes de aprovar — o tier P1-P4 e o SLA são calculados automaticamente." },
              ].map((tip, idx) => (
                <div key={idx} className="flex gap-4 p-4 border rounded-xl bg-white hover:bg-blue-50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <tip.icon size={18} className="text-blue-700" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 mb-1">{tip.title}</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{tip.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Download e treinamento */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-8 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col justify-between gap-6">
              <div>
                <h3 className="text-xl font-bold text-blue-900 flex items-center gap-2 mb-2">
                  <Download size={20} /> Manual Completo (PDF)
                </h3>
                <p className="text-sm text-blue-700 mb-1">Versão atualizada em maio de 2026</p>
                <p className="text-sm text-gray-600">Contém todos os módulos, regras de scoring, papéis e responsabilidades, FAQ e guias passo a passo desta documentação em formato offline.</p>
              </div>
              <div
                title="PDF em elaboração — disponível em breve"
                className="self-start px-6 py-3 bg-gray-200 text-gray-400 rounded-xl font-semibold flex items-center gap-2 cursor-not-allowed select-none"
              >
                <Download size={16} /> Em breve — PDF em elaboração
              </div>
            </div>

            <div className="relative rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center p-10 text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Treinamento Concluído?</h3>
                <p className="text-muted-foreground mt-2 text-sm max-w-xs">
                  Se você já domina as funcionalidades básicas, pode se candidatar a Multiplicador de Governança no seu domínio e ajudar outros colaboradores.
                </p>
              </div>
              <a
                href="https://vcimentos.csod.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2 bg-green-700 text-white rounded-xl hover:bg-green-800 transition-colors font-semibold flex items-center gap-2"
              >
                Acessar Portal de Treinamento →
              </a>
            </div>
          </section>

        </TabsContent>
      </Tabs>
    </div>
  );
}
