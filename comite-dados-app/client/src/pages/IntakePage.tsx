import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Inbox, Plus, ChevronRight, Clock, CheckCircle2, XCircle,
  AlertTriangle, RotateCcw, Loader2, ClipboardList, Filter,
  Trophy, PlayCircle, PackageCheck, ShieldCheck, BarChart2,
  Trash2, PlusCircle, CheckSquare, Square, Database, Target,
  Lock, AlertCircle, FileText, ChevronLeft,
  Users, Calendar, ListChecks,
} from "lucide-react";
import { calcScore } from "@shared/intakeScoring";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  rascunho:             { label: "Rascunho",             color: "bg-gray-100 text-gray-700",    icon: Clock },
  submetido:            { label: "Submetido",            color: "bg-blue-100 text-blue-700",    icon: ClipboardList },
  em_triagem:           { label: "Em Triagem",           color: "bg-yellow-100 text-yellow-700", icon: AlertTriangle },
  aprovado_estrategico: { label: "Aprov. Estratégico",   color: "bg-green-100 text-green-700",  icon: CheckCircle2 },
  aprovado_operacional: { label: "Aprov. Operacional",   color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  em_execucao:          { label: "Em Execução",          color: "bg-indigo-100 text-indigo-700", icon: PlayCircle },
  em_validacao:         { label: "Em Validação",         color: "bg-purple-100 text-purple-700", icon: ShieldCheck },
  concluido:            { label: "Concluído",            color: "bg-teal-100 text-teal-700",    icon: Trophy },
  retornado:            { label: "Retornado",            color: "bg-orange-100 text-orange-700", icon: RotateCcw },
  rejeitado:            { label: "Rejeitado",            color: "bg-red-100 text-red-700",      icon: XCircle },
};

const TYPE_LABELS: Record<string, string> = {
  dado:       "Dado / Ativo",
  projeto_ia: "Projeto IA",
  compliance: "Compliance",
  qualidade:  "Qualidade",
  acesso:     "Controle de Acesso",
  outro:      "Outro",
};

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  baixa:   { label: "Baixa",   color: "bg-gray-100 text-gray-600" },
  media:   { label: "Média",   color: "bg-blue-100 text-blue-700" },
  alta:    { label: "Alta",    color: "bg-orange-100 text-orange-700" },
  critica: { label: "Crítica", color: "bg-red-100 text-red-700" },
};

const TIER_META: Record<string, { color: string; bg: string; sla: string }> = {
  P1: { color: "text-red-700",    bg: "bg-red-100 border-red-300",       sla: "SLA: 2 dias úteis" },
  P2: { color: "text-orange-700", bg: "bg-orange-100 border-orange-300", sla: "SLA: 5 dias úteis" },
  P3: { color: "text-yellow-700", bg: "bg-yellow-100 border-yellow-300", sla: "SLA: 15 dias úteis" },
  P4: { color: "text-green-700",  bg: "bg-green-100 border-green-300",   sla: "Backlog s/ SLA" },
};

const DQ_DIMENSIONS = ["Completude", "Unicidade", "Validade de domínio", "Consistência", "Atualidade", "Precisão"];

const TRIAGE_CHECKLIST = {
  completeness: [
    "Seções A–H preenchidas (≥ 90% dos campos obrigatórios)",
    "Caso de uso e objetivo descritos de forma não-ambígua",
    "Mínimo 3 critérios de qualidade definidos (Seção D)",
    "Mínimo 2 critérios de sucesso mensuráveis (Seção E)",
    "Data Owner identificado e confirmado",
    "PII declarado explicitamente (Sim / Não / Não sei)",
  ],
  viability: [
    "Fonte de dados identificada e acessível (ou caminho definido)",
    "Domínio de dados mapeado (cli / sku / plt / novo)",
    "Volume e frequência compatíveis com capacidade do cluster DLO",
    "Dependências de infraestrutura identificadas (VPN, IR, IP whitelist)",
    "Não duplica demanda existente no backlog ou já entregue",
  ],
  governance: [
    "Aprovação da liderança do solicitante registrada no formulário",
    "Se PII: Privacy Champion designado e ciente",
    "Classificação de sensibilidade declarada",
    "Grupo(s) de acesso identificados (para configuração de permissões)",
  ],
};

const SCORING_CRITERIA = [
  { key: "scoreFinancialImpact",      label: "Impacto Financeiro",       weight: "×10",
    opts: ["Indireto / incerto", "Quantificável > R$100k/ano", "Estratégico > R$1M/ano"] },
  { key: "scoreBusinessUrgency",      label: "Urgência de Negócio",      weight: "×10",
    opts: ["Nice-to-have", "Impacta decisões relevantes", "Bloqueio operacional/regulatório"] },
  { key: "scoreReach",                label: "Alcance (usuários)",        weight: "×8",
    opts: ["1–3 usuários", "4–20 usuários", "20+ usuários / toda a área"] },
  { key: "scoreStrategicAlignment",   label: "Alinhamento Estratégico",  weight: "×8",
    opts: ["Sem alinhamento", "Alinhado a OKR da área", "Alinhado ao CoE / DLO / OKR corporativo"] },
  { key: "scoreIntakeCompleteness",   label: "Completude do Intake",     weight: "×6",
    opts: ["Incompleto (<70%)", "Parcial (70–90%)", "Completo (90–100%)"] },
  { key: "scoreTechnicalFeasibility", label: "Viabilidade Técnica",      weight: "×5",
    opts: ["Alta complexidade / dependências", "Moderada", "Baixa — infra disponível"] },
  { key: "scoreReuse",                label: "Reuso / Reutilização",     weight: "×4",
    opts: ["Solução única", "Parcialmente reusável", "Reutilizável por 2+ áreas"] },
  { key: "scoreDataOwnerDefined",     label: "Data Owner Definido",      weight: "×4",
    opts: ["Não identificado", "Identificado, não confirmado", "Confirmado e engajado"] },
] as const;

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: "bg-gray-100 text-gray-700", icon: Clock };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const meta = PRIORITY_META[priority] ?? { label: priority, color: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
      {meta.label}
    </span>
  );
}

function TierBadge({ tier, score }: { tier: string; score?: number | null }) {
  const meta = TIER_META[tier];
  if (!meta) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${meta.bg} ${meta.color}`}>
      {tier}{score != null ? ` · ${score}pts` : ""}
    </span>
  );
}

// ─── Multi-step Intake Wizard (Seções A–H) ────────────────────────────────────

const EMPTY_FORM = {
  // A
  title: "", description: "", type: "dado" as string, priority: "media" as string,
  desiredDeadline: "", submitterDept: "", managerApproval: "",
  // B
  problemStatement: "", objective: "", targetAudience: "", usageFrequency: "", financialImpact: "",
  // C
  sourceSystems: "", mainEntities: "", estimatedVolume: "", updateFrequency: "",
  historyNeeded: "", containsPii: "nao_sei" as string, piiColumns: "", expectedFields: "",
  // D
  qualityCriteria: [{ dimension: "Completude", affectedField: "", rule: "", blocksPipeline: true }],
  minDqScore: "0.95", dqFailAction: "bloquear_pipeline",
  // E
  successCriteria: [{ criterion: "", kpi: "", goal: "" }],
  postDeliveryMeasurement: "",
  // F
  dataOwnerName: "", dataStewardName: "", privacyChampion: "",
  dataSensitivity: "interno" as string, accessGroups: "",
  applicableRegulations: "", retentionPeriod: "3 anos",
  // G
  technicalDependencies: "", identifiedRisks: "", relatedDemands: "",
  testEnvironmentAvailable: "", networkInfraNeeded: "",
};

const STEPS = [
  { id: "A", label: "Identificação",  icon: FileText },
  { id: "B", label: "Caso de Uso",    icon: Target },
  { id: "C", label: "Dados",          icon: Database },
  { id: "D", label: "Qualidade",      icon: CheckSquare },
  { id: "E", label: "Sucesso",        icon: Trophy },
  { id: "F", label: "Governança",     icon: Lock },
  { id: "G", label: "Riscos / Decl.", icon: AlertCircle },
];

const SECTION_COLORS = [
  "bg-blue-600","bg-purple-600","bg-violet-600","bg-orange-500",
  "bg-emerald-600","bg-red-600","bg-slate-600",
];

function MultiStepIntakeDialog({ open, onClose, onSuccess }: {
  open: boolean; onClose: () => void; onSuccess: () => void;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const utils = trpc.useUtils();

  const createMutation = trpc.intake.create.useMutation({
    onSuccess: () => {
      utils.intake.list.invalidate();
      utils.intake.counts.invalidate();
      setForm(EMPTY_FORM);
      setStep(0);
      onSuccess();
    },
  });

  const set = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  const addQC = () => set("qualityCriteria", [...form.qualityCriteria, { dimension: "Completude", affectedField: "", rule: "", blocksPipeline: true }]);
  const removeQC = (i: number) => set("qualityCriteria", form.qualityCriteria.filter((_: any, idx: number) => idx !== i));
  const setQC = (i: number, field: string, val: any) =>
    set("qualityCriteria", form.qualityCriteria.map((row: any, idx: number) => idx === i ? { ...row, [field]: val } : row));

  const addSC = () => set("successCriteria", [...form.successCriteria, { criterion: "", kpi: "", goal: "" }]);
  const removeSC = (i: number) => set("successCriteria", form.successCriteria.filter((_: any, idx: number) => idx !== i));
  const setSC = (i: number, field: string, val: any) =>
    set("successCriteria", form.successCriteria.map((row: any, idx: number) => idx === i ? { ...row, [field]: val } : row));

  const handleSubmit = () => {
    createMutation.mutate({
      title: form.title,
      description: form.description || form.problemStatement || "—",
      type: form.type as any,
      priority: form.priority as any,
      desiredDeadline: form.desiredDeadline || undefined,
      submitterDept: form.submitterDept || undefined,
      managerApproval: form.managerApproval || undefined,
      problemStatement: form.problemStatement || undefined,
      objective: form.objective || undefined,
      targetAudience: form.targetAudience || undefined,
      usageFrequency: form.usageFrequency || undefined,
      financialImpact: form.financialImpact || undefined,
      sourceSystems: form.sourceSystems || undefined,
      mainEntities: form.mainEntities || undefined,
      estimatedVolume: form.estimatedVolume || undefined,
      updateFrequency: form.updateFrequency || undefined,
      historyNeeded: form.historyNeeded || undefined,
      containsPii: form.containsPii as any,
      piiColumns: form.piiColumns || undefined,
      expectedFields: form.expectedFields || undefined,
      qualityCriteria: form.qualityCriteria.filter((r: any) => r.affectedField || r.rule),
      minDqScore: parseFloat(form.minDqScore) || undefined,
      dqFailAction: form.dqFailAction || undefined,
      successCriteria: form.successCriteria.filter((r: any) => r.criterion),
      postDeliveryMeasurement: form.postDeliveryMeasurement || undefined,
      dataOwnerName: form.dataOwnerName || undefined,
      dataStewardName: form.dataStewardName || undefined,
      privacyChampion: form.privacyChampion || undefined,
      dataSensitivity: form.dataSensitivity as any,
      accessGroups: form.accessGroups || undefined,
      applicableRegulations: form.applicableRegulations || undefined,
      retentionPeriod: form.retentionPeriod || undefined,
      technicalDependencies: form.technicalDependencies || undefined,
      identifiedRisks: form.identifiedRisks || undefined,
      relatedDemands: form.relatedDemands || undefined,
      testEnvironmentAvailable: form.testEnvironmentAvailable || undefined,
      networkInfraNeeded: form.networkInfraNeeded || undefined,
    });
  };

  const stepInfo = STEPS[step];
  const StepIcon = stepInfo.icon;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setStep(0); } }}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0">
        {/* Header com stepper */}
        <div className="bg-gray-900 text-white px-6 pt-5 pb-4 rounded-t-lg flex-shrink-0">
          <div className="flex items-center gap-2 mb-4">
            <Inbox className="h-5 w-5 text-blue-400" />
            <span className="font-semibold">Novo Intake de Demanda — Formulário Estruturado</span>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < step; const active = i === step;
              return (
                <div key={s.id} className="flex items-center gap-1 flex-shrink-0">
                  {i > 0 && <div className={`h-px w-5 ${done ? "bg-blue-400" : "bg-gray-600"}`} />}
                  <button type="button" onClick={() => i <= step && setStep(i)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      active ? "bg-blue-600 text-white" :
                      done   ? "bg-gray-700 text-blue-300 hover:bg-gray-600" :
                               "bg-gray-800 text-gray-500"
                    }`}>
                    <Icon className="h-3 w-3" />
                    <span className="font-bold">{s.id}</span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Barra colorida da seção */}
        <div className={`${SECTION_COLORS[step]} text-white px-6 py-2.5 flex items-center gap-2 flex-shrink-0`}>
          <StepIcon className="h-4 w-4" />
          <span className="font-semibold text-sm">{stepInfo.id} — {stepInfo.label}</span>
          <span className="ml-auto text-xs opacity-70">Passo {step + 1} de {STEPS.length}</span>
        </div>

        {/* Conteúdo da step */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* ── A: Identificação ───────────────────────── */}
          {step === 0 && (
            <>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                ⚠️ O código INT-YYYYMMDD-NNN será gerado automaticamente na submissão.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <Label>Título da Demanda *</Label>
                  <Input value={form.title} onChange={e => set("title", e.target.value)}
                    placeholder="Ex: Integração Pedidos de Venda SAP SD ao Data Lake" maxLength={256} />
                </div>
                <div className="space-y-1">
                  <Label>Tipo de Demanda *</Label>
                  <Select value={form.type} onValueChange={v => set("type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Prioridade</Label>
                  <Select value={form.priority} onValueChange={v => set("priority", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="critica">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Área / Célula Solicitante *</Label>
                  <Input value={form.submitterDept} onChange={e => set("submitterDept", e.target.value)}
                    placeholder="Ex: Comercial Brasil / TI VC / Operações" />
                </div>
                <div className="space-y-1">
                  <Label>Data de Necessidade</Label>
                  <Input type="date" value={form.desiredDeadline} onChange={e => set("desiredDeadline", e.target.value)} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Aprovação da Liderança Imediata *</Label>
                  <Input value={form.managerApproval} onChange={e => set("managerApproval", e.target.value)}
                    placeholder="Nome do Gestor + E-mail + Data" />
                </div>
              </div>
            </>
          )}

          {/* ── B: Caso de Uso ─────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Problema ou Oportunidade *</Label>
                <Textarea value={form.problemStatement} onChange={e => set("problemStatement", e.target.value)}
                  placeholder={'Ex: "Hoje não temos visibilidade de margem por SKU, o que impede decisões de precificação."'}
                  rows={3} />
              </div>
              <div className="space-y-1">
                <Label>Objetivo da Demanda *</Label>
                <Textarea value={form.objective} onChange={e => set("objective", e.target.value)}
                  placeholder={'Ex: "Dashboard com margem líquida por SKU, planta e cliente, atualizado diariamente."'}
                  rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Público Usuário Final *</Label>
                  <Textarea value={form.targetAudience} onChange={e => set("targetAudience", e.target.value)}
                    placeholder="Ex: Diretores Comerciais, Analistas de Pricing" rows={2} />
                </div>
                <div className="space-y-1">
                  <Label>Frequência de Uso Estimada</Label>
                  <Input value={form.usageFrequency} onChange={e => set("usageFrequency", e.target.value)}
                    placeholder="Diário | Semanal | Mensal | Pontual" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Impacto Financeiro ou Estratégico *</Label>
                <Textarea value={form.financialImpact} onChange={e => set("financialImpact", e.target.value)}
                  placeholder="Ex: Redução de 15% no ciclo de precificação. Estimativa: R$ 500k/ano." rows={2} />
              </div>
            </div>
          )}

          {/* ── C: Dados ───────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Sistema(s) de Origem *</Label>
                  <Input value={form.sourceSystems} onChange={e => set("sourceSystems", e.target.value)}
                    placeholder="Ex: SAP SD, CRM Salesforce, XLSX, API REST" />
                </div>
                <div className="space-y-1">
                  <Label>Entidade(s) Principal(is) *</Label>
                  <Input value={form.mainEntities} onChange={e => set("mainEntities", e.target.value)}
                    placeholder="Ex: pedido_venda, cliente, material" />
                </div>
                <div className="space-y-1">
                  <Label>Volume Estimado (reg/dia) *</Label>
                  <Input value={form.estimatedVolume} onChange={e => set("estimatedVolume", e.target.value)}
                    placeholder="Ex: 10.000 | 500.000 | 1M+" />
                </div>
                <div className="space-y-1">
                  <Label>Frequência de Atualização *</Label>
                  <Input value={form.updateFrequency} onChange={e => set("updateFrequency", e.target.value)}
                    placeholder="Real-time | Hora | Diária | Semanal" />
                </div>
                <div className="space-y-1">
                  <Label>Histórico Necessário</Label>
                  <Input value={form.historyNeeded} onChange={e => set("historyNeeded", e.target.value)}
                    placeholder="Ex: 12 meses | 3 anos | Tudo disponível" />
                </div>
                <div className="space-y-1">
                  <Label>Contém Dados PII / LGPD? *</Label>
                  <Select value={form.containsPii} onValueChange={v => set("containsPii", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim → listar colunas abaixo</SelectItem>
                      <SelectItem value="nao">Não confirmado</SelectItem>
                      <SelectItem value="nao_sei">Não sei (análise necessária)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.containsPii === "sim" && (
                <div className="space-y-1">
                  <Label>Colunas PII Identificadas</Label>
                  <Input value={form.piiColumns} onChange={e => set("piiColumns", e.target.value)}
                    placeholder="Ex: nm_cliente, cpf, email, telefone, endereço" />
                </div>
              )}
              <div className="space-y-1">
                <Label>Campos / Métricas Esperados no Entregável *</Label>
                <Textarea value={form.expectedFields} onChange={e => set("expectedFields", e.target.value)}
                  placeholder="Ex: cd_pedido, dt_emissao, vl_total, margem_liquida, cd_cliente, nm_sku, cd_planta"
                  rows={3} />
              </div>
            </div>
          )}

          {/* ── D: Qualidade ───────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
                Preencha pelo menos 3 critérios de qualidade. Esses critérios alimentarão as regras DQ automáticas do pipeline.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-800 text-white">
                      <th className="px-2 py-2 text-left w-5">#</th>
                      <th className="px-2 py-2 text-left">Dimensão *</th>
                      <th className="px-2 py-2 text-left">Campo Afetado</th>
                      <th className="px-2 py-2 text-left">Regra / Expectativa</th>
                      <th className="px-2 py-2 text-center">Bloqueia?</th>
                      <th className="px-2 py-2 w-6"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.qualityCriteria.map((row: any, i: number) => (
                      <tr key={i} className="border-b border-gray-200">
                        <td className="px-2 py-1 text-gray-400 font-bold">{i + 1}</td>
                        <td className="px-1 py-1">
                          <Select value={row.dimension} onValueChange={v => setQC(i, "dimension", v)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {DQ_DIMENSIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-1 py-1">
                          <Input className="h-7 text-xs" value={row.affectedField}
                            onChange={e => setQC(i, "affectedField", e.target.value)} placeholder="Ex: cd_pedido" />
                        </td>
                        <td className="px-1 py-1">
                          <Input className="h-7 text-xs" value={row.rule}
                            onChange={e => setQC(i, "rule", e.target.value)} placeholder="Ex: Nenhum valor nulo" />
                        </td>
                        <td className="px-1 py-1 text-center">
                          <button type="button" onClick={() => setQC(i, "blocksPipeline", !row.blocksPipeline)}
                            className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                              row.blocksPipeline ? "bg-green-100 text-green-700 border-green-300" : "bg-yellow-50 text-yellow-700 border-yellow-300"
                            }`}>
                            {row.blocksPipeline ? "Sim" : "Aviso"}
                          </button>
                        </td>
                        <td className="px-1 py-1">
                          <button type="button" onClick={() => removeQC(i)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" onClick={addQC}
                  className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                  <PlusCircle className="h-3.5 w-3.5" /> Adicionar critério de qualidade
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>DQ Score Mínimo Aceitável</Label>
                  <Input value={form.minDqScore} onChange={e => set("minDqScore", e.target.value)}
                    placeholder="0,95 (dev) | 0,98 (prd)" />
                </div>
                <div className="space-y-1">
                  <Label>Ação em Caso de Falha DQ</Label>
                  <Select value={form.dqFailAction} onValueChange={v => set("dqFailAction", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bloquear_pipeline">Bloquear pipeline</SelectItem>
                      <SelectItem value="alertar_continuar">Alertar e continuar</SelectItem>
                      <SelectItem value="reprocessar">Reprocessar automaticamente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* ── E: Sucesso ─────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
                Critérios testáveis e objetivos. Prefira "DQ Score ≥ 0,98 por 30 dias" a "melhorar a qualidade".
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-orange-600 text-white">
                      <th className="px-2 py-2 text-left w-5">#</th>
                      <th className="px-2 py-2 text-left">Critério de Sucesso *</th>
                      <th className="px-2 py-2 text-left">Métrica / KPI</th>
                      <th className="px-2 py-2 text-left">Meta</th>
                      <th className="px-2 py-2 w-6"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.successCriteria.map((row: any, i: number) => (
                      <tr key={i} className="border-b border-gray-200">
                        <td className="px-2 py-1 text-gray-400 font-bold">{i + 1}</td>
                        <td className="px-1 py-1">
                          <Input className="h-7 text-xs" value={row.criterion}
                            onChange={e => setSC(i, "criterion", e.target.value)} placeholder="Ex: Disponibilidade do dado" />
                        </td>
                        <td className="px-1 py-1">
                          <Input className="h-7 text-xs" value={row.kpi}
                            onChange={e => setSC(i, "kpi", e.target.value)} placeholder="Ex: Tabela Gold no UC" />
                        </td>
                        <td className="px-1 py-1">
                          <Input className="h-7 text-xs" value={row.goal}
                            onChange={e => setSC(i, "goal", e.target.value)} placeholder="Ex: Até 06h30 todo dia útil" />
                        </td>
                        <td className="px-1 py-1">
                          <button type="button" onClick={() => removeSC(i)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" onClick={addSC}
                  className="mt-2 flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 font-medium">
                  <PlusCircle className="h-3.5 w-3.5" /> Adicionar critério de sucesso
                </button>
              </div>
              <div className="space-y-1">
                <Label>Como o Sucesso Será Medido Pós-Entrega? *</Label>
                <Textarea value={form.postDeliveryMeasurement} onChange={e => set("postDeliveryMeasurement", e.target.value)}
                  placeholder={'Ex: "Data Owner valida o dashboard semanalmente por 30 dias."'} rows={3} />
              </div>
            </div>
          )}

          {/* ── F: Governança ──────────────────────────── */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Data Owner *</Label>
                  <Input value={form.dataOwnerName} onChange={e => set("dataOwnerName", e.target.value)}
                    placeholder="Nome | Área | E-mail" />
                </div>
                <div className="space-y-1">
                  <Label>Data Steward</Label>
                  <Input value={form.dataStewardName} onChange={e => set("dataStewardName", e.target.value)}
                    placeholder="Nome | Área | E-mail" />
                </div>
                <div className="space-y-1">
                  <Label>Privacy Champion (se PII)</Label>
                  <Input value={form.privacyChampion} onChange={e => set("privacyChampion", e.target.value)}
                    placeholder="Nome | Área | E-mail" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Classificação de Sensibilidade *</Label>
                  <Select value={form.dataSensitivity} onValueChange={v => set("dataSensitivity", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="publico">Público</SelectItem>
                      <SelectItem value="interno">Interno</SelectItem>
                      <SelectItem value="confidencial">Confidencial</SelectItem>
                      <SelectItem value="restrito">Restrito (campo a campo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Quem Deve Ter Acesso? *</Label>
                  <Input value={form.accessGroups} onChange={e => set("accessGroups", e.target.value)}
                    placeholder="Ex: Dir. Executivos + Analistas Comerciais (leitura)" />
                </div>
                <div className="space-y-1">
                  <Label>Regulamentações Aplicáveis</Label>
                  <Input value={form.applicableRegulations} onChange={e => set("applicableRegulations", e.target.value)}
                    placeholder="LGPD | GDPR | Controles Internos VC | Nenhuma" />
                </div>
                <div className="space-y-1">
                  <Label>Retenção de Dados Esperada</Label>
                  <Input value={form.retentionPeriod} onChange={e => set("retentionPeriod", e.target.value)}
                    placeholder="1 ano | 3 anos | 5 anos | Conforme política DLO" />
                </div>
              </div>
            </div>
          )}

          {/* ── G+H: Riscos e Declaração ───────────────── */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Dependências Técnicas ou de Negócio</Label>
                <Textarea value={form.technicalDependencies} onChange={e => set("technicalDependencies", e.target.value)}
                  placeholder="Ex: Acesso SAP SD liberado pela equipe Basis. Aprovação do Comitê de Segurança para dados de folha."
                  rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Riscos Identificados</Label>
                  <Textarea value={form.identifiedRisks} onChange={e => set("identifiedRisks", e.target.value)}
                    placeholder="Ex: Dados históricos incompletos no SAP. Schema pode mudar." rows={2} />
                </div>
                <div className="space-y-1">
                  <Label>Demandas Relacionadas</Label>
                  <Input value={form.relatedDemands} onChange={e => set("relatedDemands", e.target.value)}
                    placeholder="Ex: INT-20260101-003 (Integração SAP MM)" />
                </div>
                <div className="space-y-1">
                  <Label>Ambiente de Testes Disponível?</Label>
                  <Input value={form.testEnvironmentAvailable} onChange={e => set("testEnvironmentAvailable", e.target.value)}
                    placeholder="Sim (DEV da fonte) | Não | Com restrições" />
                </div>
                <div className="space-y-1">
                  <Label>Infraestrutura de Rede Necessária?</Label>
                  <Input value={form.networkInfraNeeded} onChange={e => set("networkInfraNeeded", e.target.value)}
                    placeholder="VPN / VNet Peering / IP Whitelist / Self-Hosted IR / Nenhuma" />
                </div>
              </div>
              <div className="mt-1 bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                <p className="text-xs text-green-800 font-semibold">H — Declaração e Assinatura</p>
                <p className="text-xs text-green-700">
                  Ao submeter, o solicitante declara que as informações são verdadeiras, o Data Owner está ciente e a demanda foi aprovada pela liderança.
                </p>
                <div className="space-y-1">
                  <Label>Confirmação de Aprovação da Liderança *</Label>
                  <Input value={form.managerApproval} onChange={e => set("managerApproval", e.target.value)}
                    placeholder="Nome do Gestor + E-mail + Data de aprovação" />
                </div>
              </div>
              {createMutation.error && <p className="text-sm text-red-600">{createMutation.error.message}</p>}
            </div>
          )}
        </div>

        {/* Footer de navegação */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-lg flex-shrink-0">
          <Button variant="outline" size="sm" onClick={() => step > 0 ? setStep(s => s - 1) : onClose()}
            className="flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" />
            {step === 0 ? "Cancelar" : "Anterior"}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep(s => s + 1)}
              disabled={step === 0 && !form.title}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white">
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSubmit}
              disabled={createMutation.isPending || !form.title}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1">
              {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Submeter Demanda
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Painel de Triagem (P1-P4 + Checklist) ───────────────────────────────────

function TriagePanel({ intake, onClose, onDone }: {
  intake: any; onClose: () => void; onDone: () => void;
}) {
  const [decision, setDecision] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(SCORING_CRITERIA.map(c => [c.key, (intake as any)[c.key] ?? 1]))
  );
  const [scoringNotes, setScoringNotes] = useState((intake as any).scoringNotes ?? "");
  const [checklist, setChecklist] = useState({
    completeness: new Array(6).fill(false) as boolean[],
    viability:    new Array(5).fill(false) as boolean[],
    governance:   new Array(4).fill(false) as boolean[],
  });
  const [activeTab, setActiveTab] = useState<"scoring" | "checklist">("scoring");
  const utils = trpc.useUtils();

  const { total, tier } = calcScore(scores);
  const allChecked = [...checklist.completeness, ...checklist.viability, ...checklist.governance];
  const checkPercent = Math.round((allChecked.filter(Boolean).length / allChecked.length) * 100);

  const triageMutation = trpc.intake.triage.useMutation({
    onSuccess: () => {
      utils.intake.list.invalidate();
      utils.intake.counts.invalidate();
      utils.intake.ranking.invalidate();
      onDone();
    },
  });

  const handleTriage = () => {
    if (!decision) return;
    triageMutation.mutate({
      id: intake.id,
      decision: decision as any,
      reviewNotes: notes || undefined,
      returnReason: decision === "retornado" ? returnReason || undefined : undefined,
      scoringNotes: scoringNotes || undefined,
      ...(Object.fromEntries(SCORING_CRITERIA.map(c => [c.key, scores[c.key]])) as any),
      triageChecklist: {
        completeness: checklist.completeness,
        viability: checklist.viability,
        governance: checklist.governance,
        result: decision === "aprovado_estrategico" || decision === "aprovado_operacional"
          ? "aprovado" : decision === "retornado" ? "devolvido" : "recusado",
      },
    });
  };

  const toggleCheck = (cat: keyof typeof checklist, i: number) =>
    setChecklist(c => ({ ...c, [cat]: c[cat].map((v: boolean, idx: number) => idx === i ? !v : v) }));

  const tierMeta = TIER_META[tier];

  return (
    <div className="space-y-4 mt-4 border-t pt-4">
      <div className="flex items-center gap-2 justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Triagem Técnica</h3>
        <div className="flex gap-0 border rounded overflow-hidden text-xs">
          {(["scoring", "checklist"] as const).map(t => (
            <button key={t} type="button" onClick={() => setActiveTab(t)}
              className={`px-3 py-1 font-medium transition-colors ${
                activeTab === t ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}>
              {t === "scoring" ? "Pontuação P1-P4" : `Checklist (${checkPercent}%)`}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "scoring" && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Cada critério: 1 = baixo · 2 = médio · 3 = alto (máx. 100 pts)</p>
          {SCORING_CRITERIA.map(c => (
            <div key={c.key} className="grid grid-cols-[1fr_auto_76px] items-center gap-2">
              <div>
                <p className="text-xs font-medium text-gray-700">{c.label}</p>
                <p className="text-[10px] text-gray-400">{c.opts[scores[c.key] - 1]}</p>
              </div>
              <span className="text-[10px] font-bold text-gray-400">{c.weight}</span>
              <div className="flex gap-1">
                {[1, 2, 3].map(n => (
                  <button key={n} type="button" onClick={() => setScores(s => ({ ...s, [c.key]: n }))}
                    className={`flex-1 py-1 rounded text-xs font-bold border transition-colors ${
                      scores[c.key] === n
                        ? n === 3 ? "bg-green-600 text-white border-green-600"
                          : n === 2 ? "bg-yellow-500 text-white border-yellow-500"
                          : "bg-red-500 text-white border-red-500"
                        : "bg-white text-gray-400 border-gray-200 hover:border-gray-400"
                    }`}>{n}</button>
                ))}
              </div>
            </div>
          ))}

          <div className={`flex items-center justify-between rounded-lg p-3 border ${tierMeta?.bg ?? "bg-gray-50"}`}>
            <div>
              <p className={`text-xl font-black ${tierMeta?.color ?? "text-gray-800"}`}>{total} / 100 pts</p>
              <p className="text-xs text-gray-500">{tierMeta?.sla}</p>
            </div>
            <TierBadge tier={tier} score={total} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Justificativa da Pontuação</Label>
            <Textarea value={scoringNotes} onChange={e => setScoringNotes(e.target.value)}
              placeholder="Por que essa pontuação? Contexto adicional..." rows={2} className="text-xs" />
          </div>
        </div>
      )}

      {activeTab === "checklist" && (
        <div className="space-y-4 text-xs">
          {([
            { key: "completeness" as const, label: "Completude e Clareza",  items: TRIAGE_CHECKLIST.completeness },
            { key: "viability"    as const, label: "Viabilidade Técnica",   items: TRIAGE_CHECKLIST.viability },
            { key: "governance"   as const, label: "Governança",            items: TRIAGE_CHECKLIST.governance },
          ]).map(section => (
            <div key={section.key}>
              <p className="font-semibold text-gray-700 mb-2">{section.label}</p>
              {section.items.map((item, i) => (
                <label key={i} className="flex items-start gap-2 mb-1.5 cursor-pointer hover:bg-gray-50 rounded p-1">
                  <button type="button" onClick={() => toggleCheck(section.key, i)}
                    className={`mt-0.5 flex-shrink-0 ${checklist[section.key][i] ? "text-green-600" : "text-gray-300"}`}>
                    {checklist[section.key][i] ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>
                  <span className={checklist[section.key][i] ? "text-green-700 line-through" : "text-gray-600"}>{item}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Decisão */}
      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-gray-600">Resultado da Triagem</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "aprovado_estrategico", label: "Aprovado p/ Comitê",       cls: "border-green-400 text-green-700 hover:bg-green-50" },
            { value: "aprovado_operacional", label: "Aprovado Operacional",      cls: "border-emerald-400 text-emerald-700 hover:bg-emerald-50" },
            { value: "retornado",            label: "Devolvido p/ Complementação", cls: "border-orange-400 text-orange-700 hover:bg-orange-50" },
            { value: "rejeitado",            label: "Recusado Tecnicamente",     cls: "border-red-400 text-red-700 hover:bg-red-50" },
          ].map(opt => (
            <button key={opt.value} type="button" onClick={() => setDecision(opt.value)}
              className={`text-xs px-3 py-2 rounded border-2 font-medium transition-colors ${opt.cls} ${decision === opt.value ? "ring-2 ring-offset-1 ring-current font-bold" : ""}`}>
              {opt.label}
            </button>
          ))}
        </div>

        {decision === "retornado" && (
          <div className="space-y-1">
            <Label className="text-xs">O que falta? (obrigatório para devolução)</Label>
            <Textarea value={returnReason} onChange={e => setReturnReason(e.target.value)}
              placeholder="Liste o que precisa ser ajustado ou complementado..." rows={2} className="text-xs" />
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Notas de Revisão</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Observações adicionais..." rows={2} className="text-xs" />
        </div>

        {triageMutation.error && <p className="text-sm text-red-600">{triageMutation.error.message}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={!decision || triageMutation.isPending} onClick={handleTriage}>
            {triageMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Confirmar Decisão
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Detalhe da Demanda ───────────────────────────────────────────────────────

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function SectionBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-3 py-2 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
      </div>
      <div className="p-3 space-y-2">{children}</div>
    </div>
  );
}

function IntakeDetailSheet({ intake, open, onClose, isPrivileged }: {
  intake: any; open: boolean; onClose: () => void; isPrivileged: boolean;
}) {
  const [showTriage, setShowTriage] = useState(false);
  if (!intake) return null;
  const canTriage = isPrivileged && ["submetido", "em_triagem"].includes(intake.status);

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-[540px] sm:w-[620px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-start gap-2 pr-6">
            <Inbox className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <span className="line-clamp-2">{intake.title}</span>
          </SheetTitle>
          <SheetDescription className="flex flex-wrap gap-2 mt-1">
            {intake.intakeCode && (
              <span className="text-xs font-mono font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                {intake.intakeCode}
              </span>
            )}
            <StatusBadge status={intake.status} />
            <PriorityBadge priority={intake.priority} />
            {intake.priorityTier && <TierBadge tier={intake.priorityTier} score={intake.totalScore} />}
            <span className="text-xs text-gray-400">{TYPE_LABELS[intake.type] ?? intake.type}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <SectionBox title="A — Identificação">
            <FieldRow label="Solicitante" value={`${intake.submitterName ?? "—"}${intake.submitterEmail ? ` · ${intake.submitterEmail}` : ""}${intake.submitterDept ? ` · ${intake.submitterDept}` : ""}`} />
            <FieldRow label="Aprovação da liderança" value={intake.managerApproval} />
            <FieldRow label="Prazo desejado" value={intake.desiredDeadline} />
          </SectionBox>

          {(intake.problemStatement || intake.objective) && (
            <SectionBox title="B — Caso de Uso">
              <FieldRow label="Problema / Oportunidade" value={intake.problemStatement} />
              <FieldRow label="Objetivo" value={intake.objective} />
              <FieldRow label="Público usuário final" value={intake.targetAudience} />
              <FieldRow label="Freq. de uso" value={intake.usageFrequency} />
              <FieldRow label="Impacto financeiro" value={intake.financialImpact} />
            </SectionBox>
          )}

          {intake.sourceSystems && (
            <SectionBox title="C — Dados Envolvidos">
              <FieldRow label="Sistemas de origem" value={intake.sourceSystems} />
              <FieldRow label="Entidades principais" value={intake.mainEntities} />
              <FieldRow label="Volume estimado" value={intake.estimatedVolume} />
              <FieldRow label="Freq. de atualização" value={intake.updateFrequency} />
              <FieldRow label="Histórico necessário" value={intake.historyNeeded} />
              <FieldRow label="PII / LGPD" value={
                intake.containsPii === "sim" ? `Sim${intake.piiColumns ? ` — ${intake.piiColumns}` : ""}` :
                intake.containsPii === "nao" ? "Não" : "Não sei"
              } />
              <FieldRow label="Campos / métricas esperados" value={intake.expectedFields} />
            </SectionBox>
          )}

          {intake.qualityCriteria?.length > 0 && (
            <SectionBox title="D — Critérios de Qualidade">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-2 py-1 text-gray-500">Dimensão</th>
                    <th className="text-left px-2 py-1 text-gray-500">Campo</th>
                    <th className="text-left px-2 py-1 text-gray-500">Regra</th>
                    <th className="text-center px-2 py-1 text-gray-500">Bloqueia</th>
                  </tr>
                </thead>
                <tbody>
                  {intake.qualityCriteria.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-2 py-1 font-medium">{row.dimension}</td>
                      <td className="px-2 py-1 font-mono">{row.affectedField}</td>
                      <td className="px-2 py-1 text-gray-600">{row.rule}</td>
                      <td className="px-2 py-1 text-center">
                        <span className={`font-semibold ${row.blocksPipeline ? "text-green-700" : "text-yellow-600"}`}>
                          {row.blocksPipeline ? "Sim" : "Aviso"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {intake.minDqScore && <p className="text-xs text-gray-500 mt-1">DQ Score mínimo: <b>{intake.minDqScore}</b> · Falha: {intake.dqFailAction}</p>}
            </SectionBox>
          )}

          {intake.successCriteria?.length > 0 && (
            <SectionBox title="E — Critérios de Sucesso">
              {intake.successCriteria.map((row: any, i: number) => (
                <div key={i} className="text-xs">
                  <span className="font-medium text-gray-700">{i + 1}. {row.criterion}</span>
                  {row.kpi && <span className="text-gray-500"> · {row.kpi}</span>}
                  {row.goal && <span className="text-blue-700"> → {row.goal}</span>}
                </div>
              ))}
              <FieldRow label="Medição pós-entrega" value={intake.postDeliveryMeasurement} />
            </SectionBox>
          )}

          {intake.dataOwnerName && (
            <SectionBox title="F — Governança">
              <FieldRow label="Data Owner" value={intake.dataOwnerName} />
              <FieldRow label="Data Steward" value={intake.dataStewardName} />
              <FieldRow label="Privacy Champion" value={intake.privacyChampion} />
              <FieldRow label="Sensibilidade" value={intake.dataSensitivity} />
              <FieldRow label="Acesso ao dado final" value={intake.accessGroups} />
              <FieldRow label="Regulamentações" value={intake.applicableRegulations} />
              <FieldRow label="Retenção" value={intake.retentionPeriod} />
            </SectionBox>
          )}

          {intake.technicalDependencies && (
            <SectionBox title="G — Dependências e Riscos">
              <FieldRow label="Dependências técnicas" value={intake.technicalDependencies} />
              <FieldRow label="Riscos identificados" value={intake.identifiedRisks} />
              <FieldRow label="Demandas relacionadas" value={intake.relatedDemands} />
              <FieldRow label="Ambiente de testes" value={intake.testEnvironmentAvailable} />
              <FieldRow label="Infraestrutura de rede" value={intake.networkInfraNeeded} />
            </SectionBox>
          )}

          {intake.totalScore != null && (
            <SectionBox title="Pontuação P1-P4">
              <div className="flex items-center gap-3">
                <TierBadge tier={intake.priorityTier} score={intake.totalScore} />
                <span className="text-xs text-gray-500">{TIER_META[intake.priorityTier]?.sla}</span>
              </div>
              {intake.scoringNotes && <p className="text-xs text-gray-500 italic">{intake.scoringNotes}</p>}
            </SectionBox>
          )}

          {intake.reviewedByName && (
            <SectionBox title="Revisão">
              <FieldRow label="Revisado por" value={intake.reviewedByName} />
              <FieldRow label="Notas" value={intake.reviewNotes} />
              {intake.returnReason && <p className="text-xs text-orange-600">Motivo do retorno: {intake.returnReason}</p>}
            </SectionBox>
          )}

          {["aprovado_estrategico", "aprovado_operacional", "em_execucao", "em_validacao", "concluido"].includes(intake.status) && isPrivileged && (
            <ExecutionPanel intake={intake} onDone={onClose} />
          )}

          {canTriage && !showTriage && (
            <Button variant="outline" size="sm" onClick={() => setShowTriage(true)} className="w-full">
              Realizar Triagem
            </Button>
          )}
          {showTriage && (
            <TriagePanel intake={intake} onClose={() => setShowTriage(false)}
              onDone={() => { setShowTriage(false); onClose(); }} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Painel de Execução ───────────────────────────────────────────────────────

function ExecutionPanel({ intake, onDone }: { intake: any; onDone: () => void }) {
  const [execNotes, setExecNotes] = useState("");
  const [deliverNotes, setDeliverNotes] = useState("");
  const [validateNotes, setValidateNotes] = useState("");
  const utils = trpc.useUtils();

  const invalidate = () => {
    utils.intake.list.invalidate();
    utils.intake.counts.invalidate();
  };

  const startMut   = trpc.intake.startExecution.useMutation({ onSuccess: () => { invalidate(); onDone(); } });
  const deliverMut = trpc.intake.deliver.useMutation({ onSuccess: () => { invalidate(); onDone(); } });
  const validateMut = trpc.intake.validate.useMutation({ onSuccess: () => { invalidate(); onDone(); } });

  const s = intake.status;

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-3 text-sm">
      <p className="font-medium text-gray-700 flex items-center gap-1">
        <PlayCircle className="h-4 w-4 text-blue-600" /> Fase de Execução
      </p>

      {/* Linha do tempo de execução */}
      <div className="flex items-center gap-1 text-xs">
        {[
          { key: "aprovado",    label: "Aprovado",   done: true },
          { key: "execucao",   label: "Execução",   done: ["em_execucao","em_validacao","concluido"].includes(s) },
          { key: "entrega",    label: "Entregue",   done: ["em_validacao","concluido"].includes(s) },
          { key: "validacao",  label: "Validado",   done: s === "concluido" },
        ].map((step, i) => (
          <div key={step.key} className="flex items-center gap-1">
            {i > 0 && <div className={`h-px w-4 ${step.done ? "bg-green-500" : "bg-gray-200"}`} />}
            <span className={`px-1.5 py-0.5 rounded-full font-medium ${step.done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {/* Iniciar execução */}
      {["aprovado_estrategico", "aprovado_operacional"].includes(s) && (
        <div className="space-y-2">
          <Textarea value={execNotes} onChange={e => setExecNotes(e.target.value)}
            placeholder="Notas de planejamento / escopo..." rows={2} className="text-xs" />
          <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            disabled={startMut.isPending} onClick={() => startMut.mutate({ id: intake.id, executionNotes: execNotes || undefined })}>
            {startMut.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <PlayCircle className="h-3.5 w-3.5 mr-1" />}
            Iniciar Execução
          </Button>
        </div>
      )}

      {/* Marcar entregue */}
      {s === "em_execucao" && (
        <div className="space-y-2">
          {intake.executorName && <p className="text-xs text-gray-500">Executor: {intake.executorName}</p>}
          {intake.executionNotes && <p className="text-xs text-gray-600 italic">{intake.executionNotes}</p>}
          <Textarea value={deliverNotes} onChange={e => setDeliverNotes(e.target.value)}
            placeholder="Descreva o que foi entregue..." rows={2} className="text-xs" />
          <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={deliverMut.isPending} onClick={() => deliverMut.mutate({ id: intake.id, deliveryNotes: deliverNotes || undefined })}>
            {deliverMut.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <PackageCheck className="h-3.5 w-3.5 mr-1" />}
            Marcar como Entregue
          </Button>
        </div>
      )}

      {/* Validação final */}
      {s === "em_validacao" && (
        <div className="space-y-2">
          {intake.deliveredAt && <p className="text-xs text-gray-500">Entregue em: {new Date(intake.deliveredAt).toLocaleDateString("pt-BR")}</p>}
          {intake.deliveryNotes && <p className="text-xs text-gray-600 italic">{intake.deliveryNotes}</p>}
          <Textarea value={validateNotes} onChange={e => setValidateNotes(e.target.value)}
            placeholder="Notas de validação / aceite final..." rows={2} className="text-xs" />
          <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white"
            disabled={validateMut.isPending} onClick={() => validateMut.mutate({ id: intake.id, deliveryNotes: validateNotes || undefined })}>
            {validateMut.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1" />}
            Validar Entrega (Data Owner)
          </Button>
        </div>
      )}

      {s === "concluido" && (
        <div className="flex items-center gap-2 text-green-700 text-xs font-medium">
          <CheckCircle2 className="h-4 w-4" />
          Concluído e validado por {intake.validatedByName ?? "—"}
          {intake.validatedAt && ` em ${new Date(intake.validatedAt).toLocaleDateString("pt-BR")}`}
        </div>
      )}
    </div>
  );
}

function IntakeRow({ item, onClick }: { item: any; onClick: () => void }) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors" onClick={onClick}>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          {item.intakeCode && <span className="text-[10px] font-mono text-gray-400">{item.intakeCode}</span>}
          <span className="text-sm font-medium text-gray-800 line-clamp-1">{item.title}</span>
          <span className="text-xs text-gray-400">{item.submitterName} · {item.submitterDept ?? "—"}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">{TYPE_LABELS[item.type] ?? item.type}</td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <PriorityBadge priority={item.priority} />
          {item.priorityTier && <TierBadge tier={item.priorityTier} score={item.totalScore} />}
        </div>
      </td>
      <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
      <td className="px-4 py-3 text-xs text-gray-400">
        {item.createdAt ? new Date(item.createdAt).toLocaleDateString("pt-BR") : "—"}
      </td>
      <td className="px-4 py-3 text-gray-400"><ChevronRight className="h-4 w-4" /></td>
    </tr>
  );
}

// ─── Cards das abas Comitê / Implementação ────────────────────────────────────

const IMPL_STEPS: Array<{ label: string; done: (s: string) => boolean }> = [
  { label: "Kickoff",    done: (s) => ["em_execucao","em_validacao","concluido"].includes(s) },
  { label: "Desenvolv.", done: (s) => ["em_validacao","concluido"].includes(s) },
  { label: "Qualidade",  done: (s) => ["em_validacao","concluido"].includes(s) },
  { label: "Entrega",    done: (s) => ["em_validacao","concluido"].includes(s) },
  { label: "Validação",  done: (s) => s === "concluido" },
];

function CommitteeCard({ item, onClick }: { item: any; onClick: () => void }) {
  const accent: Record<string, string> = {
    em_triagem:           "border-l-yellow-400",
    aprovado_estrategico: "border-l-blue-400",
    aprovado_operacional: "border-l-emerald-400",
  };
  return (
    <Card
      className={`cursor-pointer hover:shadow-sm transition-shadow border-l-4 ${accent[item.status] ?? "border-l-gray-200"}`}
      onClick={onClick}
    >
      <CardContent className="p-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {item.intakeCode && (
              <span className="text-[10px] font-mono text-gray-400">{item.intakeCode}</span>
            )}
            {item.priorityTier
              ? <TierBadge tier={item.priorityTier} score={item.totalScore} />
              : <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 rounded px-1.5 py-0.5">Sem triagem</span>
            }
          </div>
          <p className="text-sm font-semibold text-gray-800 line-clamp-1">{item.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{item.submitterName} · {item.submitterDept ?? "—"}</p>
          {item.businessJustification && (
            <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 italic border-l-2 border-gray-200 pl-2">
              {item.businessJustification}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StatusBadge status={item.status} />
          {item.priorityTier && (
            <span className="text-[10px] text-gray-400">{TIER_META[item.priorityTier]?.sla}</span>
          )}
          <ChevronRight className="h-4 w-4 text-gray-300 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}

function ImplCard({ item, onClick }: { item: any; onClick: () => void }) {
  const doneCount = IMPL_STEPS.filter(s => s.done(item.status)).length;
  const pct = Math.round((doneCount / IMPL_STEPS.length) * 100);
  return (
    <Card className="cursor-pointer hover:shadow-sm transition-shadow" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {item.intakeCode && <span className="text-[10px] font-mono text-gray-400">{item.intakeCode}</span>}
              {item.priorityTier && <TierBadge tier={item.priorityTier} />}
            </div>
            <p className="text-sm font-semibold text-gray-800 line-clamp-1">{item.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{item.submitterName} · {item.submitterDept ?? "—"}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <StatusBadge status={item.status} />
            <span className="text-xs font-bold text-emerald-700">{pct}%</span>
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
          <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-5 gap-1">
          {IMPL_STEPS.map((step, i) => {
            const done = step.done(item.status);
            return (
              <div key={i} className="flex flex-col items-center gap-0.5 text-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  done ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-300"
                }`}>
                  {done
                    ? <CheckCircle2 className="h-3.5 w-3.5" />
                    : <div className="w-2 h-2 rounded-full bg-gray-200" />
                  }
                </div>
                <span className="text-[9px] text-gray-400 leading-tight">{step.label}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function IntakePage() {
  const { user } = useAuth();
  const [showNew, setShowNew] = useState(false);
  const [selectedIntake, setSelectedIntake] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tab, setTab] = useState<"all" | "mine" | "ranking" | "comite" | "implementacao">("all");

  const isPrivileged = ["admin", "data_owner", "data_steward"].includes(user?.role ?? "");

  const listQuery = trpc.intake.list.useQuery(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );
  const countsQuery = trpc.intake.counts.useQuery();
  const rankingQuery = trpc.intake.ranking.useQuery(undefined, { enabled: isPrivileged });

  const items = listQuery.data ?? [];
  const counts = countsQuery.data;
  const rankingItems = rankingQuery.data ?? [];
  const comiteItems = items.filter((i: any) =>
    ["em_triagem", "aprovado_estrategico", "aprovado_operacional"].includes(i.status)
  );
  const implItems = items.filter((i: any) =>
    ["em_execucao", "em_validacao", "concluido"].includes(i.status)
  );

  const myItems = items.filter((i: any) => i.submittedById === user?.id);
  const displayItems = (!isPrivileged || tab === "mine") ? myItems : items;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Inbox className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Entrada de Demandas</h1>
            <p className="text-sm text-gray-500">Submeta e acompanhe demandas ao Lucid Data Governance</p>
          </div>
        </div>
        <Button onClick={() => setShowNew(true)} size="lg" className="flex-shrink-0 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="h-4 w-4" />
          Nova Demanda
        </Button>
      </div>

      {/* KPIs */}
      {counts && (
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {[
            { key: "submetido",            label: "Submetidos" },
            { key: "em_triagem",           label: "Em Triagem" },
            { key: "aprovado_estrategico", label: "Aprov. Estratég." },
            { key: "aprovado_operacional", label: "Aprov. Oper." },
            { key: "em_execucao",          label: "Em Execução" },
            { key: "concluido",            label: "Concluídos" },
            { key: "retornado",            label: "Retornados" },
            { key: "rejeitado",            label: "Rejeitados" },
          ].map(({ key, label }) => {
            const meta = STATUS_META[key] ?? STATUS_META["submetido"];
            const Icon = meta.icon;
            return (
              <Card key={key} className="cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => { setStatusFilter(statusFilter === key ? "all" : key); setTab("all"); }}>
                <CardContent className="p-2 flex flex-col items-center text-center">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${meta.color} mb-1`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-lg font-bold text-gray-800">
                    {(counts as any)[key] ?? 0}
                  </span>
                  <span className="text-[10px] text-gray-500 leading-tight">{label}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-gray-200">
        {(isPrivileged
          ? [
              { key: "all",     label: "Todas as Demandas" },
              { key: "mine",    label: "Minhas Demandas" },
              { key: "ranking",       label: "Ranking de Prioridade" },
              { key: "comite",        label: "Pauta do Comitê" },
              { key: "implementacao", label: "Implementação" },
            ]
          : [{ key: "mine", label: "Minhas Demandas" }]
        ).map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key as any); if (["comite","implementacao"].includes(t.key)) setStatusFilter("all"); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.key
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
          {/* Filtro de status — só nas abas de lista */}
          {(tab === "all" || tab === "mine") && (
            <div className="ml-auto flex items-center gap-2 pb-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {Object.entries(STATUS_META).map(([v, m]) => (
                    <SelectItem key={v} value={v}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

      {/* Aba Ranking */}
      {tab === "ranking" && (
        <Card>
          <CardContent className="p-0">
            {rankingQuery.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : rankingItems.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <BarChart2 className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">Nenhuma demanda pontuada ainda</p>
                <p className="text-gray-400 text-sm mt-1">Realize a triagem de demandas para gerar o ranking.</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase w-10">#</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Demanda</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase text-center">Tier</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase text-center">Pontuação</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">SLA</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-2.5 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rankingItems.map((item: any, idx: number) => (
                      <tr key={item.id}
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => setSelectedIntake(item)}>
                        <td className="px-4 py-3 text-sm font-bold text-gray-400">#{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            {item.intakeCode && <span className="text-[10px] font-mono text-gray-400">{item.intakeCode}</span>}
                            <span className="text-sm font-medium text-gray-800 line-clamp-1">{item.title}</span>
                            <span className="text-xs text-gray-400">{item.submitterName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.priorityTier ? <TierBadge tier={item.priorityTier} /> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-bold text-gray-700">{item.totalScore ?? "—"}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {item.priorityTier ? TIER_META[item.priorityTier]?.sla : "—"}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                        <td className="px-4 py-3 text-gray-400"><ChevronRight className="h-4 w-4" /></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Aba Comitê */}
      {tab === "comite" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-semibold text-gray-700">Pauta do Lucid Data Governance</span>
              <span className="text-xs text-gray-400 font-mono">
                {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
              </span>
            </div>
            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5 font-medium">
              {comiteItems.length} item(s) na pauta
            </span>
          </div>

          {listQuery.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : comiteItems.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-16 text-center">
                <Users className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">Pauta vazia</p>
                <p className="text-gray-400 text-sm mt-1">Nenhuma demanda em triagem ou aguardando votação.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-5">
              {[
                { status: "em_triagem",           label: "Em Triagem — Aguardando Score P1-P4",       dot: "bg-yellow-400"  },
                { status: "aprovado_estrategico",  label: "Aprovação Estratégica — Votação em Curso",  dot: "bg-blue-400"    },
                { status: "aprovado_operacional",  label: "Aprovação Operacional — Aguardando Início", dot: "bg-emerald-400" },
              ].map(({ status, label, dot }) => {
                const group = comiteItems.filter((i: any) => i.status === status);
                if (group.length === 0) return null;
                return (
                  <div key={status}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {label} ({group.length})
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                      {group.map((item: any) => (
                        <CommitteeCard key={item.id} item={item} onClick={() => setSelectedIntake(item)} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Aba Implementação */}
      {tab === "implementacao" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-emerald-600" />
              <span className="text-sm font-semibold text-gray-700">Checklist de Implementação</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
                {implItems.filter((i: any) => i.status === "em_execucao").length} em execução
              </span>
              <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                {implItems.filter((i: any) => i.status === "em_validacao").length} em validação
              </span>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">
                {implItems.filter((i: any) => i.status === "concluido").length} concluídos
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 px-1 pb-2 border-b border-gray-100 flex-wrap">
            {IMPL_STEPS.map((step, i) => (
              <div key={i} className="flex items-center gap-1 text-xs text-gray-400">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                <span>{step.label}</span>
              </div>
            ))}
          </div>

          {listQuery.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : implItems.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-16 text-center">
                <ListChecks className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">Sem demandas em implementação</p>
                <p className="text-gray-400 text-sm mt-1">Aprove demandas para iniciar a fase de execução.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {implItems.map((item: any) => (
                <ImplCard key={item.id} item={item} onClick={() => setSelectedIntake(item)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabela de demandas (abas "all" e "mine") */}
      {(tab === "all" || tab === "mine") && (
      <Card>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : displayItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">Nenhuma demanda encontrada</p>
              <p className="text-gray-400 text-sm mt-1">
                {statusFilter !== "all" ? "Tente remover o filtro de status." : "Use o botão \"Nova Demanda\" no topo da página."}
              </p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Demanda</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Tipo</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Prioridade / Tier</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Data</th>
                  <th className="px-4 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item: any) => (
                  <IntakeRow key={item.id} item={item} onClick={() => setSelectedIntake(item)} />
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      )}

      {/* Modais */}
      <MultiStepIntakeDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        onSuccess={() => setShowNew(false)}
      />

      {selectedIntake && (
        <IntakeDetailSheet
          intake={selectedIntake}
          open={!!selectedIntake}
          onClose={() => setSelectedIntake(null)}
          isPrivileged={isPrivileged}
        />
      )}
    </div>
  );
}
