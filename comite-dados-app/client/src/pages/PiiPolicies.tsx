import { useState } from "react";
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
import { toast } from "sonner";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp,
  Database,
  AlertTriangle,
  Info,
  RotateCcw,
  Activity,
} from "lucide-react";

// ─── Helpers de label/cor ────────────────────────────────────────────────────

const policyStatusLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendente_revisao: {
    label: "Pendente Revisão",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: <Clock size={11} />,
  },
  aprovado: {
    label: "Aprovado",
    color: "bg-green-100 text-green-800 border-green-200",
    icon: <CheckCircle2 size={11} />,
  },
  rejeitado: {
    label: "Rejeitado",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: <XCircle size={11} />,
  },
  sincronizado: {
    label: "Sincronizado",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <ShieldCheck size={11} />,
  },
};

const sensitivityLabels: Record<string, { label: string; color: string }> = {
  publico:      { label: "Público",       color: "bg-gray-100 text-gray-600" },
  interno:      { label: "Interno",       color: "bg-blue-100 text-blue-700" },
  confidencial: { label: "Confidencial",  color: "bg-orange-100 text-orange-700" },
  restrito:     { label: "Restrito",      color: "bg-red-100 text-red-700" },
};

const piiRiskColors: Record<string, string> = {
  alto:  "bg-red-500",
  medio: "bg-amber-400",
  baixo: "bg-gray-400",
};

const piiRiskBadge: Record<string, string> = {
  alto:  "bg-red-100 text-red-700",
  medio: "bg-orange-100 text-orange-700",
  baixo: "bg-gray-100 text-gray-600",
};

// ─── Componente de coluna PII ─────────────────────────────────────────────────

function PiiColumnChip({ name, risk }: { name: string; risk: string }) {
  const riskKey = risk?.toLowerCase().includes("alto") || risk?.toLowerCase().includes("high")
    ? "alto"
    : risk?.toLowerCase().includes("medio") || risk?.toLowerCase().includes("medium")
    ? "medio"
    : "baixo";
  const riskLabel = riskKey === "alto" ? "Alto" : riskKey === "medio" ? "Médio" : "Baixo";
  return (
    <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-md px-2.5 py-1.5 text-xs">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${piiRiskColors[riskKey]}`} />
      <span className="font-semibold text-gray-800">{name}</span>
      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${piiRiskBadge[riskKey]}`}>{riskLabel}</span>
    </div>
  );
}

// ─── Bloco de SQL com syntax highlight simples ────────────────────────────────

function SqlBlock({ sql, tag, tagColor }: { sql: string; tag: string; tagColor: string }) {
  return (
    <div className="relative bg-slate-900 text-slate-200 rounded-lg p-3.5 font-mono text-[11.5px] leading-relaxed mb-2">
      <span className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded text-white ${tagColor}`}>
        {tag}
      </span>
      <pre className="whitespace-pre-wrap break-words pr-16">{sql}</pre>
    </div>
  );
}

// ─── Painel de detalhe expandido de um ativo ─────────────────────────────────

function AssetDetailPanel({
  asset,
  onClose,
  onRefresh,
}: {
  asset: any;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const utils = trpc.useUtils();
  const [notes, setNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const [bypassGroups, setBypassGroups] = useState<string[]>(["data_steward", "data_owner", "admins"]);

  const groupsQuery = trpc.governance.getDatabricksGroups.useQuery(undefined, {
    staleTime: Infinity,
  });

  // Busca o preview dos SQLs
  const preview = trpc.governance.previewPiiPolicies.useQuery(
    { assetId: asset.id, applyMasking: true, applyColumnRevoke: true, applyRls: false, bypassGroups },
    { enabled: !!asset.id }
  );

  const approveMutation = trpc.governance.approvePiiPolicies.useMutation({
    onSuccess: () => {
      toast.success("Políticas aprovadas! Use o botão 'Sync Databricks' para aplicar no Unity Catalog.");
      utils.governance.getPiiPolicyPendingAssets.invalidate();
      onRefresh();
    },
    onError: (e) => toast.error(`Erro ao aprovar: ${e.message}`),
  });

  const rejectMutation = trpc.governance.rejectPiiPolicies.useMutation({
    onSuccess: () => {
      toast.success("Políticas rejeitadas. Nenhuma alteração será feita no Unity Catalog.");
      utils.governance.getPiiPolicyPendingAssets.invalidate();
      setShowRejectInput(false);
      setRejectReason("");
      onRefresh();
    },
    onError: (e) => toast.error(`Erro ao rejeitar: ${e.message}`),
  });

  function handleApprove() {
    approveMutation.mutate({ assetId: asset.id, notes: notes.trim() || undefined, bypassGroups });
  }

  function handleReject() {
    if (!rejectReason.trim()) {
      toast.error("Informe o motivo da rejeição.");
      return;
    }
    rejectMutation.mutate({ assetId: asset.id, reason: rejectReason.trim() });
  }

  // preview.data segue a interface PiiPolicyPreview do servidor
  const piiColumns: Array<{ name: string; risk: string }> = (preview.data?.commands ?? []).map((c) => ({
    name: c.column,
    risk: c.riskLevel,
  }));
  const sqlStatements: Array<{ sql: string; type: string }> = (preview.data?.commands ?? []).map((c) => ({
    sql: c.sql,
    type: c.policyType === 'masking' ? 'masking_function' : c.policyType === 'column_permission' ? 'revoke' : 'rls',
  }));

  const sqlTagMap: Record<string, { label: string; color: string }> = {
    masking_function: { label: "MASKING", color: "bg-violet-600" },
    set_mask:         { label: "SET MASK", color: "bg-indigo-600" },
    revoke:           { label: "REVOKE", color: "bg-red-600" },
    rls:              { label: "RLS", color: "bg-amber-600" },
  };

  return (
    <div className="border-2 border-blue-200 rounded-xl overflow-hidden mt-1 mb-2">
      {/* Header do painel */}
      <div className="bg-[#1B3A8C] text-white px-4 py-3 flex items-center justify-between">
        <div>
          <h4 className="font-bold text-sm font-['Montserrat']">
            Revisão de Políticas PII — {asset.name}
          </h4>
          <p className="text-xs text-white/60 mt-0.5">
            {asset.fullyQualifiedName} · Detectado em{" "}
            {asset.piiPolicyCreatedAt
              ? new Date(asset.piiPolicyCreatedAt).toLocaleString("pt-BR")
              : "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-yellow-400/20 text-yellow-200 border border-yellow-400/30 px-2 py-0.5 rounded-full font-semibold">
            Pendente Revisão
          </span>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors ml-2"
          >
            <ChevronUp size={18} />
          </button>
        </div>
      </div>

      <div className="bg-white p-4">
        {/* Colunas PII detectadas */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-2">
          Colunas PII Detectadas
          <span className="flex-1 h-px bg-gray-100" />
        </p>
        {preview.isLoading ? (
          <div className="text-sm text-gray-400 animate-pulse">Carregando colunas PII...</div>
        ) : piiColumns.length === 0 ? (
          <div className="text-sm text-gray-400">Nenhuma coluna PII encontrada.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {piiColumns.map((col) => (
              <PiiColumnChip key={col.name} name={col.name} risk={col.risk} />
            ))}
          </div>
        )}

        {/* Preview SQL */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 mt-4 flex items-center gap-2">
          Preview dos Comandos SQL (Unity Catalog)
          <span className="flex-1 h-px bg-gray-100" />
        </p>

        {/* Aviso */}
        <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
          <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            Estes comandos serão executados no Unity Catalog{" "}
            <strong>somente após sua aprovação e clique em "Sync Databricks"</strong>. Nenhuma
            alteração foi feita ainda.
          </p>
        </div>

        {preview.isLoading ? (
          <div className="text-sm text-gray-400 animate-pulse">Gerando preview dos SQLs...</div>
        ) : sqlStatements.length === 0 ? (
          <div className="text-sm text-gray-400">Nenhum comando SQL gerado.</div>
        ) : (
          <>
            {sqlStatements.slice(0, 4).map((stmt, i) => {
              const tag = sqlTagMap[stmt.type] ?? { label: stmt.type.toUpperCase(), color: "bg-gray-600" };
              return <SqlBlock key={i} sql={stmt.sql} tag={tag.label} tagColor={tag.color} />;
            })}
            {sqlStatements.length > 4 && (
              <p className="text-center text-xs text-gray-400 my-2">
                + {sqlStatements.length - 4} comando(s) adicional(is)
              </p>
            )}
          </>
        )}

        {/* Barra de grupos de bypass */}
        <div className="border-t border-gray-100 pt-4 mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-2">
            Grupos com Acesso Aberto (Bypass PII)
          </p>
          <div className="flex flex-wrap gap-2 items-center mb-4">
            {groupsQuery.isLoading ? (
              <span className="text-xs text-gray-400">Carregando grupos...</span>
            ) : (
              (groupsQuery.data ?? []).map((group) => {
                const isSelected = bypassGroups.includes(group);
                return (
                  <Badge
                    key={group}
                    variant={isSelected ? "default" : "outline"}
                    className={`cursor-pointer text-[10px] ${isSelected ? "bg-blue-600 hover:bg-blue-700" : "text-gray-500 hover:bg-gray-50"}`}
                    onClick={() => {
                      if (isSelected) {
                        setBypassGroups(bypassGroups.filter(g => g !== group));
                      } else {
                        setBypassGroups([...bypassGroups, group]);
                      }
                    }}
                  >
                    {group}
                  </Badge>
                );
              })
            )}
          </div>
        </div>

        {/* Barra de aprovação */}
        <div className="border-t border-gray-100 pt-4 mt-2">
          {showRejectInput ? (
            <div className="space-y-2">
              <Textarea
                placeholder="Motivo da rejeição (obrigatório)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="text-sm resize-none"
                rows={2}
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowRejectInput(false); setRejectReason(""); }}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleReject}
                  disabled={rejectMutation.isPending}
                >
                  {rejectMutation.isPending ? "Rejeitando..." : "Confirmar Rejeição"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                placeholder="Observações (opcional)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="flex-1 min-w-[200px] text-sm"
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowRejectInput(true)}
              >
                <XCircle size={14} className="mr-1" />
                Rejeitar
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleApprove}
                disabled={approveMutation.isPending || preview.isLoading}
              >
                <CheckCircle2 size={14} className="mr-1" />
                {approveMutation.isPending ? "Aprovando..." : "Aprovar Políticas"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Linha da tabela de ativos pendentes ─────────────────────────────────────

function PendingAssetRow({ asset, onRefresh }: { asset: any; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const sensitivity = sensitivityLabels[asset.sensitivity] ?? { label: asset.sensitivity ?? "—", color: "bg-gray-100 text-gray-600" };

  return (
    <>
      <tr className={`hover:bg-blue-50/30 transition-colors ${expanded ? "bg-blue-50/40" : ""}`}>
        <td className="px-4 py-3">
          <div className="font-semibold text-sm text-gray-900">{asset.name}</div>
          <div className="text-xs text-gray-400 mt-0.5">{asset.fullyQualifiedName ?? "—"}</div>
        </td>
        <td className="px-4 py-3">
          {asset.domain ? (
            <Badge variant="outline" className="text-xs font-medium">
              {asset.domain}
            </Badge>
          ) : (
            <span className="text-gray-400 text-xs">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <Badge className="bg-red-100 text-red-700 border-red-200 text-xs font-semibold">
            {asset.piiColumnCount ?? "?"} colunas
          </Badge>
        </td>
        <td className="px-4 py-3">
          <Badge className={`text-xs font-semibold ${sensitivity.color}`}>
            {sensitivity.label}
          </Badge>
        </td>
        <td className="px-4 py-3 text-xs text-gray-500">
          {asset.piiPolicyCreatedAt
            ? new Date(asset.piiPolicyCreatedAt).toLocaleString("pt-BR", {
                day: "2-digit", month: "2-digit", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })
            : "—"}
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border ${policyStatusLabels.pendente_revisao.color}`}>
            {policyStatusLabels.pendente_revisao.icon}
            {policyStatusLabels.pendente_revisao.label}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs"
          >
            {expanded ? (
              <><ChevronUp size={12} className="mr-1" />Recolher</>
            ) : (
              <><Eye size={12} className="mr-1" />Ver Preview</>
            )}
          </Button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="px-4 pb-2 bg-blue-50/20">
            <AssetDetailPanel
              asset={asset}
              onClose={() => setExpanded(false)}
              onRefresh={onRefresh}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Card de ativo aprovado aguardando sync ───────────────────────────────────

function ApprovedAssetCard({ asset, onRefresh }: { asset: any; onRefresh: () => void }) {
  const [showResetDialog, setShowResetDialog] = useState(false);

  const syncMutation = trpc.governance.syncApprovedPiiPolicies.useMutation({
    onSuccess: (data) => {
      toast.success(`Sync concluído! ${data.applied} política(s) aplicada(s) no Unity Catalog.`);
      onRefresh();
    },
    onError: (e) => toast.error(`Erro no sync: ${e.message}`),
  });

  const resetMutation = trpc.governance.resetPiiPolicyReview.useMutation({
    onSuccess: () => {
      toast.success("Revisão reaberta. Ativo voltou para a fila de pendências.");
      setShowResetDialog(false);
      onRefresh();
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  return (
    <>
      <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-100 last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-900 truncate">{asset.name}</div>
          <div className="text-xs text-gray-400 truncate mt-0.5">{asset.fullyQualifiedName ?? "—"}</div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] font-semibold">
              {asset.piiColumnCount ?? "?"} colunas PII
            </Badge>
            {asset.piiPolicyReviewedBy && (
              <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] font-semibold">
                ✓ Aprovado por {asset.piiPolicyReviewedBy}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <Button
            size="sm"
            className="bg-gradient-to-r from-[#1B3A8C] to-blue-600 hover:from-[#122970] hover:to-blue-700 text-white text-xs"
            onClick={() =>
              syncMutation.mutate({
                assetId: asset.id,
                applyMasking: true,
                applyColumnRevoke: true,
                applyRls: false,
              })
            }
            disabled={syncMutation.isPending}
          >
            <RefreshCw size={12} className={`mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            {syncMutation.isPending ? "Sincronizando..." : "Sync Databricks"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-gray-400 hover:text-gray-600"
            onClick={() => setShowResetDialog(true)}
          >
            <RotateCcw size={11} className="mr-1" />
            Reabrir revisão
          </Button>
        </div>
      </div>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir revisão?</DialogTitle>
            <DialogDescription>
              O ativo <strong>{asset.name}</strong> voltará ao status{" "}
              <em>pendente_revisao</em> e precisará ser aprovado novamente antes do sync.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => resetMutation.mutate({ assetId: asset.id })}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? "Reabrindo..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Linha de ativo sincronizado / rejeitado ──────────────────────────────────

function HistoryRow({ asset, statusKey }: { asset: any; statusKey: string }) {
  const st = policyStatusLabels[statusKey] ?? policyStatusLabels.sincronizado;
  const sensitivity = sensitivityLabels[asset.sensitivity] ?? { label: asset.sensitivity ?? "—", color: "bg-gray-100 text-gray-600" };

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div className="font-semibold text-sm text-gray-900">{asset.name}</div>
        <div className="text-xs text-gray-400 mt-0.5">{asset.fullyQualifiedName ?? "—"}</div>
      </td>
      <td className="px-4 py-3">
        {asset.domain ? (
          <Badge variant="outline" className="text-xs font-medium">{asset.domain}</Badge>
        ) : <span className="text-gray-400 text-xs">—</span>}
      </td>
      <td className="px-4 py-3">
        <Badge className={`text-xs font-semibold ${sensitivity.color}`}>{sensitivity.label}</Badge>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {asset.piiPolicyReviewedBy ?? "—"}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {asset.piiPolicySyncedAt
          ? new Date(asset.piiPolicySyncedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
          : asset.piiPolicyReviewedAt
          ? new Date(asset.piiPolicyReviewedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
          : "—"}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border ${st.color}`}>
          {st.icon}
          {st.label}
        </span>
      </td>
      {asset.piiPolicyNotes && (
        <td className="px-4 py-3 text-xs text-gray-500 italic max-w-[200px] truncate" title={asset.piiPolicyNotes}>
          "{asset.piiPolicyNotes}"
        </td>
      )}
    </tr>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function PiiPolicies() {
  const utils = trpc.useUtils();

  // Busca todos os ativos com políticas PII pendentes de revisão
  const pendingQuery = trpc.governance.getPiiPolicyPendingAssets.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  // Para as demais abas (aprovados/sincronizados/rejeitados), usamos listAssets
  const allAssetsQuery = trpc.governance.listAssets.useQuery(
    { limit: 500 },
    { refetchInterval: 60_000 }
  );

  function refresh() {
    utils.governance.getPiiPolicyPendingAssets.invalidate();
  }

  const pendingAssets: any[] = pendingQuery.data ?? [];

  // Filtra dos ativos gerais (se disponível)
  const allAssets: any[] = (allAssetsQuery?.data as any[]) ?? [];
  const approvedAssets = allAssets.filter((a) => a.piiPolicyStatus === "aprovado");
  const syncedAssets   = allAssets.filter((a) => a.piiPolicyStatus === "sincronizado");
  const rejectedAssets = allAssets.filter((a) => a.piiPolicyStatus === "rejeitado");

  const stats = {
    pending:  pendingAssets.length,
    approved: approvedAssets.length,
    synced:   syncedAssets.length,
    rejected: rejectedAssets.length,
  };

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-['Montserrat'] text-[#1B3A8C] flex items-center gap-2">
            <Shield size={20} className="text-[#1B3A8C]" />
            Políticas PII — Unity Catalog
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Governança &rsaquo; Políticas de Proteção de Dados Sensíveis
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={pendingQuery.isFetching}
        >
          <RefreshCw size={14} className={`mr-1.5 ${pendingQuery.isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Info box */}
      <div className="flex gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3.5">
        <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 leading-relaxed">
          As políticas de mascaramento (Masking Policy), segurança em nível de linha (RLS) e
          permissões por coluna (CLS){" "}
          <strong>
            somente são aplicadas no Unity Catalog após aprovação explícita do Data Steward
          </strong>
          . O scheduler detecta automaticamente colunas PII e abre a fila de revisão, mas nenhuma
          alteração é feita sem aprovação.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
              Pendentes de Revisão
            </p>
            <p className="text-3xl font-black font-['Montserrat'] text-amber-600">
              {pendingQuery.isLoading ? "—" : stats.pending}
            </p>
            <p className="text-xs text-gray-400 mt-1">ativos aguardando steward</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
              Aprovados (aguard. sync)
            </p>
            <p className="text-3xl font-black font-['Montserrat'] text-[#1B3A8C]">
              {stats.approved}
            </p>
            <p className="text-xs text-gray-400 mt-1">prontos para Sync Databricks</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
              Sincronizados
            </p>
            <p className="text-3xl font-black font-['Montserrat'] text-green-600">
              {stats.synced}
            </p>
            <p className="text-xs text-gray-400 mt-1">políticas ativas no Unity Catalog</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
              Rejeitados
            </p>
            <p className="text-3xl font-black font-['Montserrat'] text-red-600">
              {stats.rejected}
            </p>
            <p className="text-xs text-gray-400 mt-1">sem políticas aplicadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending">
        <TabsList className="mb-4">
          <TabsTrigger value="pending">
            Pendentes de Revisão
            {stats.pending > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {stats.pending}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">
            Aprovados — Aguard. Sync
            {stats.approved > 0 && (
              <span className="ml-1.5 bg-[#1B3A8C] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {stats.approved}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="synced">Sincronizados ({stats.synced})</TabsTrigger>
          <TabsTrigger value="rejected">Rejeitados ({stats.rejected})</TabsTrigger>
        </TabsList>

        {/* ── Aba: Pendentes ── */}
        <TabsContent value="pending">
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold font-['Montserrat'] flex items-center gap-2">
                  <ShieldAlert size={16} className="text-[#1B3A8C]" />
                  Ativos com PII Detectado — Pendentes de Revisão
                </CardTitle>
                <span className="text-xs text-gray-400">
                  Detectados automaticamente pelo scanner de metadados
                </span>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              {pendingQuery.isLoading ? (
                <div className="p-8 text-center text-gray-400 text-sm animate-pulse">
                  Carregando ativos pendentes...
                </div>
              ) : pendingAssets.length === 0 ? (
                <div className="p-10 text-center">
                  <ShieldCheck size={40} className="mx-auto text-green-400 mb-3" />
                  <p className="text-sm font-semibold text-gray-600">
                    Nenhum ativo pendente de revisão
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    O scanner não detectou novas colunas PII sem políticas aprovadas.
                  </p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 px-4 py-2.5 border-b border-gray-100">
                        Ativo
                      </th>
                      <th className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 px-4 py-2.5 border-b border-gray-100">
                        Domínio
                      </th>
                      <th className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 px-4 py-2.5 border-b border-gray-100">
                        Colunas PII
                      </th>
                      <th className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 px-4 py-2.5 border-b border-gray-100">
                        Sensibilidade
                      </th>
                      <th className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 px-4 py-2.5 border-b border-gray-100">
                        Detectado em
                      </th>
                      <th className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 px-4 py-2.5 border-b border-gray-100">
                        Status
                      </th>
                      <th className="text-right text-[11px] font-bold uppercase tracking-wider text-gray-400 px-4 py-2.5 border-b border-gray-100">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingAssets.map((asset) => (
                      <PendingAssetRow key={asset.id} asset={asset} onRefresh={refresh} />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* ── Aba: Aprovados aguardando sync ── */}
        <TabsContent value="approved">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-3 border-b border-gray-100">
                <CardTitle className="text-sm font-bold font-['Montserrat'] flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-600" />
                  Aprovados — Aguardando Sync Databricks
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {approvedAssets.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    Nenhum ativo aprovado aguardando sync.
                  </div>
                ) : (
                  approvedAssets.map((asset) => (
                    <ApprovedAssetCard key={asset.id} asset={asset} onRefresh={refresh} />
                  ))
                )}
              </CardContent>
            </Card>

            {/* Painel informativo sobre o sync */}
            <Card className="border border-blue-100 bg-blue-50/30 shadow-sm">
              <CardHeader className="pb-3 border-b border-blue-100">
                <CardTitle className="text-sm font-bold font-['Montserrat'] flex items-center gap-2 text-[#1B3A8C]">
                  <Database size={16} />
                  Como funciona o Sync Databricks
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs text-gray-600 leading-relaxed">
                <div className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#1B3A8C] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">1</span>
                  <p>O scanner detecta colunas PII e marca o ativo como <strong>pendente_revisao</strong>, enviando alerta no Teams.</p>
                </div>
                <div className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#1B3A8C] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">2</span>
                  <p>O Data Steward revisa o preview dos SQLs e <strong>aprova</strong> ou <strong>rejeita</strong> com justificativa.</p>
                </div>
                <div className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#6DC23A] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">3</span>
                  <p>Após aprovação, o botão <strong>"Sync Databricks"</strong> fica habilitado. Ao clicar, os comandos SQL são executados no Unity Catalog.</p>
                </div>
                <div className="mt-2 p-2.5 bg-white rounded-lg border border-blue-100 text-[11px] text-blue-700">
                  <strong>Políticas aplicadas:</strong> Masking Policy (colunas PII), Column-Level Security (REVOKE SELECT) e, opcionalmente, Row-Level Security.
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Aba: Sincronizados ── */}
        <TabsContent value="synced">
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-gray-100">
              <CardTitle className="text-sm font-bold font-['Montserrat'] flex items-center gap-2">
                <ShieldCheck size={16} className="text-green-600" />
                Políticas Ativas no Unity Catalog
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              {syncedAssets.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  Nenhuma política sincronizada ainda.
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 px-4 py-2.5 border-b border-gray-100">Ativo</th>
                      <th className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 px-4 py-2.5 border-b border-gray-100">Domínio</th>
                      <th className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 px-4 py-2.5 border-b border-gray-100">Sensibilidade</th>
                      <th className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 px-4 py-2.5 border-b border-gray-100">Aprovado por</th>
                      <th className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 px-4 py-2.5 border-b border-gray-100">Sincronizado em</th>
                      <th className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 px-4 py-2.5 border-b border-gray-100">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncedAssets.map((asset) => (
                      <HistoryRow key={asset.id} asset={asset} statusKey="sincronizado" />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* ── Aba: Rejeitados ── */}
        <TabsContent value="rejected">
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-gray-100">
              <CardTitle className="text-sm font-bold font-['Montserrat'] flex items-center gap-2">
                <ShieldOff size={16} className="text-red-500" />
                Políticas Rejeitadas
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              {rejectedAssets.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  Nenhuma política rejeitada.
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 px-4 py-2.5 border-b border-gray-100">Ativo</th>
                      <th className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 px-4 py-2.5 border-b border-gray-100">Domínio</th>
                      <th className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 px-4 py-2.5 border-b border-gray-100">Sensibilidade</th>
                      <th className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 px-4 py-2.5 border-b border-gray-100">Rejeitado por</th>
                      <th className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 px-4 py-2.5 border-b border-gray-100">Data</th>
                      <th className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 px-4 py-2.5 border-b border-gray-100">Status</th>
                      <th className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 px-4 py-2.5 border-b border-gray-100">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rejectedAssets.map((asset) => (
                      <HistoryRow key={asset.id} asset={asset} statusKey="rejeitado" />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
