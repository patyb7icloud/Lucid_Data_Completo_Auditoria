# Changelog

Todas as mudanças notáveis neste projeto são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/)
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [1.2.1] — 2026-07-08 🛠️ Migração Definitiva para PostgreSQL & Preparação para Produção

### Corrigido
- Removida a dependência `mysql2` do banco principal — a aplicação agora usa exclusivamente PostgreSQL 16 (o pacote `mysql2` passa a ser opcional, apenas para o adaptador de qualidade de fontes MySQL externas)
- Scripts utilitários (`create-admin.js`, `create-settings-table.js`, `create-tag-policies.cjs`, `promote-admins.js`, `reset-password.js`, `test-full-flow.mjs`) migrados de `mysql2` para `pg` com placeholders `$1..$n` e `DATABASE_URL` obrigatória
- Removidas credenciais e e-mails hardcoded do `reset-password.js` e `promote-admins.js` (agora parametrizados via variáveis de ambiente)
- Smoke test corrigido: aceitava apenas status `ok`/`degraded`, mas o endpoint `/api/health` retorna `healthy`/`degraded`
- Instrumentação OpenTelemetry alterada de `instrumentation-mysql2` para `instrumentation-pg`
- `env.example.txt`, `README.md`, `docs/OPERATIONS.md` e manual do administrador atualizados para PostgreSQL (`postgresql://...:5432`, `pg_dump`/`psql`)
- Endpoint de métricas documentado corretamente como `/api/metrics` (antes constava `/api/prometheus`)

---

## [1.2.0] — 2026-06-09 🤖 Orquestração de Agentes & Drill-down de KPIs

### Adicionado
- **Pipeline de Agentes de Governança** no Catálogo de Dados (Inspeção, Classificação, Documentação, Auditoria) com acompanhamento em tempo real
- **Relatório Detalhado do Run ID** com 4 abas (Classificação, PII, Documentação, Auditoria) e KPIs de execução (Duração, Colunas PII, Score de Risco, Conformidade)
- **Drill-down nos cards do Portal LGPD & Privacidade** (Ativos Sensíveis, Protegidos, Sob Risco, Em Conformidade) exibindo lista detalhada em modal
- **Drill-down nos cards de Autonomia por Tier** (Domínios, Sem Tier, Pendentes, Aprovados, Sincronizados)
- **Drill-down nos cards do Catálogo de Dados** (Ativos Globais, Saúde Média, Regiões Ativas, Governança)
- **Drill-down nos cards de Tags Governadas** (Políticas Ativas, Tags Atribuídas, Compliance, Pendente Sync)
- **Drill-down nos cards de Organização do Comitê** (Membros Comitê, Contas Ativas, Pendentes Acesso, Administradores)
- **Navegação interativa no Dashboard Central** (cards de KPI redirecionam para as telas correspondentes)

### Alterado
- Badge "Ativos Globais" na tela de Maturidade de Dados agora é sempre clicável e exibe a lista completa de ativos

### Corrigido
- Arquivo de migration original gerado com dialeto MySQL substituído por migration PostgreSQL correta (`serial`, `enum` nativo, `timestamp`)

---

## [1.1.0] — 2026-05-29 🎯 Módulo de Intake Completo

### Adicionado
- **Entrada de Demandas (Intake)** — portal completo de submissão e gestão de demandas ao Lucid Data Governance
- **Formulário Multi-Step (Seções A–H)** — 7 etapas guiadas: Identificação, Caso de Uso, Dados, Qualidade, Critérios de Sucesso, Governança e Riscos/Declaração com 40+ campos estruturados
- **Código INT único** — geração automática no formato `INT-AAAAMMDD-NNN` ao confirmar a submissão
- **Matriz de Priorização P1–P4** — 8 critérios ponderados (máx. 100 pts): Impacto Financeiro (×10), Urgência/SLA (×10), Alcance/Usuários (×8), Alinhamento Estratégico (×8), Completude da Demanda (×6), Viabilidade Técnica (×5), Potencial de Reuso (×4) e Engajamento Data Owner (×4)
- **Tiers de SLA automáticos** — P1 (≥ 85 pts → 2 dias úteis), P2 (≥ 70 pts → 5 dias úteis), P3 (≥ 60 pts → 15 dias úteis), P4 (< 60 pts → Backlog)
- **Checklist de Triagem (15 itens)** — validação completa de pré-requisitos antes da aprovação pelo Comitê
- **TierBadge** — badge visual P1/P2/P3/P4 com pontuação exibido na listagem, ranking e detalhe da demanda
- **Aba "Ranking de Prioridade"** — tabela de demandas triadas ordenada por score com tier, pontuação e SLA
- **Aba "Pauta do Comitê"** — visão do ritual de comitê agrupada por estágio (Em Triagem / Aprovação Estratégica / Aprovação Operacional) com cards formatados para pauta
- **Aba "Checklist de Implementação"** — acompanhamento pós-aprovação com barra de progresso e 5 etapas visuais (Kickoff → Desenvolvimento → Qualidade → Entrega → Validação) derivadas do status da demanda
- **Documentação & Ajuda atualizada** — módulo Intake adicionado ao guia de módulos, 4 novos FAQs, 2 guias passo a passo (Guia 10: Intake completo; Guia 11: Ranking P1-P4) e 2 novas dicas na seção de atalhos

### Alterado
- `IntakePage.tsx` — reescrita completa substituindo o formulário simples pelo wizard multi-step; componentes antigos (`NewIntakeDialog`, `ScoreSelector`, `getQuadrant`, `TriagePanel` legado e `IntakeDetailSheet` legado) removidos
- `IntakeRow` — exibe código INT + `TierBadge` na coluna de Prioridade / Tier
- Cabeçalho da tabela principal: "Prioridade" → "Prioridade / Tier"
- Filtro de status oculto nas abas Ranking, Comitê e Implementação; ao navegar para Comitê/Implementação, filtro é resetado automaticamente

### Infraestrutura
- Schema `drizzle/schema.ts` — 43 novos campos nas tabelas de intake (seções B–H, P1-P4 scores, `triageChecklist` JSON, `intakeCode`)
- `server/db.ts` — função `generateIntakeCode()` com lock sequencial diário
- `server/routers.ts` — endpoints `intake.create` (todos os campos A–H) e `intake.triage` (8 critérios, auto-calcula `totalScore` e `priorityTier`)

---

## [1.0.0] — 2026-05-17 🚀 Lançamento Comercial

### Adicionado
- **Catálogo de Dados** com suporte a sensibilidade, criticidade, tipo, domínio e owner
- **Motor de Qualidade** (QualityEngine) com adaptadores SAP HANA, MySQL e Portal nativo
- **Linhagem de Dados** com grafo interativo (React Flow), import via SQL parser e dbt manifest
- **Propagação Visual de Alertas em Cascata** no grafo de linhagem (cor por nível de risco)
- **Simulador What-if Analysis** para estimar impacto de mudanças de schema antes de aplicar
- **Data Contracts** com trava de Breaking Change (rejeita renomeação de ativos com contratos ativos)
- **Glossário de Negócios** com fluxo de aprovação (Rascunho → Revisão → Aprovado)
- **Lucid Data Governance**: reuniões, pautas, atas, convites, confirmações e organograma por domínio
- **Matriz RACI** interativa por domínio
- **Checklist de Implantação** por domínio com percentual de conclusão
- **Dashboard de Maturidade** com heatmap de qualidade por domínio e tendência histórica
- **Relatório LGPD** com identificação de dados pessoais e sensíveis (PII)
- **Avaliações PIA/DPIA** (Privacy Impact Assessment)
- **Requisições DSAR** (Data Subject Access Request) com workflow completo
- **SLA Configs** por ativo de dados com indicadores de violação
- **Webhook Engine** com retry, assinatura HMAC-SHA256 e toggle de ativação por integração
- **Sistema de Notificações por E-mail** (SMTP/Nodemailer) com templates HTML e fila de reenvio
- **Integração Microsoft Teams** para alertas de governança
- **Integração ServiceNow** com criação e rastreamento de tickets
- **API REST Pública v1** com autenticação via API Key e escopos granulares
- **Documentação Swagger/OpenAPI** em `/api/v1/docs` gerada automaticamente
- **Marketplace de Conectores** (SAP HANA, Snowflake, MySQL, PostgreSQL, Databricks)
- **Auto-Discovery Inteligente com IA** (LLM classifica sensibilidade e descreve colunas)
- **Log de Auditoria** completo com rastreabilidade de ações do usuário e da IA
- **Histórico de Qualidade** com snapshots temporais por ativo
- **Exportação PDF e DOCX** (atas, relatórios, organogramas) com identidade visual VC
- **Histórico de Exportações** rastreável por usuário
- **Multi-tenancy** com isolamento por `organizationId`
- **RBAC** (Admin / User) com controle de acesso por rota e procedimento tRPC
- **Autenticação local** (e-mail + senha, bcrypt) com reset por token e MFA opcional
- **SSO Microsoft Entra ID** (OIDC) e **SSO Google** via OAuth 2.0
- **Assistente de IA** integrado para recomendações de governança em linguagem natural
- **Endpoint `/api/health`** com latência de DB e status de uptime
- **Endpoint `/api/prometheus`** em formato Prometheus text para integração com Grafana
- **Caddyfile** com SSL automático (Let's Encrypt), compressão gzip/zstd, cabeçalhos de segurança e rate-limiting na rota `/api/*`
- **Docker Compose** com build multi-stage, usuário não-root, health check e volumes persistentes
- **Smoke test** de produção (`npm run smoke`)
- **Backup automatizado** do banco via `npm run backup:db`

### Segurança
- Senhas com bcrypt (salt rounds configuráveis)
- Sessions via JWT assinado (HS256, `jose`)
- Cookies HttpOnly + SameSite + Secure em produção
- Rate limiting na camada de API (Caddy) e nas rotas de autenticação (in-memory, por IP)
- API Keys com hash SHA-256 (jamais armazenadas em texto puro)
- Webhooks com assinatura HMAC-SHA256 para verificação de integridade
- Auto-Discovery de IA usa apenas metadados (nomes de tabelas/colunas), sem tráfego de dados pessoais

### Infraestrutura
- Node.js 22 + TypeScript 5.9 + tRPC v11 + Drizzle ORM + PostgreSQL 16
- React 19 + Vite 7 + Tailwind CSS v4 + Radix UI + Framer Motion + React Flow + Recharts
- pnpm workspaces, build otimizado com esbuild

---

## [0.9.0] — 2026-04-10 (Beta Fechado)

### Adicionado
- Funcionalidades centrais de catálogo e qualidade
- Integração ServiceNow e e-mail básico

---

## [0.5.0] — 2026-03-01 (Alpha Interno)

### Adicionado
- Estrutura inicial: schema Drizzle, tRPC, autenticação local, identidade visual VC
