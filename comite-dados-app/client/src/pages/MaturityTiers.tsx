import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Layers,
  Shield,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Database,
  AlertTriangle,
  Info,
  Users,
  Lock,
  Unlock,
  Activity,
  GitBranch,
  Code2,
  Star,
  RotateCcw,
  X,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIER_COLORS: Record<number, { bg: string; border: string; text: string; badge: string; icon: string }> = {
  1: { bg: "bg-blue-50",   border: "border-blue-200",  text: "text-blue-700",   badge: "bg-blue-100 text-blue-700 border-blue-200",   icon: "text-blue-500" },
  2: { bg: "bg-green-50",  border: "border-green-200", text: "text-green-700",  badge: "bg-green-100 text-green-700 border-green-200", icon: "text-green-500" },
  3: { bg: "bg-amber-50",  border: "border-amber-200", text: "text-amber-700",  badge: "bg-amber-100 text-amber-700 border-amber-200", icon: "text-amber-500" },
  4: { bg: "bg-red-50",    border: "border-red-200",   text: "text-red-700",    badge: "bg-red-100 text-red-700 border-red-200",       icon: "text-red-500" },
};

const TIER_ICONS: Record<number, React.ReactNode> = {
  1: <Unlock size={16} />,
  2: <Code2 size={16} />,
  3: <ShieldCheck size={16} />,
  4: <Lock size={16} />,
};

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendente_revisao: { label: "Pendente Revisão", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: <Clock size={11} /> },
  aprovado:         { label: "Aprovado",          color: "bg-green-100 text-green-800 border-green-200",   icon: <CheckCircle2 size={11} /> },
  sincronizado:     { label: "Sincronizado",       color: "bg-blue-100 text-blue-800 border-blue-200",     icon: <ShieldCheck size={11} /> },
  revogado:         { label: "Revogado",           color: "bg-red-100 text-red-800 border-red-200",        icon: <XCircle size={11} /> },
  sem_tier:         { label: "Sem Tier",           color: "bg-gray-100 text-gray-600 border-gray-200",     icon: <Layers size={11} /> },
};

const SQL_TYPE_TAGS: Record<string, { label: string; color: string }> = {
  catalog: { label: "CATALOG",  color: "bg-violet-600" },
  schema:  { label: "SCHEMA",   color: "bg-indigo-600" },
  table:   { label: "TABLE",    color: "bg-blue-700" },
};

function SqlBlock({ sql, type }: { sql: string; type: string }) {
  const tag = SQL_TYPE_TAGS[type] ?? { label: type.toUpperCase(), color: "bg-gray-600" };
  return (
    <div className="relative bg-slate-900 text-slate-200 rounded-lg p-3 font-mono text-[11px] leading-relaxed mb-1.5">
      <span className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded text-white ${tag.color}`}>
        {tag.label}
      </span>
      <pre className="whitespace-pre-wrap break-words pr-16">{sql}</pre>
    </div>
  );
}

// ─── Card de definição de Tier ────────────────────────────────────────────────

function TierDefinitionCard({ tier }: { tier: any }) {
  const [expanded, setExpanded] = useState(false);
  const colors = TIER_COLORS[tier.tier] ?? TIER_COLORS[1];

  return (
    <Card className={`border-2 ${colors.border} ${colors.bg} shadow-sm`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`${colors.icon}`}>{TIER_ICONS[tier.tier]}</span>
            <div>
              <CardTitle className={`text-sm font-bold font-['Montserrat'] ${colors.text}`}>
                {tier.label}
              </CardTitle>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {tier.profiles?.join(" · ")}
              </p>
            </div>
          </div>
          <Badge className={`text-[10px] font-bold ${colors.badge}`}>
            Tier {tier.tier}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-[11px] text-gray-600 space-y-1 mb-2">
          <div className="flex items-center gap-1.5">
            <Database size={11} className="text-gray-400 flex-shrink-0" />
            <span className="font-semibold">Grupo Databricks:</span>
            <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200 text-[10px]">
              {tier.databricksGroup}
            </code>
          </div>
          <div className="flex items-center gap-1.5">
            <Activity size={11} className="text-gray-400 flex-shrink-0" />
            <span className="font-semibold">Cluster Policy:</span>
            <span className="text-gray-700">{tier.clusterPolicyName}</span>
          </div>
          {tier.requiresCICD && (
            <div className="flex items-center gap-1.5 text-red-600">
              <GitBranch size={11} className="flex-shrink-0" />
              <span className="font-semibold">Requer PR aprovado + CI/CD</span>
            </div>
          )}
          {tier.requiresApproval && (
            <div className="flex items-center gap-1.5 text-amber-600">
              <ShieldCheck size={11} className="flex-shrink-0" />
              <span className="font-semibold">Requer aprovação do Steward</span>
            </div>
          )}
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className={`text-[11px] font-semibold ${colors.text} flex items-center gap-1 hover:underline`}
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? "Ocultar detalhes" : "Ver capacidades e restrições"}
        </button>

        {expanded && (
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-green-600 mb-1.5">
                ✓ Pode fazer
              </p>
              <ul className="space-y-0.5">
                {tier.capabilities?.map((c: string, i: number) => (
                  <li key={i} className="text-[11px] text-gray-700 flex items-start gap-1.5">
                    <CheckCircle2 size={10} className="text-green-500 flex-shrink-0 mt-0.5" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-1.5">
                ✗ Não pode fazer
              </p>
              <ul className="space-y-0.5">
                {tier.restrictions?.map((r: string, i: number) => (
                  <li key={i} className="text-[11px] text-gray-700 flex items-start gap-1.5">
                    <XCircle size={10} className="text-red-400 flex-shrink-0 mt-0.5" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Painel de atribuição de Tier a um domínio ────────────────────────────────

function DomainTierPanel({
  domain,
  onRefresh,
}: {
  domain: any;
  onRefresh: () => void;
}) {
  const utils = trpc.useUtils();
  const [expanded, setExpanded] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string>(domain.tier?.toString() ?? "");
  const [catalog, setCatalog] = useState(domain.tierDatabricksCatalog ?? "");
  const [schema, setSchema] = useState(domain.tierDatabricksSchema ?? "");
  const [notes, setNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [syncReport, setSyncReport] = useState<any>(null);
  const [showSyncReport, setShowSyncReport] = useState(false);

  const tierNum = selectedTier ? (parseInt(selectedTier) as 0 | 1 | 2 | 3 | 4) : null;

  // Preview das políticas
  const preview = trpc.governance.previewTierPolicies.useQuery(
    { domainId: domain.domainId, tier: tierNum! },
    { enabled: !!tierNum && expanded }
  );

  const assignMutation = trpc.governance.assignTierToDomain.useMutation({
    onSuccess: (d) => { toast.success(d.message); onRefresh(); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const approveMutation = trpc.governance.approveTierAssignment.useMutation({
    onSuccess: (d) => { toast.success(d.message); onRefresh(); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const revokeMutation = trpc.governance.revokeTierAssignment.useMutation({
    onSuccess: (d) => { toast.success(d.message); setShowRevokeDialog(false); setRejectReason(""); onRefresh(); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const syncMutation = trpc.governance.syncTierPolicies.useMutation({
    onSuccess: (r) => {
      setSyncReport(r);
      setShowSyncReport(true);
      toast.success(`Sync concluído! ${r.applied} política(s) aplicada(s) no Unity Catalog.`);
      onRefresh();
    },
    onError: (e) => toast.error(`Erro no sync: ${e.message}`),
  });

  const revokePoliciesMutation = trpc.governance.revokeTierPolicies.useMutation({
    onSuccess: (r) => {
      toast.success(`${r.applied} política(s) revogada(s) no Unity Catalog.`);
      onRefresh();
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const status = domain.status ?? "sem_tier";
  const statusInfo = STATUS_LABELS[status] ?? STATUS_LABELS.sem_tier;
  const tierColors = domain.tier ? TIER_COLORS[domain.tier] : null;

  return (
    <div className={`border rounded-xl overflow-hidden ${expanded ? "border-[#1B3A8C]" : "border-gray-200"}`}>
      {/* Header da linha */}
      <div
        className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${expanded ? "bg-blue-50/40" : "bg-white"}`}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: domain.color ?? "#1B3A8C" }}
          >
            {domain.domainName?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">{domain.domainName}</p>
            <p className="text-[11px] text-gray-400">
              {domain.databricksGroup ? (
                <code className="bg-gray-100 px-1 rounded">{domain.databricksGroup}</code>
              ) : (
                "Sem grupo Databricks configurado"
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {domain.tier && (
            <Badge className={`text-[10px] font-bold ${tierColors?.badge ?? ""}`}>
              Tier {domain.tier}
            </Badge>
          )}
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border ${statusInfo.color}`}>
            {statusInfo.icon}
            {statusInfo.label}
          </span>
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </div>

      {/* Painel expandido */}
      {expanded && (
        <div className="border-t border-gray-100 bg-white p-4 space-y-4">

          {/* Configuração do Tier */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                Tier de Autonomia
              </label>
              <Select value={selectedTier} onValueChange={setSelectedTier}>
                <SelectTrigger className="text-sm h-9">
                  <SelectValue placeholder="Selecione o Tier..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Tier 0 — Bloqueado (Sem Acesso)</SelectItem>
                  <SelectItem value="1">Tier 1 — Self-Service Completo (Analyst)</SelectItem>
                  <SelectItem value="2">Tier 2 — Self-Service Guiado (Data Engineer)</SelectItem>
                  <SelectItem value="3">Tier 3 — Controlado (Lead / Steward)</SelectItem>
                  <SelectItem value="4">Tier 4 — Restrito Plataforma (Platform Eng.)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                Catálogo Databricks
              </label>
              <Input
                value={catalog}
                onChange={(e) => setCatalog(e.target.value)}
                placeholder="ex: vc_domain_engineering"
                className="text-sm h-9"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                Schema Databricks
              </label>
              <Input
                value={schema}
                onChange={(e) => setSchema(e.target.value)}
                placeholder="ex: domain_engineering"
                className="text-sm h-9"
              />
            </div>
          </div>

          {/* Preview das políticas */}
          {tierNum && (
            <>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-2">
                  Preview dos GRANTs no Unity Catalog
                  <span className="flex-1 h-px bg-gray-100" />
                </p>
                {preview.isLoading ? (
                  <div className="text-sm text-gray-400 animate-pulse">Gerando preview...</div>
                ) : preview.data ? (
                  <>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5">
                        <Users size={11} className="text-gray-400" />
                        <span className="font-semibold">Grupo:</span>
                        <code className="text-[10px] bg-white border border-gray-200 px-1.5 rounded">
                          {preview.data.databricksGroup}
                        </code>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5">
                        <Activity size={11} className="text-gray-400" />
                        <span className="font-semibold">Cluster Policy:</span>
                        <span>{preview.data.clusterPolicyName}</span>
                      </div>
                    </div>

                    <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                      <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800 leading-relaxed">
                        Estes GRANTs serão executados no Unity Catalog{" "}
                        <strong>somente após aprovação e clique em "Sync Databricks"</strong>.
                        Nenhuma alteração foi feita ainda.
                      </p>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-0">
                      {preview.data.grants?.slice(0, 8).map((g: any, i: number) => (
                        <SqlBlock key={i} sql={g.sql} type={g.type} />
                      ))}
                      {(preview.data.grants?.length ?? 0) > 8 && (
                        <p className="text-center text-xs text-gray-400 py-1">
                          + {preview.data.grants.length - 8} GRANTs adicionais
                        </p>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            </>
          )}

          {/* Observações */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
              Observações (opcional)
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Justificativa para a atribuição de Tier..."
              className="text-sm resize-none"
              rows={2}
            />
          </div>

          {/* Barra de ações */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
            {/* Atribuir Tier */}
            {status === "sem_tier" || status === "revogado" ? (
              <Button
                size="sm"
                className="bg-[#1B3A8C] hover:bg-[#122970] text-white text-xs"
                onClick={() =>
                  assignMutation.mutate({
                    domainId: domain.domainId,
                    tier: tierNum!,
                    databricksCatalog: catalog || undefined,
                    databricksSchema: schema || undefined,
                    notes: notes || undefined,
                  })
                }
                disabled={!tierNum || assignMutation.isPending}
              >
                <Layers size={12} className="mr-1" />
                {assignMutation.isPending ? "Atribuindo..." : "Atribuir Tier"}
              </Button>
            ) : null}

            {/* Aprovar */}
            {status === "pendente_revisao" && (
              <>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white text-xs"
                  onClick={() =>
                    approveMutation.mutate({ domainId: domain.domainId, notes: notes || undefined })
                  }
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle2 size={12} className="mr-1" />
                  {approveMutation.isPending ? "Aprovando..." : "Aprovar Tier"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="text-xs"
                  onClick={() => setShowRevokeDialog(true)}
                >
                  <XCircle size={12} className="mr-1" />
                  Rejeitar
                </Button>
              </>
            )}

            {/* Sync Databricks */}
            {status === "aprovado" && (
              <>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-[#1B3A8C] to-blue-600 hover:from-[#122970] hover:to-blue-700 text-white text-xs"
                  onClick={() => syncMutation.mutate({ domainId: domain.domainId })}
                  disabled={syncMutation.isPending}
                >
                  <RefreshCw size={12} className={`mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                  {syncMutation.isPending ? "Sincronizando..." : "Sync Databricks"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-gray-400"
                  onClick={() => setShowRevokeDialog(true)}
                >
                  <RotateCcw size={11} className="mr-1" />
                  Reabrir revisão
                </Button>
              </>
            )}

            {/* Reatribuir / Revogar */}
            {status === "sincronizado" && (
              <>
                <Button
                  size="sm"
                  className="bg-[#1B3A8C] hover:bg-[#122970] text-white text-xs"
                  onClick={() =>
                    assignMutation.mutate({
                      domainId: domain.domainId,
                      tier: tierNum ?? domain.tier,
                      databricksCatalog: catalog || undefined,
                      databricksSchema: schema || undefined,
                      notes: notes || undefined,
                    })
                  }
                  disabled={!tierNum || assignMutation.isPending}
                >
                  <Layers size={12} className="mr-1" />
                  Reatribuir Tier
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="text-xs"
                  onClick={() => revokePoliciesMutation.mutate({ domainId: domain.domainId })}
                  disabled={revokePoliciesMutation.isPending}
                >
                  <XCircle size={12} className="mr-1" />
                  {revokePoliciesMutation.isPending ? "Revogando..." : "Revogar Políticas"}
                </Button>
                {syncReport && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs text-[#1B3A8C] border-[#1B3A8C]"
                    onClick={() => setShowSyncReport(true)}
                  >
                    <Eye size={12} className="mr-1" />
                    Ver último sync
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de resultado do sync */}
      {showSyncReport && syncReport && (
        <Dialog open onOpenChange={() => setShowSyncReport(false)}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <ShieldCheck size={16} className="text-green-600" />
                Relatório de Sincronização — {domain.domainName}
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Run ID: <code className="bg-gray-100 px-1 rounded">{syncReport.runId ?? "N/A"}</code>
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-3 my-2">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-green-600 mb-1">Aplicadas</p>
                <p className="text-2xl font-black text-green-700">{syncReport.applied ?? 0}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-1">Erros</p>
                <p className="text-2xl font-black text-red-700">{syncReport.errors ?? 0}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1">Tier</p>
                <p className="text-2xl font-black text-blue-700">{syncReport.tier ?? domain.tier}</p>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 space-y-1.5 pr-1">
              {(syncReport.grants ?? []).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Nenhum GRANT registrado.</p>
              ) : (
                (syncReport.grants ?? []).map((g: any, i: number) => (
                  <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs border ${
                    g.ok ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"
                  }`}>
                    {g.ok
                      ? <CheckCircle2 size={13} className="text-green-500 flex-shrink-0 mt-0.5" />
                      : <XCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                    }
                    <div className="min-w-0">
                      <code className="font-mono text-[11px] text-gray-800 break-all">{g.sql ?? g.statement ?? "—"}</code>
                      {g.error && <p className="text-red-600 mt-0.5">{g.error}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setShowSyncReport(false)}>
                <X size={13} className="mr-1" /> Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog de rejeição / reversão */}
      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {status === "aprovado" ? "Reabrir revisão?" : "Rejeitar atribuição de Tier?"}
            </DialogTitle>
            <DialogDescription>
              O domínio <strong>{domain.domainName}</strong> voltará ao status{" "}
              <em>pendente_revisao</em>. Informe o motivo.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Motivo (obrigatório)..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="text-sm resize-none"
            rows={2}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevokeDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!rejectReason.trim()) { toast.error("Informe o motivo."); return; }
                revokeMutation.mutate({ domainId: domain.domainId, reason: rejectReason.trim() });
              }}
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? "Processando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tipos de drill-down para os cards de stats ──────────────────────────────
type TierStatType = "total" | "semTier" | "pendente" | "aprovado" | "sincronizado" | null;

const TIER_STAT_CONFIG: Record<Exclude<TierStatType, null>, { title: string; description: string; emptyMessage: string }> = {
  total:        { title: "Todos os Domínios",       description: "Lista completa de domínios com atribuição de Tier.",                       emptyMessage: "Nenhum domínio encontrado." },
  semTier:      { title: "Domínios Sem Tier",        description: "Domínios que ainda não possuem um Tier de Autonomia atribuído.",           emptyMessage: "Todos os domínios possuem Tier atribuído." },
  pendente:     { title: "Domínios Pendentes",       description: "Domínios com atribuição de Tier aguardando revisão ou aprovação.",         emptyMessage: "Nenhum domínio pendente de revisão." },
  aprovado:     { title: "Domínios Aprovados",       description: "Domínios com Tier aprovado pelo Data Steward, aguardando sincronização.",  emptyMessage: "Nenhum domínio aprovado encontrado." },
  sincronizado: { title: "Domínios Sincronizados",   description: "Domínios com políticas de Tier já sincronizadas no Unity Catalog.",       emptyMessage: "Nenhum domínio sincronizado ainda." },
};

// ─── Modal de drill-down de domínios ─────────────────────────────────────────
function TierDrillDownModal({
  type,
  domains,
  onClose,
}: {
  type: Exclude<TierStatType, null>;
  domains: any[];
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const config = TIER_STAT_CONFIG[type];

  const filtered = useMemo(
    () =>
      domains.filter(
        (d) =>
          (d.domainName || "").toLowerCase().includes(search.toLowerCase()) ||
          (d.databricksGroup || "").toLowerCase().includes(search.toLowerCase())
      ),
    [domains, search]
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[75vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Layers size={16} className="text-[#1B3A8C]" />
            {config.title}
            <Badge variant="outline" className="ml-1 text-xs font-bold">
              {domains.length}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-1">
          <Database className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar domínio ou grupo Databricks..."
            className="w-full pl-8 pr-3 h-8 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-y-auto flex-1 divide-y divide-gray-100 rounded-lg border border-gray-100 mt-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">{config.emptyMessage}</div>
          ) : (
            filtered.map((domain) => {
              const statusInfo = STATUS_LABELS[domain.status ?? "sem_tier"] ?? STATUS_LABELS.sem_tier;
              const tierColors = domain.tier ? TIER_COLORS[domain.tier] : null;
              return (
                <div
                  key={domain.domainId}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: domain.color ?? "#1B3A8C" }}
                    >
                      {domain.domainName?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-gray-900 truncate">{domain.domainName}</p>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                        {domain.databricksGroup ? (
                          <code className="bg-gray-100 px-1 rounded">{domain.databricksGroup}</code>
                        ) : (
                          "Sem grupo Databricks"
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {domain.tier && (
                      <Badge className={`text-[10px] font-bold ${tierColors?.badge ?? ""}`}>
                        Tier {domain.tier}
                      </Badge>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusInfo.color}`}
                    >
                      {statusInfo.icon}
                      {statusInfo.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>
            <X size={13} className="mr-1" /> Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function MaturityTiers() {
  const utils = trpc.useUtils();

  const tiersQuery = trpc.governance.getTierDefinitions.useQuery();
  const assignmentsQuery = trpc.governance.getDomainTierAssignments.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  function refresh() {
    utils.governance.getDomainTierAssignments.invalidate();
  }

  const assignments: any[] = assignmentsQuery.data ?? [];

  const stats = {
    total:       assignments.length,
    semTier:     assignments.filter((a) => !a.tier || a.status === "sem_tier").length,
    pendente:    assignments.filter((a) => a.status === "pendente_revisao").length,
    aprovado:    assignments.filter((a) => a.status === "aprovado").length,
    sincronizado: assignments.filter((a) => a.status === "sincronizado").length,
  };

  const tierGroups: Record<number, any[]> = { 1: [], 2: [], 3: [], 4: [] };
  assignments.forEach((a) => {
    if (a.tier && tierGroups[a.tier]) tierGroups[a.tier].push(a);
  });

  // Drill-down state
  const [statDrillDown, setStatDrillDown] = useState<TierStatType>(null);

  // Sync em lote
  const [batchSyncReport, setBatchSyncReport] = useState<any>(null);
  const [showBatchSyncReport, setShowBatchSyncReport] = useState(false);
  const batchSyncMutation = trpc.governance.batchSyncTierPolicies.useMutation({
    onSuccess: (r) => {
      setBatchSyncReport(r);
      setShowBatchSyncReport(true);
      toast.success(`Sync em lote concluído! ${r.totalApplied} política(s) aplicada(s) em ${r.results?.length ?? 0} domínio(s).`);
      refresh();
    },
    onError: (e) => toast.error(`Erro no sync em lote: ${e.message}`),
  });

  function getDrillDownDomains(type: Exclude<TierStatType, null>): any[] {
    switch (type) {
      case "total":        return assignments;
      case "semTier":      return assignments.filter((a) => !a.tier || a.status === "sem_tier");
      case "pendente":     return assignments.filter((a) => a.status === "pendente_revisao");
      case "aprovado":     return assignments.filter((a) => a.status === "aprovado");
      case "sincronizado": return assignments.filter((a) => a.status === "sincronizado");
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-['Montserrat'] text-[#1B3A8C] flex items-center gap-2">
            <Layers size={20} className="text-[#1B3A8C]" />
            Modelo de Maturidade de Autonomia
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Governança &rsaquo; Tier de Autonomia por Perfil e Domínio — Unity Catalog
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats.aprovado > 0 && (
            <Button
              size="sm"
              className="bg-gradient-to-r from-[#1B3A8C] to-blue-600 hover:from-[#122970] hover:to-blue-700 text-white text-xs"
              onClick={() => batchSyncMutation.mutate({})}
              disabled={batchSyncMutation.isPending}
            >
              <RefreshCw size={13} className={`mr-1.5 ${batchSyncMutation.isPending ? "animate-spin" : ""}`} />
              {batchSyncMutation.isPending ? "Sincronizando..." : `Sync em Lote (${stats.aprovado})`}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={assignmentsQuery.isFetching}
          >
            <RefreshCw size={14} className={`mr-1.5 ${assignmentsQuery.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Info box */}
      <div className="flex gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3.5">
        <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 leading-relaxed">
          As políticas de acesso no Unity Catalog são aplicadas por{" "}
          <strong>grupo de domínio</strong> (ex:{" "}
          <code className="bg-white px-1 rounded border border-blue-100">domain-engineering-financeiro</code>
          ). Cada Tier define os GRANTs, Cluster Policy e restrições do grupo no Databricks.
          As políticas <strong>só são aplicadas após aprovação explícita do Data Steward</strong> e
          clique em "Sync Databricks".
        </p>
      </div>

      {/* Stats — clicáveis */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {([
          { label: "Domínios",      value: stats.total,        color: "text-gray-700",   key: "total"        },
          { label: "Sem Tier",      value: stats.semTier,      color: "text-gray-500",   key: "semTier"      },
          { label: "Pendentes",     value: stats.pendente,     color: "text-amber-600",  key: "pendente"     },
          { label: "Aprovados",     value: stats.aprovado,     color: "text-[#1B3A8C]",  key: "aprovado"     },
          { label: "Sincronizados", value: stats.sincronizado, color: "text-green-600",  key: "sincronizado" },
        ] as const).map((s) => (
          <Card
            key={s.label}
            className="border border-gray-200 shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:ring-2 hover:ring-offset-1 hover:ring-blue-200 transition-all duration-150"
            onClick={() => setStatDrillDown(s.key as TierStatType)}
          >
            <CardContent className="p-4 relative">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">{s.label}</p>
              <p className={`text-3xl font-black font-['Montserrat'] ${s.color}`}>{s.value}</p>
              <ChevronRight size={12} className="absolute bottom-3 right-3 text-gray-300" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="domains">
        <TabsList className="mb-4">
          <TabsTrigger value="domains">
            Domínios
            {stats.pendente > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {stats.pendente}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="tiers">Definição dos Tiers</TabsTrigger>
          <TabsTrigger value="matrix">Matriz de Acesso</TabsTrigger>
        </TabsList>

        {/* ── Aba: Domínios ── */}
        <TabsContent value="domains">
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-gray-100">
              <CardTitle className="text-sm font-bold font-['Montserrat'] flex items-center gap-2">
                <GitBranch size={16} className="text-[#1B3A8C]" />
                Atribuição de Tier por Domínio
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {assignmentsQuery.isLoading ? (
                <div className="text-sm text-gray-400 animate-pulse p-4 text-center">
                  Carregando domínios...
                </div>
              ) : assignments.length === 0 ? (
                <div className="text-sm text-gray-400 text-center p-8">
                  Nenhum domínio encontrado.
                </div>
              ) : (
                assignments.map((domain) => (
                  <DomainTierPanel key={domain.domainId} domain={domain} onRefresh={refresh} />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Aba: Definição dos Tiers ── */}
        <TabsContent value="tiers">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tiersQuery.isLoading ? (
              <div className="col-span-2 text-sm text-gray-400 animate-pulse p-8 text-center">
                Carregando definições...
              </div>
            ) : (
              tiersQuery.data?.map((tier: any) => (
                <TierDefinitionCard key={tier.tier} tier={tier} />
              ))
            )}
          </div>
        </TabsContent>

        {/* ── Aba: Matriz de Acesso ── */}
        <TabsContent value="matrix">
          <Card className="border border-gray-200 shadow-sm overflow-x-auto">
            <CardHeader className="pb-3 border-b border-gray-100">
              <CardTitle className="text-sm font-bold font-['Montserrat'] flex items-center gap-2">
                <Shield size={16} className="text-[#1B3A8C]" />
                Matriz de Acesso — Tier × Capacidade
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-4 py-2.5 border-b border-gray-100 font-bold text-gray-500 uppercase tracking-wider text-[11px]">
                      Capacidade
                    </th>
                    {[1, 2, 3, 4].map((t) => {
                      const colors = TIER_COLORS[t];
                      return (
                        <th key={t} className={`px-4 py-2.5 border-b border-gray-100 text-center font-bold text-[11px] uppercase tracking-wider ${colors.text}`}>
                          Tier {t}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Criar notebooks",                  tiers: [true, true, true, true] },
                    { label: "Usar clusters compartilhados",     tiers: [true, true, true, true] },
                    { label: "Criar clusters via Cluster Policy",tiers: [false, true, true, true] },
                    { label: "Desenvolver pipelines DLT",        tiers: [false, true, true, true] },
                    { label: "Criar tabelas Bronze/Silver",      tiers: [false, true, true, true] },
                    { label: "Aprovar promoção Bronze→Silver",   tiers: [false, false, true, true] },
                    { label: "Definir RLS/CLS no domínio",       tiers: [false, false, true, true] },
                    { label: "Criar Delta Shares internos",      tiers: [false, false, true, true] },
                    { label: "Modificar tabelas outros domínios",tiers: [false, false, false, true] },
                    { label: "Gerenciar metastore",              tiers: [false, false, false, true] },
                    { label: "Criar Service Principals",         tiers: [false, false, false, true] },
                    { label: "Alterar IAM de produção",          tiers: [false, false, false, true] },
                  ].map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="px-4 py-2.5 border-b border-gray-50 font-medium text-gray-700">
                        {row.label}
                      </td>
                      {row.tiers.map((allowed, ti) => (
                        <td key={ti} className="px-4 py-2.5 border-b border-gray-50 text-center">
                          {allowed ? (
                            <CheckCircle2 size={14} className="mx-auto text-green-500" />
                          ) : (
                            <XCircle size={14} className="mx-auto text-red-300" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de drill-down de domínios */}
      {statDrillDown && (
        <TierDrillDownModal
          type={statDrillDown}
          domains={getDrillDownDomains(statDrillDown)}
          onClose={() => setStatDrillDown(null)}
        />
      )}

      {/* Modal de resultado do Sync em Lote */}
      {showBatchSyncReport && batchSyncReport && (
        <Dialog open onOpenChange={() => setShowBatchSyncReport(false)}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <ShieldCheck size={16} className="text-green-600" />
                Relatório de Sync em Lote
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                {batchSyncReport.results?.length ?? 0} domínio(s) processados
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-3 my-2">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-green-600 mb-1">Total Aplicadas</p>
                <p className="text-2xl font-black text-green-700">{batchSyncReport.totalApplied ?? 0}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-1">Total Erros</p>
                <p className="text-2xl font-black text-red-700">{batchSyncReport.totalErrors ?? 0}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1">Domínios</p>
                <p className="text-2xl font-black text-blue-700">{batchSyncReport.results?.length ?? 0}</p>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {(batchSyncReport.results ?? []).map((r: any, i: number) => (
                <div key={i} className={`rounded-lg border px-3 py-2.5 ${
                  r.errors > 0 ? "bg-red-50 border-red-100" : "bg-green-50 border-green-100"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {r.errors > 0
                        ? <AlertTriangle size={13} className="text-red-500" />
                        : <CheckCircle2 size={13} className="text-green-500" />
                      }
                      <span className="font-semibold text-sm text-gray-800">{r.domainName ?? `Domínio ${r.domainId}`}</span>
                      <Badge className={`text-[10px] font-bold ${TIER_COLORS[r.tier]?.badge ?? ""}`}>Tier {r.tier}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-green-700 font-bold">{r.applied} aplicadas</span>
                      {r.errors > 0 && <span className="text-red-600 font-bold">{r.errors} erros</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setShowBatchSyncReport(false)}>
                <X size={13} className="mr-1" /> Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
