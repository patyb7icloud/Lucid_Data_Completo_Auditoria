# Manual de Usabilidade e Funcionalidades
**Portal de Governança e Lucid Data Governance**

---

## 1. Visão Geral do Sistema

O Portal de Governança e Lucid Data Governance é a plataforma centralizada para gestão de metadados, qualidade, privacidade e fluxos de aprovação da Lucid Data Governance. O sistema é estruturado em módulos lógicos que cobrem desde a descoberta de dados até a orquestração de agentes de inteligência artificial.

Este manual descreve todas as funcionalidades disponíveis, atualizado até a versão 1.2.0.

---

## 2. Visão Executiva

### 2.1. Dashboard Central
O Dashboard Central fornece a visão consolidada de todos os indicadores da plataforma.
- **Navegação Interativa (Drill-down):** Os cards de KPI (Ativos, Domínios, Participantes, Reuniões) são clicáveis e redirecionam o usuário para as respectivas telas de detalhamento.
- **Resumo de Qualidade:** Gráficos de evolução da qualidade de dados e alertas de SLA recentes.
- **Demandas Recentes:** Acompanhamento do status das solicitações de acesso e intake.

### 2.2. Maturidade de Dados
Acompanhamento da evolução da governança por domínio de dados.
- **Drill-down de Ativos Globais:** O badge "Ativos Globais" é sempre clicável e abre um painel lateral listando todos os ativos, suas regiões, sistemas de origem e score de qualidade.
- **Badges de Ação:** Indicadores visuais clicáveis para pendências (sem descrição, sem owner, sem steward).
- **Heatmap de Qualidade:** Matriz cruzando domínios com dimensões de qualidade (Completude, Unicidade, Validade).

### 2.3. Checklist de Implantação
Módulo para acompanhamento do rollout do programa de governança.
- **Fases de Maturidade:** Estruturação, Catalogação, Qualidade e Governança.
- **Progresso por Domínio:** Barra de progresso calculada automaticamente com base nas tarefas concluídas.

---

## 3. Descoberta e Catálogo

### 3.1. Catálogo de Dados
O inventário central de todos os ativos de dados da companhia (Tabelas, Relatórios, APIs).
- **Drill-down de KPIs:** Os 4 cards principais (Ativos Globais, Saúde Média, Regiões Ativas, Governança) são clicáveis e abrem modais com as listas detalhadas e filtradas.
- **Orquestração de Agentes de Governança:** No menu de ações de cada ativo, a opção "Executar Agentes" dispara um pipeline de IA com 4 etapas:
  1. **Inspeção:** Leitura e catalogamento de metadados.
  2. **Classificação:** Aplicação de tags de governança e detecção de PII.
  3. **Documentação:** Geração de relatório markdown e sugestão de termos de glossário.
  4. **Auditoria:** Avaliação de risco e conformidade.
- **Relatório Detalhado do Run ID:** Após a execução do pipeline, um relatório completo fica disponível, exibindo KPIs (duração, colunas PII, score de risco), raciocínio do agente LLM e metadados de rastreabilidade.

### 3.2. Dicionário e Curadoria
Interface para enriquecimento de metadados.
- **Classificação de Colunas:** Tipagem técnica, descrição de negócio e marcação de dados sensíveis.
- **Curadoria em Lote:** Aprovação ou rejeição de sugestões geradas por IA.

### 3.3. Linhagem de Dados
Visualização gráfica de como os dados fluem pelos sistemas.
- **Grafo Interativo:** Navegação do SAP HANA até os dashboards do Power BI.
- **Propagação de Alertas:** Impactos de qualidade ou quebras de SLA são propagados visualmente (em cascata) para os ativos dependentes.
- **What-if Analysis:** Simulador para estimar o impacto de uma mudança estrutural antes que ela ocorra.

### 3.4. Glossário de Negócios
Dicionário corporativo para padronização de conceitos e métricas.
- **Workflow de Aprovação:** Termos nascem como "Rascunho", passam por "Revisão" e são "Aprovados" pelo Comitê.
- **Vinculação:** Termos podem ser vinculados diretamente a ativos do catálogo.

---

## 4. Privacidade e Segurança

### 4.1. Portal LGPD & Privacidade
Central de conformidade com a Lei Geral de Proteção de Dados.
- **Drill-down de Conformidade:** Cards de KPI (Ativos Sensíveis, Protegidos, Sob Risco, Em Conformidade) abrem modais com a lista de ativos correspondentes, incluindo busca e badge de classificação (Restrito/Confidencial).
- **Inventário e RIPD:** Registro de Operações de Tratamento de Dados Pessoais (ROPA).
- **Avaliações (PIA/DPIA):** Questionários de avaliação de impacto à privacidade.
- **Direitos do Titular (DSAR):** Workflow para atendimento a solicitações de exclusão ou portabilidade.

### 4.2. Autonomia por Tier
Gestão do modelo de maturidade de autonomia para áreas de negócio.
- **Drill-down de Autonomia:** Cards de KPI (Domínios, Sem Tier, Pendentes, Aprovados, Sincronizados) exibem modais detalhados com o status de cada domínio.
- **Sincronização Databricks:** Integração com o Unity Catalog para aplicação de políticas baseadas no tier aprovado.

### 4.3. Tags Governadas e Políticas PII
- **Drill-down de Tags:** Cards (Políticas Ativas, Tags Atribuídas, Compliance, Pendente Sync) abrem listas detalhadas das políticas de classificação aplicadas aos dados.
- **Data Contracts:** Trava sistêmica que impede alterações (breaking changes) em ativos que possuem contratos ativos com consumidores.

---

## 5. Operação e Qualidade

### 5.1. Qualidade e SLA
Monitoramento contínuo da saúde dos dados.
- **Motor de Qualidade:** Execução de regras (Completude, Validade, Consistência, Unicidade) com adaptadores para múltiplos bancos de dados.
- **Histórico e Snapshots:** Armazenamento do histórico de scores para análise de tendência.

### 5.2. Gestão de Demandas (Intake)
Portal completo de submissão e triagem de solicitações ao Comitê.
- **Formulário Multi-Step:** 7 etapas guiadas (Identificação, Caso de Uso, Dados, Qualidade, Critérios, Governança, Riscos).
- **Matriz P1–P4:** Cálculo automático de prioridade baseado em 8 critérios (Impacto, Urgência, Alcance, etc.), gerando um SLA de atendimento (2 a 15 dias).
- **Pauta do Comitê:** Visão Kanban agrupando demandas em Triagem, Aprovação Estratégica e Operacional.

### 5.3. Reuniões e Organização
- **Organização do Comitê:** Drill-down nos cards de Membros, Contas Ativas, Pendentes e Administradores.
- **Matriz RACI:** Definição clara de papéis (Responsible, Accountable, Consulted, Informed) por domínio.
- **Gestão de Reuniões:** Agendamento, pautas, registro de decisões e geração de Atas em PDF com identidade visual da Lucid Data Governance.

---

## 6. Configurações e Integrações

### 6.1. Conectores e Marketplace
- **Marketplace Interno:** Ativação de conectores nativos (SAP HANA, Snowflake, MySQL, PostgreSQL, Databricks).
- **Integração ServiceNow:** Criação automática de tickets (INC/RITM) para falhas de qualidade ou solicitações de acesso.

### 6.2. Notificações e Webhooks
- **Motor de E-mail:** Envio de alertas SMTP formatados em HTML com fila de reenvio.
- **Webhook Engine:** Disparo de eventos HTTP com assinatura HMAC-SHA256 para integração com sistemas externos.

---
*Gerado automaticamente pelo sistema — Versão 1.2.0*
