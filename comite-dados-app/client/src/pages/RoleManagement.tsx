import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ShieldCheck,
  UserCircle2,
  Search,
  RefreshCw,
  Users,
  Crown,
  UserCog,
  Mail,
  Clock,
  ScrollText,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  CalendarDays,
  X,
  BadgeCheck,
  UserCheck,
  ShieldAlert,
  UserPlus,
  Unplug,
  UserMinus,
  Lock,
  MessageSquareQuote,
  History,
  AlertCircle
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
type RoleType = "user" | "admin" | "data_steward" | "data_owner" | "data_analyst";
type RoleFilter = "all" | RoleType;
type AuditAction = "all" | "promoted" | "demoted";
type ActiveTab = "users" | "audit";

interface ConfirmState {
  open: boolean;
  targetId: string | number;
  targetName: string;
  newRole: RoleType;
  reason: string;
  type: "update" | "enable" | "disable";
}

const PAGE_SIZE = 15;

const ROLE_CONFIG: Record<RoleType, { label: string, color: string, icon: any }> = {
  admin: { label: "Administrador", color: "bg-[#1B3A8C] text-white", icon: Crown },
  data_steward: { label: "Data Steward", color: "bg-[#6DC23A] text-white", icon: ShieldCheck },
  data_owner: { label: "Data Owner", color: "bg-purple-600 text-white", icon: BadgeCheck },
  data_analyst: { label: "Data Analyst", color: "bg-blue-500 text-white", icon: UserCheck },
  user: { label: "Usuário Comum", color: "bg-gray-100 text-gray-600", icon: UserCircle2 },
};

export default function RoleManagement() {
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState<ActiveTab>("users");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [confirm, setConfirm] = useState<ConfirmState>({
    open: false,
    targetId: "",
    targetName: "",
    newRole: "user",
    reason: "",
    type: "update"
  });

  const [auditSearch, setAuditSearch] = useState("");
  const [auditAction, setAuditAction] = useState<AuditAction>("all");
  const [auditPage, setAuditPage] = useState(0);
  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");

  const toDate = (s: string) => s ? new Date(s.split("-").map(Number)[0], s.split("-").map(Number)[1] - 1, s.split("-").map(Number)[2]) : undefined;

  const { data: stats } = trpc.roles.stats.useQuery();
  const { data: members = [], isLoading, isFetching } = trpc.roles.listUsers.useQuery({
    role: roleFilter === "all" ? undefined : roleFilter as any,
    search: search || undefined
  });

  const { data: auditData, isLoading: auditLoading, isFetching: auditFetching } = trpc.roles.auditLog.useQuery({
    limit: PAGE_SIZE,
    offset: auditPage * PAGE_SIZE,
    action: auditAction === "all" ? undefined : auditAction,
    search: auditSearch || undefined,
    dateFrom: toDate(auditDateFrom),
    dateTo: toDate(auditDateTo),
  });

  const auditEntries = auditData?.entries ?? [];
  const auditTotal = auditData?.total ?? 0;
  const auditTotalPages = Math.max(1, Math.ceil(auditTotal / PAGE_SIZE));

  const updateRoleMutation = trpc.roles.updateRole.useMutation({
    onSuccess: (updated) => {
      utils.roles.listUsers.invalidate();
      utils.roles.stats.invalidate();
      utils.roles.auditLog.invalidate();
      toast.success(`Papel de ${updated.name} atualizado.`);
      setConfirm((c) => ({ ...c, open: false, reason: "" }));
    },
    onError: (e) => toast.error(e.message),
  });

  const enableAccessMutation = trpc.roles.enableAccess.useMutation({
    onSuccess: () => {
      utils.roles.listUsers.invalidate();
      utils.roles.stats.invalidate();
      utils.roles.auditLog.invalidate();
      toast.success("Acesso habilitado com sucesso!");
      setConfirm((c) => ({ ...c, open: false, reason: "" }));
    },
    onError: (e) => toast.error(e.message),
  });

  const disableAccessMutation = trpc.roles.disableAccess.useMutation({
    onSuccess: () => {
      utils.roles.listUsers.invalidate();
      utils.roles.stats.invalidate();
      utils.roles.auditLog.invalidate();
      toast.success("Acesso revogado com sucesso!");
      setConfirm((c) => ({ ...c, open: false, reason: "" }));
    },
    onError: (e) => toast.error(e.message),
  });

  const handleAction = (id: string | number, name: string, type: "update" | "enable" | "disable", role?: RoleType) => {
    setConfirm({ open: true, targetId: id, targetName: name, newRole: role || "user", reason: "", type });
  };

  const handleConfirm = () => {
    if (confirm.type === "enable") {
      enableAccessMutation.mutate({ participantId: Number(confirm.targetId), role: confirm.newRole as any, reason: confirm.reason });
    } else if (confirm.type === "disable") {
      if (!confirm.reason || confirm.reason.length < 5) {
        toast.error("Por favor, informe um motivo válido (mínimo 5 caracteres).");
        return;
      }
      disableAccessMutation.mutate({ participantId: Number(confirm.targetId), reason: confirm.reason });
    } else {
      updateRoleMutation.mutate({ targetOpenId: String(confirm.targetId), newRole: confirm.newRole as any, reason: confirm.reason });
    }
  };

  // ── Drill-down dos cards de KPI ─────────────────────────────────────────────
  type RoleDrillType = "membros" | "ativas" | "pendentes" | "admins" | null;
  const [roleDrill, setRoleDrill] = useState<RoleDrillType>(null);
  const [roleDrillSearch, setRoleDrillSearch] = useState("");

  const allMembers = members as any[];

  const roleDrillItems = useMemo(() => {
    let list: any[];
    switch (roleDrill) {
      case "membros":   list = allMembers; break;
      case "ativas":    list = allMembers.filter(m => m.userId); break;
      case "pendentes": list = allMembers.filter(m => !m.userId); break;
      case "admins":    list = allMembers.filter(m => m.role === "admin"); break;
      default:          list = allMembers;
    }
    if (!roleDrillSearch.trim()) return list;
    const q = roleDrillSearch.toLowerCase();
    return list.filter(m =>
      (m.name || "").toLowerCase().includes(q) ||
      (m.email || "").toLowerCase().includes(q)
    );
  }, [roleDrill, allMembers, roleDrillSearch]);

  const roleDrillMeta: Record<Exclude<RoleDrillType, null>, { title: string; description: string }> = {
    membros:   { title: "Membros do Comitê",    description: "Todos os participantes cadastrados no comitê de dados." },
    ativas:    { title: "Contas Ativas",          description: "Participantes com acesso ao sistema habilitado." },
    pendentes: { title: "Pendentes de Acesso",   description: "Participantes sem conta de usuário vinculada." },
    admins:    { title: "Administradores",        description: "Usuários com papel de Administrador no sistema." },
  };

  if (isLoading) return <div className="p-10 text-center font-bold text-blue-900 animate-pulse">Sincronizando Centro de Identidade...</div>;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900">
            <UserCog className="h-6 w-6 text-[#1B3A8C]" /> Centro de Comando de Identidades
          </h1>
          <p className="text-sm text-gray-500 font-medium">Gestão unificada de Participantes e Acessos ao Sistema.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={activeTab === "users" ? "default" : "outline"} 
            size="sm" 
            onClick={() => setActiveTab("users")}
            className={activeTab === "users" ? "bg-[#1B3A8C]" : ""}
          >
            <Users className="w-4 h-4 mr-2" /> Usuários e Acessos
          </Button>
          <Button 
            variant={activeTab === "audit" ? "default" : "outline"} 
            size="sm" 
            onClick={() => setActiveTab("audit")}
            className={activeTab === "audit" ? "bg-[#1B3A8C]" : ""}
          >
            <History className="w-4 h-4 mr-2" /> Log de Auditoria
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Membros Comitê" value={members.length} icon={Users} onClick={() => { setRoleDrillSearch(""); setRoleDrill("membros"); }} />
        <StatCard label="Contas Ativas" value={stats?.total || 0} icon={BadgeCheck} color="text-[#6DC23A]" onClick={() => { setRoleDrillSearch(""); setRoleDrill("ativas"); }} />
        <StatCard label="Pendentes Acesso" value={members.filter(m => !m.userId).length} icon={Unplug} color="text-orange-500" onClick={() => { setRoleDrillSearch(""); setRoleDrill("pendentes"); }} />
        <StatCard label="Administradores" value={stats?.admins || 0} icon={Crown} color="text-[#1B3A8C]" onClick={() => { setRoleDrillSearch(""); setRoleDrill("admins"); }} />
      </div>

      {/* Modal de drill-down dos cards de KPI */}
      {roleDrill && (
        <Dialog open onOpenChange={() => setRoleDrill(null)}>
          <DialogContent className="max-w-xl max-h-[75vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Users size={15} className="text-[#1B3A8C]" />
                {roleDrillMeta[roleDrill].title}
                <span className="ml-1 text-xs font-semibold text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">
                  {roleDrillItems.length}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                {roleDrillMeta[roleDrill].description}
              </DialogDescription>
            </DialogHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome ou e-mail..."
                className="w-full pl-8 pr-3 h-8 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
                value={roleDrillSearch}
                onChange={(e) => setRoleDrillSearch(e.target.value)}
              />
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-gray-100 rounded-lg border border-gray-100">
              {roleDrillItems.length === 0 ? (
                <div className="p-10 text-center text-sm text-gray-400">Nenhum participante encontrado.</div>
              ) : (
                roleDrillItems.map((m: any) => {
                  const cfg = ROLE_CONFIG[m.role as RoleType] ?? ROLE_CONFIG.user;
                  const RoleIcon = cfg.icon;
                  return (
                    <div key={m.id ?? m.email} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 text-[#1B3A8C] font-black text-xs">
                          {(m.name || "?").split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">{m.name || "Sem nome"}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 truncate">{m.email || ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        {!m.userId && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                            Sem acesso
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex justify-end pt-1">
              <Button variant="outline" size="sm" onClick={() => setRoleDrill(null)}>
                <X size={13} className="mr-1" /> Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {activeTab === "users" ? (
        <Card className="border-none shadow-md bg-white overflow-hidden">
          <div className="p-4 bg-gray-50/50 border-b flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Buscar por nome ou e-mail no comitê..." 
                className="pl-9 h-10 bg-white border-gray-200"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => utils.roles.listUsers.invalidate()} className="gap-2">
              <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/30 border-b border-gray-100">
                  <th className="text-left px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Participante</th>
                  <th className="text-left px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cargo / Área</th>
                  <th className="text-left px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status de Acesso</th>
                  <th className="text-right px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ações de Acesso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {members.map((m) => {
                  const config = ROLE_CONFIG[m.systemRole as RoleType];
                  const hasAccess = !!m.userId;
                  const isSelf = m.openId === currentUser?.openId;
                  
                  return (
                    <tr key={m.participantId} className={`hover:bg-blue-50/10 transition-colors ${isSelf ? 'bg-blue-50/30' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shadow-sm ${hasAccess ? (config?.color || 'bg-blue-500 text-white') : 'bg-gray-200 text-gray-400'}`}>
                            {getInitials(m.name)}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{m.name}</p>
                            <p className="text-[10px] text-gray-400">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-gray-700">{m.jobTitle || 'N/A'}</span>
                          <span className="text-[10px] text-gray-400">{m.department || 'Corporativo'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {hasAccess ? (
                          <Badge className={`gap-1.5 px-3 py-1 font-bold ${config?.color || 'bg-blue-500 text-white'} border-none`}>
                            {config ? <config.icon size={12} /> : <UserCheck size={12} />} {config?.label || 'Acesso Ativo'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1.5 px-3 py-1 font-bold text-gray-400 border-gray-200">
                            <Unplug size={12} /> Sem Acesso
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {isSelf ? (
                            <span className="text-[10px] font-black text-blue-600 uppercase">Sua Conta</span>
                          ) : hasAccess ? (
                            <>
                              <Select 
                                defaultValue={m.systemRole ?? undefined} 
                                onValueChange={(val) => handleAction(m.openId!, m.name, "update", val as RoleType)}
                              >
                                <SelectTrigger className="w-36 h-8 text-[10px] font-bold border-gray-200">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(ROLE_CONFIG).map(([role, cfg]) => (
                                    <SelectItem key={role} value={role} className="text-xs font-bold">
                                      {cfg.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button 
                                size="icon" 
                                variant="outline" 
                                className="h-8 w-8 text-orange-500 hover:bg-orange-50 border-orange-100"
                                title="Revogar Acesso"
                                onClick={() => handleAction(m.participantId, m.name, "disable")}
                              >
                                <UserMinus size={14} />
                              </Button>
                            </>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 gap-1.5 text-[10px] font-bold border-[#1B3A8C]/30 text-[#1B3A8C] hover:bg-[#1B3A8C] hover:text-white"
                              onClick={() => handleAction(m.participantId, m.name, "enable", "user")}
                            >
                              <UserPlus size={14} /> Habilitar Acesso
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="border-none shadow-md bg-white overflow-hidden">
          <div className="p-4 bg-gray-50/50 border-b flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Buscar no histórico..." 
                className="pl-9 h-10 bg-white"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Input type="date" className="h-10 w-40" value={auditDateFrom} onChange={(e) => setAuditDateFrom(e.target.value)} />
              <Input type="date" className="h-10 w-40" value={auditDateTo} onChange={(e) => setAuditDateTo(e.target.value)} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/30 border-b border-gray-100">
                  <th className="text-left px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Data / Executor</th>
                  <th className="text-left px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Alvo</th>
                  <th className="text-left px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ação / Mudança</th>
                  <th className="text-left px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Motivo / Justificativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {auditEntries.map((log: any) => {
                  const isRevoke = log.newRole === "revoked";
                  const isCreate = log.previousRole === "none";
                  
                  return (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900 text-xs">{formatDateTime(log.createdAt)}</span>
                          <span className="text-[10px] text-blue-600 font-medium">Por: {log.executorName || log.executorOpenId}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-700 text-xs">{log.targetName}</span>
                          <span className="text-[10px] text-gray-400">{log.targetEmail}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[9px] font-bold uppercase tracking-tighter ${isRevoke ? 'border-orange-200 text-orange-600' : isCreate ? 'border-green-200 text-green-600' : 'border-blue-200 text-blue-600'}`}>
                            {isRevoke ? "Revogado" : isCreate ? "Habilitado" : "Alterado"}
                          </Badge>
                          <div className="flex items-center gap-1 text-[10px] font-medium text-gray-500">
                            <span>{log.previousRole || "none"}</span>
                            <ArrowRight size={10} className="text-gray-300" />
                            <span className="text-gray-900 font-bold">{log.newRole}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <div className="flex items-start gap-1.5">
                          <MessageSquareQuote size={12} className="text-gray-300 mt-0.5 shrink-0" />
                          <p className="text-[11px] text-gray-600 italic line-clamp-2" title={log.reason}>
                            {log.reason || "Nenhuma justificativa informada."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t bg-gray-50/30 flex justify-between items-center">
            <span className="text-xs text-gray-500 font-medium">
              Mostrando {auditEntries.length} de {auditTotal} registros
            </span>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={auditPage === 0} 
                onClick={() => setAuditPage(p => p - 1)}
              >
                <ChevronLeft size={16} />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={auditPage >= auditTotalPages - 1} 
                onClick={() => setAuditPage(p => p + 1)}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Dialog open={confirm.open} onOpenChange={(v) => { if(!v) setConfirm(c => ({...c, open: false, reason: ""})) }}>
        <DialogContent className="max-w-md border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirm.type === "enable" && <UserPlus className="h-6 w-6 text-[#1B3A8C]" />}
              {confirm.type === "update" && <ShieldAlert className="h-6 w-6 text-[#1B3A8C]" />}
              {confirm.type === "disable" && <Lock className="h-6 w-6 text-orange-500" />}
              <span className={confirm.type === "disable" ? "text-orange-600" : "text-[#1B3A8C]"}>
                {confirm.type === "enable" ? "Habilitar Acesso ao Sistema" : 
                 confirm.type === "disable" ? "Revogar Acesso ao Sistema" : "Alterar Papel de Acesso"}
              </span>
            </DialogTitle>
            <DialogDescription className="py-2 font-medium">
              {confirm.type === "enable" ? (
                <>Você está criando um acesso para <strong>{confirm.targetName}</strong>.</>
              ) : confirm.type === "disable" ? (
                <>Tem certeza que deseja revogar o acesso de <strong>{confirm.targetName}</strong>? Esta ação excluirá a conta de login mas manterá o registro do participante no comitê.</>
              ) : (
                <>Você está alterando as permissões de <strong>{confirm.targetName}</strong>.</>
              )}
              
              {(confirm.type === "enable" || confirm.type === "update") && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-2 font-bold uppercase tracking-wider">Selecione o Papel:</p>
                  <Select 
                    value={confirm.newRole} 
                    onValueChange={(val) => setConfirm(c => ({ ...c, newRole: val as RoleType }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_CONFIG).map(([role, cfg]) => (
                        <SelectItem key={role} value={role}>
                          <div className="flex items-center gap-2">
                            <cfg.icon size={14} /> {cfg.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                    {confirm.type === "disable" ? "Motivo da Revogação (Obrigatório):" : "Observações / Justificativa (Opcional):"}
                  </p>
                  {confirm.type === "disable" && (
                    <span className={`text-[10px] font-bold ${confirm.reason.length < 5 ? 'text-orange-500' : 'text-green-600'}`}>
                      {confirm.reason.length}/5 caracteres
                    </span>
                  )}
                </div>
                <Textarea 
                  placeholder={confirm.type === "disable" ? "Ex: Colaborador desligado da empresa ou mudou de comitê..." : "Ex: Promoção para Steward de Dados Globais..."}
                  value={confirm.reason}
                  onChange={(e) => setConfirm(c => ({ ...c, reason: e.target.value }))}
                  className={`min-h-[80px] text-xs ${confirm.type === "disable" && confirm.reason.length < 5 ? 'border-orange-300 focus-visible:ring-orange-500' : 'border-gray-200'}`}
                />
              </div>
            </DialogDescription>
          </DialogHeader>
          
          <div className={`p-4 rounded-2xl text-[11px] font-medium italic ${confirm.type === "disable" ? 'bg-orange-50 text-orange-700' : 'bg-gray-50 text-gray-500'}`}>
            <div className="flex gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>
                {confirm.type === "disable" ? 
                  "Atenção: Esta ação é irreversível por este log. O usuário não poderá mais realizar login e o motivo acima será gravado permanentemente na trilha de auditoria." :
                  "Esta ação e a justificativa acima serão gravadas permanentemente no log de auditoria para fins de compliance."
                }
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setConfirm(c => ({ ...c, open: false, reason: "" }))}>Cancelar</Button>
            <Button 
              className={confirm.type === "disable" ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-[#1B3A8C] hover:bg-[#0F2460]"} 
              onClick={handleConfirm} 
              disabled={updateRoleMutation.isPending || enableAccessMutation.isPending || disableAccessMutation.isPending || (confirm.type === "disable" && confirm.reason.length < 5)}
            >
              {confirm.type === "enable" ? "Confirmar Habilitação" : 
               confirm.type === "disable" ? "Confirmar Revogação" : "Confirmar Mudança"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, onClick }: any) {
  return (
    <Card
      className={`border-none shadow-sm bg-white ${
        onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all hover:ring-2 hover:ring-offset-1 hover:ring-blue-200" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4 flex items-center justify-between relative">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
          <p className={`text-xl font-black mt-1 ${color || 'text-gray-900'}`}>{value}</p>
        </div>
        <div className="p-2 rounded-full bg-gray-50">
          <Icon className={`h-5 w-5 ${color || 'text-gray-300'}`} />
        </div>
        {onClick && <ChevronRight size={11} className="absolute bottom-2 right-2 text-gray-200" />}
      </CardContent>
    </Card>
  );
}
