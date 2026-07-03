import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Tag, ShieldCheck, RefreshCw,
  BarChart3, FileText, ClipboardList, CheckCircle2,
  AlertTriangle, Clock, ArrowRight, Building2, DollarSign, Globe,
  CheckCircle, XCircle, ChevronRight, X, Search,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type TagPolicy = {
  id: number; tagKey: string; displayName: string; description: string | null;
  allowedValues: string; colorMap: string; appliesTo: "table" | "column" | "both";
  category: string | null; isRequired: boolean | null; autoSync: boolean | null;
  sensitivityMapping: string; createdById: number | null; createdAt: Date; updatedAt: Date;
};

type FormState = {
  id?: number; tagKey: string; displayName: string; description: string;
  allowedValuesRaw: string; isRequired: boolean; autoSync: boolean;
  appliesToTable: boolean; appliesToColumn: boolean; category: string;
  colorMap: Record<string, string>; sensitivityMapping: Record<string, string>;
};

const EMPTY_FORM: FormState = {
  tagKey: "", displayName: "", description: "", allowedValuesRaw: "",
  isRequired: false, autoSync: false, appliesToTable: true, appliesToColumn: false,
  category: "compliance", colorMap: {}, sensitivityMapping: {},
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseJson<T>(json: unknown, fallback: T): T {
  if (!json || typeof json !== "string") return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

function appliesToLabel(v: string) {
  if (v === "both") return "tabela, coluna";
  if (v === "table") return "tabela";
  return "coluna";
}

function derivedAppliesTo(t: boolean, c: boolean): "table" | "column" | "both" {
  if (t && c) return "both";
  if (c) return "column";
  return "table";
}

const CAT_ICONS: Record<string, React.ReactNode> = {
  compliance: <ShieldCheck className="h-5 w-5" />,
  ownership:  <Building2  className="h-5 w-5" />,
  cost:       <DollarSign className="h-5 w-5" />,
  discovery:  <Globe      className="h-5 w-5" />,
  security:   <ShieldCheck className="h-5 w-5" />,
};

const CAT_COLORS: Record<string, string> = {
  compliance: "bg-red-100 text-red-600",
  ownership:  "bg-blue-100 text-blue-600",
  cost:       "bg-green-100 text-green-600",
  discovery:  "bg-purple-100 text-purple-600",
  security:   "bg-orange-100 text-orange-600",
};

// ─── Policy Card ──────────────────────────────────────────────────────────────
function PolicyCard({ policy, assignmentCount, canEdit, onEdit, onDelete }: {
  policy: TagPolicy; assignmentCount: number; canEdit: boolean;
  onEdit: (p: TagPolicy) => void; onDelete: (id: number) => void;
}) {
  const vals = parseJson<string[]>(policy.allowedValues, []);
  const cmap = parseJson<Record<string, string>>(policy.colorMap, {});
  const cat  = policy.category ?? "compliance";

  return (
    <div className="rounded-xl border bg-card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 ${CAT_COLORS[cat] ?? "bg-gray-100 text-gray-600"}`}>
            {CAT_ICONS[cat] ?? <Tag className="h-5 w-5" />}
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight">{policy.tagKey}</p>
            <p className="text-xs text-muted-foreground">{policy.displayName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {policy.isRequired
            ? <Badge className="bg-red-100 text-red-700 border-red-200 text-[11px]">Obrigatória</Badge>
            : <Badge variant="outline" className="text-[11px] text-muted-foreground">Opcional</Badge>}
          {canEdit && (
            <div className="flex gap-0.5 ml-1">
              <button onClick={() => onEdit(policy)}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => onDelete(policy.id)}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {policy.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{policy.description}</p>
      )}

      {vals.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {vals.map(v => (
            <span key={v}
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: cmap[v] ?? "#6b7280" }}>
              {v}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground italic">Forma livre (qualquer valor)</span>
      )}

      <div className="flex items-center justify-between pt-1 border-t mt-auto">
        <span className="text-xs text-muted-foreground">
          Aplica-se a: <strong className="text-foreground">{appliesToLabel(policy.appliesTo)}</strong>
        </span>
        {assignmentCount > 0 && (
          <span className="text-xs text-blue-600 font-medium flex items-center gap-0.5 cursor-default">
            {assignmentCount} atribuições <ArrowRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, iconBg, highlight, warn, onClick }: {
  label: string; value: number | string; sub?: string; icon: React.ReactNode;
  iconBg: string; highlight?: boolean; warn?: boolean; onClick?: () => void;
}) {
  return (
    <div
      className={`rounded-xl border bg-card p-4 flex items-start gap-3 relative ${
        onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all hover:ring-2 hover:ring-offset-1 hover:ring-indigo-200" : ""
      }`}
      onClick={onClick}
    >
      <div className={`rounded-lg p-2 shrink-0 ${iconBg}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold leading-tight">{value}</p>
        {sub && (
          <p className={`text-xs mt-0.5 ${warn ? "text-amber-600" : highlight ? "text-green-600" : "text-muted-foreground"}`}>
            {warn && <AlertTriangle className="inline h-3 w-3 mr-0.5" />}{sub}
          </p>
        )}
      </div>
      {onClick && <ChevronRight size={11} className="absolute bottom-2 right-2 text-gray-300" />}
    </div>
  );
}

// ─── Empty Tab ────────────────────────────────────────────────────────────────
function EmptyTab({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-dashed py-16 text-center">
      <div className="text-muted-foreground mx-auto mb-3 opacity-40">{icon}</div>
      <p className="font-medium text-muted-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">{desc}</p>
    </div>
  );
}

// ─── Compliance Tab ───────────────────────────────────────────────────────────
function ComplianceTab({ policies }: { policies: TagPolicy[] }) {
  const requiredPolicies = policies.filter(p => p.isRequired);
  const requiredTagKeys = requiredPolicies.map(p => p.tagKey);

  const { data: complianceRows = [], isLoading } = trpc.governance.getTagComplianceByAsset.useQuery(
    { requiredTagKeys },
    { enabled: requiredTagKeys.length > 0 }
  );

  if (policies.length === 0 || requiredTagKeys.length === 0) {
    return (
      <EmptyTab
        icon={<FileText className="h-10 w-10" />}
        title="Nenhuma política obrigatória definida"
        desc="Marque ao menos uma política de tag como 'Obrigatória' para visualizar o relatório de conformidade dos ativos." />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <span className="text-sm text-muted-foreground">Analisando conformidade dos ativos...</span>
      </div>
    );
  }

  const rows = complianceRows as Array<{
    assetId: number; assetName: string;
    tagsPresent: Record<string, string[]>;
    tagsMissing: string[];
    isConforming: boolean;
  }>;

  const conformingCount = rows.filter(r => r.isConforming).length;
  const totalCount = rows.length;
  const compliancePct = totalCount > 0 ? Math.round((conformingCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Barra de progresso */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold">Conformidade Geral</p>
            <p className="text-xs text-muted-foreground">
              {conformingCount} de {totalCount} ativos em conformidade com as políticas obrigatórias
              {" "}({requiredTagKeys.join(", ")})
            </p>
          </div>
          <span className={`text-2xl font-bold ${compliancePct >= 80 ? "text-green-600" : compliancePct >= 60 ? "text-amber-600" : "text-red-600"}`}>
            {compliancePct}% conformes
          </span>
        </div>
        <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${compliancePct >= 80 ? "bg-green-500" : compliancePct >= 60 ? "bg-amber-400" : "bg-red-500"}`}
            style={{ width: `${compliancePct}%` }}
          />
        </div>
        {compliancePct < 100 && totalCount > 0 && (
          <p className="text-xs text-amber-700 mt-2 font-medium">
            <AlertTriangle className="inline h-3 w-3 mr-0.5" />
            {totalCount - conformingCount} ativo(s) sem Regulation = LGPD ou outras tags obrigatórias
          </p>
        )}
      </div>

      {/* Lista de ativos com status */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="bg-muted/40 border-b px-4 py-2.5 flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status por Ativo</p>
          <span className="text-[10px] text-muted-foreground">Baseado em tags geradas via Auto-Tagear com IA</span>
        </div>
        <div className="divide-y">
          {rows.map(({ assetId, assetName, tagsPresent, tagsMissing, isConforming }) => (
            <div key={assetId} className={`flex items-center gap-4 px-4 py-3 ${isConforming ? "hover:bg-green-50/30" : "hover:bg-amber-50/30"} transition-colors`}>
              <div className="shrink-0">
                {isConforming
                  ? <CheckCircle className="h-5 w-5 text-green-500" />
                  : <AlertTriangle className="h-5 w-5 text-amber-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{assetName}</p>
                {isConforming ? (
                  <p className="text-xs text-muted-foreground truncate">
                    {Object.entries(tagsPresent)
                      .filter(([k]) => requiredTagKeys.includes(k))
                      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(", ") : v}`)
                      .join(" · ")}
                  </p>
                ) : (
                  <p className="text-xs text-amber-700 font-medium">
                    <AlertTriangle className="inline h-3 w-3 mr-0.5" />
                    Falta tag {tagsMissing.map(k => (
                      <span key={k} className="font-bold text-amber-800 underline decoration-dotted">{k}</span>
                    )).reduce((acc: React.ReactNode[], el, i) => i === 0 ? [el] : [...acc, ", ", el], [])}
                    {" — Execute "}<span className="font-semibold">Auto-Tagear com IA</span> no Dicionário
                  </p>
                )}
              </div>
              <div className="shrink-0">
                <Badge
                  className={isConforming
                    ? "bg-green-100 text-green-700 border-green-200 text-[11px] font-semibold"
                    : "bg-amber-100 text-amber-700 border-amber-200 text-[11px] font-semibold"
                  }
                  variant="outline"
                >
                  {isConforming ? "Conforme" : "Corrigir"}
                </Badge>
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="px-4 py-12 text-center space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Nenhum ativo encontrado no catálogo.</p>
              <p className="text-xs text-muted-foreground">Cadastre ativos no Catálogo de Dados para acompanhar a conformidade aqui.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function TagPolicies() {
  const { user } = useAuth();
  const isAdminOrSteward = user?.role === "admin" || user?.role === "data_steward";

  // Dados reais do backend
  const { data: policies = [], refetch } = trpc.governance.getTagPolicies.useQuery();
  const { data: stats }                  = trpc.governance.getTagPolicyStats.useQuery();
  const tagKeys = useMemo(() => (policies as TagPolicy[]).map(p => p.tagKey), [policies]);
  const { data: counts = {} } = trpc.governance.getTagAssignmentCounts.useQuery(
    { tagKeys }, { enabled: tagKeys.length > 0 },
  );

  // Mutations
  const saveMutation = trpc.governance.saveTagPolicy.useMutation({
    onSuccess: () => { toast.success("Política salva com sucesso."); setDialogOpen(false); refetch(); },
    onError:   e  => toast.error(e.message),
  });
  const deleteMutation = trpc.governance.deleteTagPolicy.useMutation({
    onSuccess: () => { toast.success("Política removida."); setDeleteId(null); refetch(); },
    onError:   e  => toast.error(e.message),
  });

  // Estado local
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm]             = useState<FormState>(EMPTY_FORM);
  const [deleteId, setDeleteId]     = useState<number | null>(null);

  function openCreate() { setForm(EMPTY_FORM); setDialogOpen(true); }

  function openEdit(p: TagPolicy) {
    const vals = parseJson<string[]>(p.allowedValues, []);
    setForm({
      id: p.id, tagKey: p.tagKey, displayName: p.displayName, description: p.description ?? "",
      allowedValuesRaw: vals.join(", "),
      isRequired: p.isRequired ?? false, autoSync: p.autoSync ?? false,
      appliesToTable:  p.appliesTo === "table"  || p.appliesTo === "both",
      appliesToColumn: p.appliesTo === "column" || p.appliesTo === "both",
      category: p.category ?? "compliance",
      colorMap:          parseJson<Record<string, string>>(p.colorMap, {}),
      sensitivityMapping: parseJson<Record<string, string>>(p.sensitivityMapping, {}),
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.tagKey.trim() || !form.displayName.trim()) {
      toast.error("Preencha a Chave da Tag e o Nome de Exibição."); return;
    }
    const allowedValues = form.allowedValuesRaw.split(",").map(v => v.trim()).filter(Boolean);
    saveMutation.mutate({
      id: form.id, tagKey: form.tagKey.trim(), displayName: form.displayName.trim(),
      description: form.description || undefined, allowedValues,
      isRequired: form.isRequired, autoSync: form.autoSync,
      appliesTo: derivedAppliesTo(form.appliesToTable, form.appliesToColumn),
      category: form.category || undefined,
      colorMap:          Object.keys(form.colorMap).length          > 0 ? form.colorMap          : undefined,
      sensitivityMapping: Object.keys(form.sensitivityMapping).length > 0 ? form.sensitivityMapping : undefined,
    });
  }

  // Stats calculados a partir do backend
  const policyList            = policies as TagPolicy[];
  const totalPolicies         = stats?.totalPolicies         ?? policyList.length;
  const totalTaggedAttributes = stats?.totalTaggedAttributes ?? 0;
  const compliancePct         = stats?.compliancePct         ?? 0;
  const pendingSync           = stats?.pendingSync           ?? 0;

  // ── Drill-down dos cards de KPI ─────────────────────────────────────────────
  type TagDrillType = "policies" | "tags" | "compliance" | "sync" | null;
  const [tagDrill, setTagDrill] = useState<TagDrillType>(null);
  const [tagDrillSearch, setTagDrillSearch] = useState("");

  const tagDrillItems = useMemo(() => {
    let items: Array<{ key: string; label: string; sub: string; badge?: string; badgeColor?: string }> = [];
    switch (tagDrill) {
      case "policies":
        items = policyList.map(p => ({
          key: p.tagKey,
          label: p.tagKey,
          sub: p.displayName + (p.description ? ` — ${p.description}` : ""),
          badge: p.isRequired ? "Obrigatória" : "Opcional",
          badgeColor: p.isRequired ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600",
        }));
        break;
      case "tags":
        items = policyList
          .filter(p => (counts[p.tagKey] ?? 0) > 0)
          .map(p => ({
            key: p.tagKey,
            label: p.tagKey,
            sub: `${counts[p.tagKey]} atribuição(ões) · ${p.displayName}`,
            badge: `${counts[p.tagKey]}`,
            badgeColor: "bg-green-100 text-green-700",
          }));
        break;
      case "compliance":
        items = policyList.map(p => ({
          key: p.tagKey,
          label: p.tagKey,
          sub: p.isRequired ? `Política obrigatória — ${p.displayName}` : `Política opcional — ${p.displayName}`,
          badge: p.isRequired ? "Obrigatória" : "Opcional",
          badgeColor: p.isRequired ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600",
        }));
        break;
      case "sync":
        items = policyList
          .filter(p => p.autoSync)
          .map(p => ({
            key: p.tagKey,
            label: p.tagKey,
            sub: `Auto-sync ativo · ${p.displayName}`,
            badge: "Auto-sync",
            badgeColor: "bg-amber-100 text-amber-700",
          }));
        if (items.length === 0) {
          items = policyList.map(p => ({
            key: p.tagKey,
            label: p.tagKey,
            sub: `Sync manual · ${p.displayName}`,
            badge: "Manual",
            badgeColor: "bg-gray-100 text-gray-600",
          }));
        }
        break;
    }
    if (!tagDrillSearch.trim()) return items;
    const q = tagDrillSearch.toLowerCase();
    return items.filter(i => i.label.toLowerCase().includes(q) || i.sub.toLowerCase().includes(q));
  }, [tagDrill, policyList, counts, tagDrillSearch]);

  const tagDrillMeta: Record<Exclude<TagDrillType, null>, { title: string; description: string }> = {
    policies:    { title: "Políticas Ativas",         description: "Todas as políticas de tag definidas no catálogo." },
    tags:        { title: "Tags Atribuídas",          description: "Políticas que possuem atribuições em ativos de dados." },
    compliance:  { title: "Políticas de Compliance",  description: "Visão das políticas e seu status de obrigatoriedade." },
    sync:        { title: "Sincronização Databricks", description: "Políticas com auto-sync habilitado para o Unity Catalog." },
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-indigo-100 p-2 text-indigo-600">
            <Tag className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Tags Governadas</h1>
            <p className="text-sm text-muted-foreground">
              Políticas centralizadas de metadados integradas ao Databricks Unity Catalog
            </p>
          </div>
        </div>
        {isAdminOrSteward && (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" className="gap-2 text-sm"
              onClick={() => toast.info("Use o Dicionário de Dados para sincronizar ativos individuais com o Databricks.")}>
              <RefreshCw className="h-4 w-4" /> Sincronizar Databricks
            </Button>
            <Button onClick={openCreate} className="gap-2 text-sm">
              <Plus className="h-4 w-4" /> Nova Política
            </Button>
          </div>
        )}
      </div>

      {/* Stats cards — todos baseados em dados reais do backend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="POLÍTICAS ATIVAS" value={totalPolicies}
          sub={policyList.slice(0, 4).map(p => p.tagKey).join(", ") || "Nenhuma política ainda"}
          icon={<Tag className="h-5 w-5 text-blue-500" />} iconBg="bg-blue-50"
          onClick={() => { setTagDrillSearch(""); setTagDrill("policies"); }} />
        <StatCard
          label="TAGS ATRIBUÍDAS" value={totalTaggedAttributes}
          sub={totalTaggedAttributes > 0 ? "Atributos com sugestão de IA" : "Nenhum atributo tagueado"}
          icon={<CheckCircle2 className="h-5 w-5 text-green-500" />} iconBg="bg-green-50"
          highlight={totalTaggedAttributes > 0}
          onClick={() => { setTagDrillSearch(""); setTagDrill("tags"); }} />
        <StatCard
          label="COMPLIANCE" value={`${compliancePct}%`}
          sub={stats
            ? `${stats.verifiedAttributes} de ${stats.totalAttributes} atributos verificados`
            : "Percentual de atributos verificados"}
          icon={<ShieldCheck className="h-5 w-5 text-indigo-500" />} iconBg="bg-indigo-50"
          warn={compliancePct < 60 && (stats?.totalAttributes ?? 0) > 0}
          onClick={() => { setTagDrillSearch(""); setTagDrill("compliance"); }} />
        <StatCard
          label="PENDENTE SYNC" value={pendingSync}
          sub="Ativos Databricks aguardando sincronização"
          icon={<Clock className="h-5 w-5 text-amber-500" />} iconBg="bg-amber-50"
          warn={pendingSync > 0}
          onClick={() => { setTagDrillSearch(""); setTagDrill("sync"); }} />
      </div>

      {/* Modal de drill-down dos cards de KPI */}
      {tagDrill && (
        <Dialog open onOpenChange={() => setTagDrill(null)}>
          <DialogContent className="max-w-xl max-h-[75vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Tag size={15} className="text-indigo-600" />
                {tagDrillMeta[tagDrill].title}
                <span className="ml-1 text-xs font-semibold text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">
                  {tagDrillItems.length}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                {tagDrillMeta[tagDrill].description}
              </DialogDescription>
            </DialogHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar política..."
                className="w-full pl-8 pr-3 h-8 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200"
                value={tagDrillSearch}
                onChange={(e) => setTagDrillSearch(e.target.value)}
              />
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-gray-100 rounded-lg border border-gray-100">
              {tagDrillItems.length === 0 ? (
                <div className="p-10 text-center text-sm text-gray-400">Nenhuma política encontrada.</div>
              ) : (
                tagDrillItems.map(item => (
                  <div key={item.key} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <Tag size={14} className="text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900 font-mono">{item.label}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{item.sub}</p>
                      </div>
                    </div>
                    {item.badge && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border border-transparent ml-2 flex-shrink-0 ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end pt-1">
              <button
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 border border-gray-200 rounded px-3 py-1.5 transition-colors"
                onClick={() => setTagDrill(null)}
              >
                <X size={12} /> Fechar
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Tabs */}
      <Tabs defaultValue="policies">
        <TabsList className="border-b w-full justify-start rounded-none bg-transparent p-0 h-auto">
          {[
            { value: "policies",    label: "Políticas de Tags" },
            { value: "assignments", label: "Atribuições" },
            { value: "compliance",  label: "Relatório de Compliance" },
            { value: "audit",       label: "Log de Auditoria" },
          ].map(t => (
            <TabsTrigger key={t.value} value={t.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 pb-2 px-4 text-sm font-medium">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Aba: Políticas de Tags */}
        <TabsContent value="policies" className="pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <strong>{policyList.length}</strong> política{policyList.length !== 1 ? "s" : ""} definida
              {policyList.length > 0 && " · Valores pré-aprovados para uso em tabelas, colunas, schemas e catálogos"}
            </p>
            {isAdminOrSteward && (
              <button onClick={openCreate}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Adicionar política
              </button>
            )}
          </div>

          {policyList.length === 0 ? (
            <div className="rounded-xl border border-dashed py-16 text-center">
              <Tag className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium text-muted-foreground">Nenhuma política de tag definida</p>
              {isAdminOrSteward && (
                <Button onClick={openCreate} variant="outline" className="mt-4 gap-2">
                  <Plus className="h-4 w-4" /> Criar primeira política
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {policyList.map(p => (
                <PolicyCard key={p.id} policy={p} assignmentCount={counts[p.tagKey] ?? 0}
                  canEdit={isAdminOrSteward} onEdit={openEdit} onDelete={setDeleteId} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Aba: Atribuições */}
        <TabsContent value="assignments" className="pt-4">
          {policyList.length === 0 ? (
            <EmptyTab
              icon={<BarChart3 className="h-10 w-10" />}
              title="Visualização de Atribuições"
              desc="Crie ao menos uma política de tag para visualizar atribuições." />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {policyList.map(p => {
                  const cnt = counts[p.tagKey] ?? 0;
                  const cat = p.category ?? "compliance";
                  return (
                    <div key={p.id} className="rounded-xl border bg-card p-4 flex items-center gap-3">
                      <div className={`rounded-lg p-2 shrink-0 ${CAT_COLORS[cat] ?? "bg-gray-100 text-gray-600"}`}>
                        {CAT_ICONS[cat] ?? <Tag className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">{p.tagKey}</p>
                        <p className="text-2xl font-bold leading-tight">{cnt}</p>
                        <p className="text-xs text-muted-foreground">atribuições</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="bg-muted/40 border-b px-4 py-2.5 flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Atributos tagueados por política</p>
                  <Badge variant="outline" className="text-[10px]">{Object.values(counts as Record<string,number>).reduce((a,b) => a+b, 0)} total</Badge>
                </div>
                <div className="divide-y">
                  {policyList.map(p => {
                    const cnt = counts[p.tagKey] ?? 0;
                    const vals = parseJson<string[]>(p.allowedValues, []);
                    const cmap = parseJson<Record<string,string>>(p.colorMap, {});
                    return (
                      <div key={p.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                        <div className="w-36 shrink-0">
                          <p className="text-sm font-semibold">{p.tagKey}</p>
                          <p className="text-xs text-muted-foreground">{p.displayName}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 flex-1">
                          {vals.length > 0 ? vals.map(v => (
                            <span key={v} className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                              style={{ backgroundColor: cmap[v] ?? "#6b7280" }}>{v}</span>
                          )) : <span className="text-xs text-muted-foreground italic">Forma livre</span>}
                        </div>
                        <div className="text-sm font-semibold text-right shrink-0 text-blue-600 flex items-center gap-0.5">
                          {cnt} <ChevronRight className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Aba: Compliance */}
        <TabsContent value="compliance" className="pt-4">
          <ComplianceTab policies={policyList} />
        </TabsContent>

        {/* Aba: Auditoria */}
        <TabsContent value="audit" className="pt-4">
          <EmptyTab
            icon={<ClipboardList className="h-10 w-10" />}
            title="Log de Auditoria de Tags"
            desc="Histórico de criação, edição e exclusão de políticas, e aplicação de tags a ativos de dados." />
        </TabsContent>
      </Tabs>

      {/* Dialog criar / editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar Política de Tag" : "Nova Política de Tag"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Chave da Tag <span className="text-destructive">*</span></Label>
              <Input placeholder="Ex: DataOwner" value={form.tagKey} disabled={!!form.id}
                className="font-mono"
                onChange={e => setForm(f => ({ ...f, tagKey: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Máx. 256 caracteres. Case-sensitive. Sem espaços ou caracteres especiais.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Nome de Exibição <span className="text-destructive">*</span></Label>
              <Input placeholder="Ex: Proprietário do Dado" value={form.displayName}
                onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea placeholder="Descreva o propósito desta tag..." rows={2} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Valores Permitidos <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
              <Input placeholder="Ex: Finance, HR, Marketing (separados por vírgula)" value={form.allowedValuesRaw}
                onChange={e => setForm(f => ({ ...f, allowedValuesRaw: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Deixe vazio para aceitar qualquer valor.</p>
            </div>
            <div className="space-y-2">
              <Label>Aplica-se a</Label>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox id="chk-t" checked={form.appliesToTable}
                    onCheckedChange={v => setForm(f => ({ ...f, appliesToTable: !!v }))} />
                  <label htmlFor="chk-t" className="text-sm cursor-pointer">Tabela</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="chk-c" checked={form.appliesToColumn}
                    onCheckedChange={v => setForm(f => ({ ...f, appliesToColumn: !!v }))} />
                  <label htmlFor="chk-c" className="text-sm cursor-pointer">Coluna</label>
                </div>
                <div className="flex items-center gap-2 opacity-40">
                  <Checkbox disabled /><span className="text-sm">Schema</span>
                </div>
                <div className="flex items-center gap-2 opacity-40">
                  <Checkbox disabled /><span className="text-sm">Catálogo</span>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="compliance">Conformidade</SelectItem>
                  <SelectItem value="ownership">Propriedade</SelectItem>
                  <SelectItem value="discovery">Descoberta</SelectItem>
                  <SelectItem value="cost">Custo</SelectItem>
                  <SelectItem value="security">Segurança</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="chk-req" checked={form.isRequired}
                onCheckedChange={v => setForm(f => ({ ...f, isRequired: !!v }))} />
              <label htmlFor="chk-req" className="text-sm cursor-pointer">
                Tornar obrigatória (todos os ativos devem ter esta tag)
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : form.id ? "Salvar alterações" : "Criar Política"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={deleteId !== null} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir política?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Não remove tags já aplicadas no Databricks Unity Catalog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
