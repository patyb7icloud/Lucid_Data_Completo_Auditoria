import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Gauge, Plus, Pencil, Trash2, AlertTriangle, CheckCircle2, Clock, ShieldAlert,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SlaConfig {
  id: number;
  name: string;
  description?: string | null;
  entityType: "asset" | "domain" | "global";
  entityId?: number | null;
  maxUpdateDays?: number | null;
  minQualityScore?: number | null;
  alertEmails?: string | null;
  webhookUrl?: string | null;
  severity?: string | null;
  alertOnBreachOnly?: boolean | null;
  active?: boolean | null;
}

interface SlaViolation {
  id: number;
  slaConfigId: number;
  entityType: string;
  entityId: number;
  entityName?: string | null;
  violationType: string;
  daysOverdue?: number | null;
  status?: string | null;
  rootCause?: string | null;
  resolvedAt?: string | null;
  detectedAt: string;
}

// ─── Violation type config ────────────────────────────────────────────────────
const violationConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  stale_data:            { label: "Dado Desatualizado",        icon: Clock,         color: "text-orange-500" },
  low_quality:           { label: "Qualidade Baixa",           icon: AlertTriangle, color: "text-red-500" },
  slow_access_response:  { label: "SLA de Acesso Vencido",     icon: ShieldAlert,   color: "text-yellow-600" },
};

// ─── Config Dialog ────────────────────────────────────────────────────────────
function SlaConfigDialog({ open, onClose, config, onSaved }: {
  open: boolean; onClose: () => void;
  config: SlaConfig | null;
  onSaved: () => void;
}) {
  const utils = trpc.useUtils();
  const createMut = trpc.sla.createConfig.useMutation({ onSuccess: () => { utils.sla.listConfigs.invalidate(); onSaved(); } });
  const updateMut = trpc.sla.updateConfig.useMutation({ onSuccess: () => { utils.sla.listConfigs.invalidate(); onSaved(); } });

  const { data: domains = [] } = trpc.domains.list.useQuery();
  const { data: assets = [] } = trpc.governance.listAssets.useQuery({ limit: 500 });

  const [form, setForm] = useState<Partial<SlaConfig>>(config ?? {
    name: "", entityType: "global", maxUpdateDays: 30, minQualityScore: 70, maxAccessResponseDays: 5,
    alertOnBreachOnly: true, active: true, severity: "medium", webhookUrl: ""
  });

  const set = (k: keyof SlaConfig, v: any) => setForm(f => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.name) return;
    const payload = {
      name: form.name!,
      description: form.description ?? undefined,
      entityType: form.entityType as any ?? "global",
      entityId: form.entityId ?? undefined,
      maxUpdateDays: form.maxUpdateDays ?? 30,
      minQualityScore: form.minQualityScore ?? 70,
      maxAccessResponseDays: form.maxAccessResponseDays ?? 5,
      alertEmails: form.alertEmails ?? undefined,
      webhookUrl: form.webhookUrl ?? undefined,
      severity: form.severity ?? "medium",
      alertOnBreachOnly: form.alertOnBreachOnly ?? true,
      active: form.active ?? true,
    };
    if (config) updateMut.mutate({ id: config.id, ...payload });
    else createMut.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{config ? "Editar SLA" : "Nova Configuração de SLA"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input placeholder="Ex: SLA de Qualidade - Domínio Financeiro" value={form.name ?? ""} onChange={e => set("name", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Input placeholder="Descreva quando esse SLA se aplica" value={form.description ?? ""} onChange={e => set("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo de Escopo</Label>
              <Select value={form.entityType ?? "global"} onValueChange={v => set("entityType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global</SelectItem>
                  <SelectItem value="domain">Por Domínio</SelectItem>
                  <SelectItem value="asset">Por Ativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>ID da Entidade (se específico)</Label>
              {form.entityType === "domain" ? (
                <Select value={form.entityId ? form.entityId.toString() : ""} onValueChange={v => set("entityId", Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Selecione um domínio" /></SelectTrigger>
                  <SelectContent>
                    {domains.map(d => (
                      <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : form.entityType === "asset" ? (
                <Select value={form.entityId ? form.entityId.toString() : ""} onValueChange={v => set("entityId", Number(v))}>
                  <SelectTrigger><SelectValue placeholder="Selecione um ativo" /></SelectTrigger>
                  <SelectContent>
                    {(assets as any[]).map(a => (
                      <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input type="number" placeholder="Opcional" value={form.entityId ?? ""} disabled className="bg-gray-50" />
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Máx. dias sem atualização</Label>
              <Input type="number" min={1} max={365} value={form.maxUpdateDays ?? 30} onChange={e => set("maxUpdateDays", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Score mínimo de qualidade</Label>
              <Input type="number" min={0} max={100} value={form.minQualityScore ?? 70} onChange={e => set("minQualityScore", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Máx. dias resposta acesso</Label>
              <Input type="number" min={1} max={90} value={form.maxAccessResponseDays ?? 5} onChange={e => set("maxAccessResponseDays", Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>E-mails para alerta (separados por vírgula)</Label>
              <Input placeholder="gestor@empresa.com" value={form.alertEmails ?? ""} onChange={e => set("alertEmails", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Webhook para Integração (Slack/Teams)</Label>
              <Input placeholder="https://hooks.slack.com/services/..." value={form.webhookUrl ?? ""} onChange={e => set("webhookUrl", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Criticidade (Severity)</Label>
            <Select value={form.severity ?? "medium"} onValueChange={v => set("severity", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Crítico (P1)</SelectItem>
                <SelectItem value="high">Alto (P2)</SelectItem>
                <SelectItem value="medium">Médio (P3)</SelectItem>
                <SelectItem value="low">Baixo (P4)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={!!form.active} onCheckedChange={v => set("active", v)} />
              <Label>Ativo</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!!form.alertOnBreachOnly} onCheckedChange={v => set("alertOnBreachOnly", v)} />
              <Label>Alertar apenas ao atingir limite</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={createMut.isPending || updateMut.isPending} className="bg-[#1B3A8C] hover:bg-[#1B3A8C]/90">
            {createMut.isPending || updateMut.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Violation Dialog ───────────────────────────────────────────────────────────
function ViolationDialog({ open, onClose, violation, onSaved }: {
  open: boolean; onClose: () => void;
  violation: SlaViolation | null;
  onSaved: () => void;
}) {
  const utils = trpc.useUtils();
  const updateMut = trpc.sla.updateViolationStatus.useMutation({ onSuccess: () => { utils.sla.listViolations.invalidate(); onSaved(); } });

  const [form, setForm] = useState<{ status: string; rootCause: string }>({
    status: violation?.status ?? "active",
    rootCause: violation?.rootCause ?? ""
  });

  if (!violation) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar Incidente (SLA)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Status do Incidente</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo (Aguardando ação)</SelectItem>
                <SelectItem value="investigating">Em Investigação</SelectItem>
                <SelectItem value="resolved">Resolvido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Causa Raiz (Root Cause) {form.status === 'resolved' && '*'}</Label>
            <textarea
              className="w-full flex min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Descreva o que causou o incidente e como foi resolvido..."
              value={form.rootCause}
              onChange={e => setForm(f => ({ ...f, rootCause: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button 
            onClick={() => updateMut.mutate({ id: violation.id, status: form.status, rootCause: form.rootCause })} 
            disabled={updateMut.isPending || (form.status === 'resolved' && !form.rootCause)} 
            className="bg-[#1B3A8C] hover:bg-[#1B3A8C]/90"
          >
            {updateMut.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SlaPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [violationDialogOpen, setViolationDialogOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<SlaConfig | null>(null);
  const [selectedViolation, setSelectedViolation] = useState<SlaViolation | null>(null);
  const [activeTab, setActiveTab] = useState<"configs" | "violations">("configs");
  const [showResolved, setShowResolved] = useState(false);

  const utils = trpc.useUtils();
  const { data: configs = [], isLoading: loadingConfigs } = trpc.sla.listConfigs.useQuery();
  const { data: violations = [], isLoading: loadingViolations } = trpc.sla.listViolations.useQuery(
    { resolved: showResolved ? undefined : false, limit: 100 }
  );
  const deleteMut = trpc.sla.deleteConfig.useMutation({ onSuccess: () => utils.sla.listConfigs.invalidate() });
  const resolveMut = trpc.sla.resolveViolation.useMutation({ onSuccess: () => utils.sla.listViolations.invalidate() });

  const activeViolations = (violations as any[]).filter((v: SlaViolation) => v.status !== 'resolved').length;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#1B3A8C]/10 rounded-xl">
            <Gauge className="h-7 w-7 text-[#1B3A8C]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1B3A8C]">SLA de Dados</h1>
            <p className="text-muted-foreground text-sm">Acordos de nível de serviço para qualidade e atualização de dados</p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditConfig(null); setDialogOpen(true); }} className="bg-[#1B3A8C] hover:bg-[#1B3A8C]/90 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Configuração
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <Gauge className="h-8 w-8 text-[#1B3A8C]" />
            <div>
              <p className="text-2xl font-bold">{configs.length}</p>
              <p className="text-xs text-muted-foreground">Configurações de SLA</p>
            </div>
          </CardContent>
        </Card>
        <Card className={activeViolations > 0 ? "border-red-200" : ""}>
          <CardContent className="pt-5 flex items-center gap-3">
            <AlertTriangle className={`h-8 w-8 ${activeViolations > 0 ? "text-red-500" : "text-gray-300"}`} />
            <div>
              <p className={`text-2xl font-bold ${activeViolations > 0 ? "text-red-600" : ""}`}>{activeViolations}</p>
              <p className="text-xs text-muted-foreground">Violações Ativas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-100">
          <CardContent className="pt-5 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-green-600">{(violations as any[]).filter((v: SlaViolation) => v.resolvedAt).length}</p>
              <p className="text-xs text-muted-foreground">Violações Resolvidas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(["configs", "violations"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? "bg-white shadow text-[#1B3A8C]" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tab === "configs" ? "Configurações" : `Violações ${activeViolations > 0 ? `(${activeViolations})` : ""}`}
          </button>
        ))}
      </div>

      {/* Configs tab */}
      {activeTab === "configs" && (
        <div className="space-y-3">
          {loadingConfigs ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : configs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma configuração de SLA. {isAdmin && "Clique em \"Nova Configuração\" para começar."}
            </div>
          ) : (
            configs.map((c: SlaConfig) => (
              <Card key={c.id} className={!c.active ? "opacity-60" : ""}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{c.name}</h3>
                        <Badge variant="outline" className="text-xs capitalize">{c.entityType}</Badge>
                        {c.severity && (
                          <Badge className={`text-xs ${
                            c.severity === 'critical' ? 'bg-red-100 text-red-800' :
                            c.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                            c.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {c.severity.toUpperCase()}
                          </Badge>
                        )}
                        {!c.active && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                      </div>
                      {c.description && <p className="text-sm text-muted-foreground mb-2">{c.description}</p>}
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span><strong>Atualização:</strong> máx {c.maxUpdateDays} dias</span>
                        <span><strong>Qualidade mínima:</strong> {c.minQualityScore}/100</span>
                        <span><strong>Resposta a acessos:</strong> máx {c.maxAccessResponseDays} dias</span>
                        {c.alertEmails && <span><strong>Alertas:</strong> {c.alertEmails}</span>}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 ml-4">
                        <Button size="icon" variant="ghost" onClick={() => { setEditConfig(c); setDialogOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => confirm("Excluir esta configuração de SLA?") && deleteMut.mutate({ id: c.id })} className="text-red-500 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Violations tab */}
      {activeTab === "violations" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Switch checked={showResolved} onCheckedChange={setShowResolved} />
            <Label className="text-sm">Mostrar violações resolvidas</Label>
          </div>
          {loadingViolations ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : violations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhuma violação encontrada.</div>
          ) : (
            (violations as any[]).map((v: SlaViolation) => {
              const vc = violationConfig[v.violationType] ?? { label: v.violationType, icon: AlertTriangle, color: "text-gray-500" };
              const Icon = vc.icon;
              return (
                <Card key={v.id} className={v.resolvedAt ? "opacity-60 border-green-100" : "border-red-100"}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className={`h-5 w-5 ${vc.color}`} />
                        <div>
                          <p className="font-medium text-sm">{v.entityName ?? `Entidade #${v.entityId}`}</p>
                          <div className="flex gap-2 mt-0.5">
                            <Badge variant="outline" className="text-xs">{vc.label}</Badge>
                            <Badge variant="outline" className="text-xs capitalize">{v.entityType}</Badge>
                            {v.daysOverdue != null && v.daysOverdue > 0 && (
                              <Badge className="text-xs bg-red-100 text-red-700">{v.daysOverdue}d em atraso</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {new Date(v.detectedAt).toLocaleDateString("pt-BR")}
                        </span>
                        {v.status === 'resolved' ? (
                          <Badge className="bg-green-100 text-green-800 text-xs flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Resolvida
                          </Badge>
                        ) : v.status === 'investigating' ? (
                          <Badge className="bg-orange-100 text-orange-800 text-xs flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Investigando
                          </Badge>
                        ) : null}
                        {isAdmin && v.status !== 'resolved' && (
                          <Button size="sm" variant="outline" onClick={() => { setSelectedViolation(v); setViolationDialogOpen(true); }} className="text-xs">
                            Gerenciar Incidente
                          </Button>
                        )}
                        {isAdmin && v.status === 'resolved' && (
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedViolation(v); setViolationDialogOpen(true); }} className="text-xs">
                            Ver Relatório
                          </Button>
                        )}
                      </div>
                    </div>
                    {v.status === 'resolved' && v.rootCause && (
                      <div className="mt-3 text-xs bg-slate-50 dark:bg-slate-800 p-2 rounded border text-muted-foreground">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Causa Raiz:</span> {v.rootCause}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      <SlaConfigDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditConfig(null); }}
        config={editConfig}
        onSaved={() => { setDialogOpen(false); setEditConfig(null); }}
      />

      <ViolationDialog
        open={violationDialogOpen}
        onClose={() => { setViolationDialogOpen(false); setSelectedViolation(null); }}
        violation={selectedViolation}
        onSaved={() => { setViolationDialogOpen(false); setSelectedViolation(null); }}
      />
    </div>
  );
}
