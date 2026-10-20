# Lucid Data Governance — Roteiro de pitch de 2 minutos (PT/EN)

> **Formato:** cinco slides por idioma, aproximadamente 24 segundos por slide. A fala foi escrita para ficar perto de dois minutos; ensaie em voz alta e ajuste o ritmo. Conteúdo baseado no estado do código na branch `gestor_portifolio_documento_nexa`, commit `1e45824`.

## Mensagem central

**Português:** A Lucid conecta governança de dados à governança de IA e MLOps: organiza ativos e responsabilidades, registra iniciativas e riscos, acompanha estados e métricas, e usa agentes LLM para apoiar atividades de governança de dados.

**English:** Lucid connects data governance with AI governance and MLOps: it organizes assets and accountability, records initiatives and risks, tracks states and metrics, and uses LLM agents to support data-governance work.

---

# Versão em português

## Slide 1 — Governança para a era da IA | 0:00–0:24

**Mensagem:** IA depende de dados governados e de decisões rastreáveis.

**Texto na tela:**
- Lucid Data Governance
- Governança de dados + Governança de IA + MLOps
- De registros dispersos a processos rastreáveis

**Visual sugerido:** capa azul escura; fluxo sutil de dados conectados; destacar três pilares em uma linha.

**Fala:**
> “Muitas empresas estão ampliando o uso de inteligência artificial, mas definições, responsáveis, aprovações e riscos ainda ficam espalhados. A Lucid conecta governança de dados, governança de IA e MLOps em um único ambiente. O objetivo é tornar decisões e responsabilidades mais visíveis e rastreáveis.”

## Slide 2 — Do intake aos gates | 0:24–0:48

**Mensagem:** organizar uma iniciativa antes de avançar seu ciclo de vida.

**Texto na tela:**
- Intake → Go/No-Go → G0 Ideação → G1 Desenvolvimento → G2 Produção → G3 Monitoramento
- Checklists e evidências por etapa
- Decisões e responsáveis registrados

**Visual sugerido:** linha do tempo horizontal G0–G3, com um checkpoint de Go/No-Go e pequenos ícones de evidência.

**Fala:**
> “Para projetos de IA, a plataforma registra o intake, o risco declarado e a decisão Go ou No-Go. Depois, organiza gates de ideação, desenvolvimento, produção e monitoramento, com checklists e referências de evidência. Isso cria uma estrutura de revisão comum; integrações e execução automatizada precisam ser validadas por cliente.”

## Slide 3 — Pipeline multiagente com LLM | 0:48–1:12

**Mensagem:** IA apoia tarefas repetitivas de governança ligadas aos metadados catalogados.

**Texto na tela:**
- Metadados → Inspeção → PII e classificação → Documentação e glossário → Auditoria
- LLM + scanner heurístico de PII
- Revisão humana antes de políticas externas

**Visual sugerido:** diagrama de cinco etapas, destacando “dados de catálogo” como entrada e “rascunhos/evidências” como saída.

**Fala:**
> “Um diferencial técnico é o pipeline multiagente. Ele lê metadados e atributos já presentes no catálogo, combina um scanner de nomes e tipos de coluna com chamadas a um LLM e apoia inspeção, classificação, documentação e auditoria. Pode criar rascunhos e recomendações; a revisão humana continua essencial.”

## Slide 4 — Risco e ciclo de vida de modelos | 1:12–1:36

**Mensagem:** centralizar o registro para tornar gaps e próximos passos visíveis.

**Texto na tela:**
- Registro de modelos: owner, versão, framework e status
- Métricas recebidas: acurácia, F1/AUC e drift
- Riscos: privacidade, viés, segurança, explicabilidade e operação

**Visual sugerido:** painel dividido: cartão de modelo e matriz risco × impacto. Rodapé: “Telemetria real depende de integração”.

**Fala:**
> “A camada MLOps mantém um registro de modelos e pode armazenar métricas e sinais de drift quando alimentada por dados reais. Em paralelo, a equipe registra riscos, impacto, responsáveis e planos de mitigação. Isso ajuda a priorizar revisão e prestação de contas sem confundir registro com monitoramento automático.”

## Slide 5 — Piloto e parceria | 1:36–2:00

**Mensagem:** validar valor e integrações em um domínio antes de escalar.

**Texto na tela:**
- Piloto em um domínio de negócio
- Baseline → integrações reais → métricas acordadas
- Parceiro para validar o mercado australiano e construir a oferta Brasil–Austrália

**Visual sugerido:** mapa conceitual Brasil–Austrália conectado a um único domínio-piloto; três KPIs sem números fictícios.

**Fala:**
> “A proposta é começar com um domínio de negócio, definir um baseline e conectar apenas as fontes necessárias. Podemos medir cobertura de responsáveis, checks executados, pendências resolvidas e resultados revisados pelos stewards. Buscamos um parceiro para validar requisitos australianos, integrações locais e o modelo comercial para Austrália e Brasil.”

---

# English version

## Slide 1 — Governance for the AI era | 0:00–0:24

**Key message:** AI depends on governed data and traceable decisions.

**On-screen copy:**
- Lucid Data Governance
- Data governance + AI governance + MLOps
- From scattered records to traceable workflows

**Suggested visual:** dark navy cover; subtle connected-data flow; highlight the three pillars in one line.

**Spoken script:**
> “Many organizations are expanding their use of AI, while definitions, owners, approvals and risks remain spread across different tools. Lucid connects data governance, AI governance and MLOps in one environment. The goal is to make decisions and accountability more visible and traceable.”

## Slide 2 — From intake to lifecycle gates | 0:24–0:48

**Key message:** structure an initiative before it advances through its lifecycle.

**On-screen copy:**
- Intake → Go/No-Go → G0 Ideation → G1 Development → G2 Production → G3 Monitoring
- Checklists and evidence by stage
- Recorded decisions and owners

**Suggested visual:** horizontal G0–G3 timeline, with a Go/No-Go checkpoint and small evidence icons.

**Spoken script:**
> “For AI projects, the platform records intake, declared risk and a Go or No-Go decision. It then organizes ideation, development, production and monitoring gates, with checklists and evidence references. This creates a shared review structure; integrations and automated execution must be validated for each customer.”

## Slide 3 — LLM multi-agent workflow | 0:48–1:12

**Key message:** AI supports repeatable governance work connected to catalogued metadata.

**On-screen copy:**
- Metadata → Inspection → PII and classification → Documentation and glossary → Audit
- LLM + heuristic PII scanner
- Human review before external policy changes

**Suggested visual:** five-stage flow, with “catalog metadata” as input and “drafts/evidence” as output.

**Spoken script:**
> “A technical differentiator is the multi-agent workflow. It reads metadata and attributes already available in the catalog, combines a column-name and type scanner with LLM calls, and supports inspection, classification, documentation and audit. It can create drafts and recommendations; human review remains essential.”

## Slide 4 — AI risk and model lifecycle | 1:12–1:36

**Key message:** centralize records so gaps and next steps become visible.

**On-screen copy:**
- Model register: owner, version, framework and status
- Recorded metrics: accuracy, F1/AUC and drift
- Risks: privacy, bias, security, explainability and operations

**Suggested visual:** split panel: model card plus risk-impact matrix. Footer: “Real telemetry depends on integration.”

**Spoken script:**
> “The MLOps layer maintains a model register and can store metrics and drift signals when supplied with real data. In parallel, teams record risks, impact, owners and mitigation plans. This supports prioritization and accountability without confusing a register with automated monitoring.”

## Slide 5 — Pilot and partnership | 1:36–2:00

**Key message:** validate value and integrations in one domain before scaling.

**On-screen copy:**
- Pilot in one business domain
- Baseline → real integrations → agreed measures
- Partner to validate the Australian market and shape a Brazil–Australia offer

**Suggested visual:** conceptual Brazil–Australia connection to one pilot domain; three KPIs, no invented figures.

**Spoken script:**
> “We propose starting with one business domain, setting a baseline and connecting only the required sources. We can measure owner coverage, executed checks, resolved requests and steward-reviewed results. We are looking for a partner to validate Australian requirements and integrations, and to shape a commercial offering for Australia and Brazil.”

---

## Orientações para a conversa

- Diga **“registra”, “organiza”, “apoia” e “pode integrar quando configurado”**; evite “garante”, “certifica”, “monitora tudo automaticamente” ou “faz deploy” sem evidência operacional.
- Não apresente os números do painel FinOps, respostas do gateway, red-team, PSI ou promoção CI/CD da versão revisada como dados ou testes reais de produção.
- Se o investidor perguntar por segurança enterprise, multi-tenancy, conformidade ou propriedade intelectual, responda com transparência e proponha uma diligência técnica/jurídica antes do piloto comercial.
- Não use percentuais de ROI ou economia sem medi-los com dados do piloto.
