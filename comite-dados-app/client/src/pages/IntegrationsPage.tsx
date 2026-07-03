import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Webhook, Plus, Pencil, Trash2, CheckCircle2, XCircle, Send,
  Key, Copy, Eye, EyeOff, Calendar, Zap,
} from "lucide-react";

// ─── Available Webhook Events ─────────────────────────────────────────────────
const WEBHOOK_EVENTS = [
  { value: "asset.created",          label: "Ativo criado" },
  { value: "asset.updated",          label: "Ativo atualizado" },
  { value: "asset.deleted",          label: "Ativo excluído" },
  { value: "quality.violation",      label: "Falha de Qualidade (Regex/Completude)" },
  { value: "access_request.created", label: "Solicitação de acesso criada" },
  { value: "access_request.approved",label: "Solicitação aprovada" },
  { value: "access_request.rejected",label: "Solicitação rejeitada" },
  { value: "glossary.approved",      label: "Termo do glossário aprovado" },
  { value: "sla.violation",          label: "Violação de SLA detectada" },
  { value: "*",                      label: "Todos os eventos" },
];

// ─── API Key Scopes ───────────────────────────────────────────────────────────
const API_SCOPES = [
  { value: "assets:read",    label: "Ativos — Leitura" },
  { value: "assets:write",   label: "Ativos — Escrita" },
  { value: "glossary:read",  label: "Glossário — Leitura" },
  { value: "glossary:write", label: "Glossário — Escrita" },
  { value: "access:read",    label: "Solicitações de Acesso — Leitura" },
  { value: "metrics:read",   label: "Métricas e Maturidade — Leitura" },
  { value: "lgpd:read",      label: "Relatório LGPD — Leitura" },
];

// ─── Webhook Dialog ───────────────────────────────────────────────────────────
function WebhookDialog({ open, onClose, webhook, onSaved }: {
  open: boolean; onClose: () => void;
  webhook: any | null; onSaved: () => void;
}) {
  const utils = trpc.useUtils();
  const createMut = trpc.webhooks.create.useMutation({ onSuccess: () => { utils.webhooks.list.invalidate(); onSaved(); } });
  const updateMut = trpc.webhooks.update.useMutation({ onSuccess: () => { utils.webhooks.list.invalidate(); onSaved(); } });

  const [form, setForm] = useState({
    name: webhook?.name ?? "",
    url: webhook?.url ?? "",
    secret: "",
    events: (Array.isArray(webhook?.events) ? webhook.events : []) as string[],
    active: webhook?.active ?? true,
  });

  const toggleEvent = (ev: string) => {
    setForm(f => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev],
    }));
  };

  const submit = () => {
    if (!form.name || !form.url || form.events.length === 0) return;
    const payload = { name: form.name, url: form.url, events: form.events, active: form.active, secret: form.secret || undefined };
    if (webhook) updateMut.mutate({ id: webhook.id, ...payload });
    else createMut.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{webhook ? "Editar Webhook" : "Novo Webhook"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input placeholder="Ex: Notificação Slack" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>URL de destino *</Label>
            <Input type="url" placeholder="https://hooks.slack.com/..." value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Secret (para verificação HMAC — opcional)</Label>
            <Input type="password" placeholder="Deixe em branco para não assinar" value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Eventos *</Label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
              {WEBHOOK_EVENTS.map(ev => (
                <div key={ev.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`ev-${ev.value}`}
                    checked={form.events.includes(ev.value)}
                    onCheckedChange={() => toggleEvent(ev.value)}
                  />
                  <Label htmlFor={`ev-${ev.value}`} className="text-xs font-normal cursor-pointer">{ev.label}</Label>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
            <Label>Ativo</Label>
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

// ─── API Key Dialog ───────────────────────────────────────────────────────────
function ApiKeyDialog({ open, onClose, newKey, onSaved }: {
  open: boolean; onClose: () => void; newKey: string | null; onSaved: () => void;
}) {
  const utils = trpc.useUtils();
  const createMut = trpc.apiKeys.create.useMutation({
    onSuccess: (data) => { utils.apiKeys.list.invalidate(); onSaved(); },
  });
  const [form, setForm] = useState({ name: "", scopes: [] as string[], expiresInDays: 365 });
  const [createdKey, setCreatedKey] = useState<string | null>(newKey);
  const [copied, setCopied] = useState(false);

  const toggleScope = (s: string) => setForm(f => ({
    ...f, scopes: f.scopes.includes(s) ? f.scopes.filter(x => x !== s) : [...f.scopes, s],
  }));

  const submit = async () => {
    if (!form.name || form.scopes.length === 0) return;
    const result = await createMut.mutateAsync({ name: form.name, scopes: form.scopes, expiresInDays: form.expiresInDays });
    if (result?.key) setCreatedKey(result.key);
  };

  const copyKey = () => {
    if (createdKey) { navigator.clipboard.writeText(createdKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  if (createdKey) {
    return (
      <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" /> Chave criada com sucesso!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Copie esta chave agora. Por segurança, ela <strong>não será exibida novamente</strong>.
            </p>
            <div className="flex items-center gap-2 bg-gray-100 rounded-md p-3 font-mono text-sm break-all">
              <span className="flex-1">{createdKey}</span>
              <Button size="icon" variant="ghost" onClick={copyKey} className="shrink-0">
                {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use o cabeçalho <code className="bg-gray-100 px-1 rounded">Authorization: Bearer {"{sua_chave}"}</code> nas requisições à API.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={onClose} className="bg-[#1B3A8C] hover:bg-[#1B3A8C]/90">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova API Key</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Nome da Chave *</Label>
            <Input placeholder="Ex: Integração PowerBI" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Permissões (Scopes) *</Label>
            <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
              {API_SCOPES.map(s => (
                <div key={s.value} className="flex items-center gap-2">
                  <Checkbox id={`sc-${s.value}`} checked={form.scopes.includes(s.value)} onCheckedChange={() => toggleScope(s.value)} />
                  <Label htmlFor={`sc-${s.value}`} className="text-xs font-normal cursor-pointer">{s.label}</Label>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Expiração (dias a partir de hoje)</Label>
            <Input type="number" min={1} max={3650} value={form.expiresInDays} onChange={e => setForm(f => ({ ...f, expiresInDays: Number(e.target.value) }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={createMut.isPending} className="bg-[#1B3A8C] hover:bg-[#1B3A8C]/90">
            {createMut.isPending ? "Gerando..." : "Gerar Chave"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function IntegrationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [activeTab, setActiveTab] = useState<"webhooks" | "apikeys">("webhooks");
  const [webhookDialog, setWebhookDialog] = useState(false);
  const [editWebhook, setEditWebhook] = useState<any>(null);
  const [apiKeyDialog, setApiKeyDialog] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: webhooks = [] } = trpc.webhooks.list.useQuery();
  const { data: apiKeys = [] } = trpc.apiKeys.list.useQuery();
  const { data: deliveries = [] } = trpc.webhooks.deliveries.useQuery(
    { webhookConfigId: selectedWebhook! }, { enabled: !!selectedWebhook }
  );
  const deleteWebhook = trpc.webhooks.delete.useMutation({ onSuccess: () => utils.webhooks.list.invalidate() });
  const revokeKey = trpc.apiKeys.revoke.useMutation({ onSuccess: () => utils.apiKeys.list.invalidate() });
  const testDispatch = trpc.webhooks.testDispatch.useMutation();

  const tabs = ["webhooks", "apikeys"] as const;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#1B3A8C]/10 rounded-xl">
            <Zap className="h-7 w-7 text-[#1B3A8C]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1B3A8C]">Integrações & API</h1>
            <p className="text-muted-foreground text-sm">Webhooks, API Keys e configurações de integração</p>
          </div>
        </div>
        {isAdmin && (
          <Button
            onClick={() => activeTab === "webhooks" ? setWebhookDialog(true) : setApiKeyDialog(true)}
            className="bg-[#1B3A8C] hover:bg-[#1B3A8C]/90 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {activeTab === "webhooks" ? "Novo Webhook" : "Nova API Key"}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setActiveTab("webhooks")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === "webhooks" ? "bg-white shadow text-[#1B3A8C]" : "text-muted-foreground"}`}>
          <Webhook className="h-4 w-4" /> Webhooks ({webhooks.length})
        </button>
        <button onClick={() => setActiveTab("apikeys")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === "apikeys" ? "bg-white shadow text-[#1B3A8C]" : "text-muted-foreground"}`}>
          <Key className="h-4 w-4" /> API Keys ({apiKeys.length})
        </button>
      </div>

      {/* Webhooks */}
      {activeTab === "webhooks" && (
        <div className="space-y-4">
          {webhooks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Webhook className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>Nenhum webhook configurado.</p>
              <p className="text-sm">Configure webhooks para receber notificações em tempo real.</p>
            </div>
          ) : (
            webhooks.map((wh: any) => (
              <Card key={wh.id} className={!wh.active ? "opacity-60" : ""}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{wh.name}</span>
                        {wh.active ? (
                          <Badge className="bg-green-100 text-green-800 text-xs">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Inativo</Badge>
                        )}
                        {wh.failureCount > 0 && (
                          <Badge className="bg-red-100 text-red-800 text-xs">{wh.failureCount} falhas</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground font-mono truncate max-w-md">{wh.url}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(Array.isArray(wh.events) ? wh.events : []).map((ev: string) => (
                          <Badge key={ev} variant="outline" className="text-xs">{ev}</Badge>
                        ))}
                      </div>
                      {wh.lastTriggeredAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Última entrega: {new Date(wh.lastTriggeredAt).toLocaleString("pt-BR")}
                          {wh.lastStatusCode && ` (HTTP ${wh.lastStatusCode})`}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 ml-4">
                      {isAdmin && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => testDispatch.mutate({ id: wh.id })} disabled={testDispatch.isPending} className="text-xs flex items-center gap-1">
                            <Send className="h-3 w-3" /> Testar
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setSelectedWebhook(selectedWebhook === wh.id ? null : wh.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => { setEditWebhook(wh); setWebhookDialog(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => confirm("Excluir webhook?") && deleteWebhook.mutate({ id: wh.id })} className="text-red-500 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Deliveries */}
                  {selectedWebhook === wh.id && (
                    <div className="mt-4 border-t pt-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Histórico de Entregas</p>
                      {deliveries.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhuma entrega registrada.</p>
                      ) : (
                        <div className="space-y-1">
                          {deliveries.slice(0, 10).map((d: any) => (
                            <div key={d.id} className="flex items-center gap-3 text-xs">
                              {d.success ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                              <span className="font-mono text-muted-foreground">{d.event}</span>
                              <span>HTTP {d.statusCode ?? "—"}</span>
                              <span className="text-muted-foreground">{new Date(d.deliveredAt).toLocaleString("pt-BR")}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}

          {/* API Docs hint */}
          <Card className="border-dashed bg-blue-50/30">
            <CardContent className="pt-4">
              <p className="text-sm font-medium mb-1">Formato do payload enviado:</p>
              <pre className="text-xs bg-gray-900 text-gray-100 rounded p-3 overflow-x-auto">{`{
  "event": "asset.created",
  "timestamp": "2025-07-01T10:00:00.000Z",
  "payload": { ... }
}`}</pre>
              <p className="text-xs text-muted-foreground mt-2">
                Se um secret for configurado, o header <code className="bg-gray-100 px-1 rounded">X-Webhook-Signature: sha256=...</code> será enviado para verificação HMAC.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* API Keys */}
      {activeTab === "apikeys" && (
        <div className="space-y-4">
          {/* Docs */}
          <Card className="border-blue-100 bg-blue-50/30">
            <CardContent className="pt-4">
              <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Key className="h-4 w-4 text-[#1B3A8C]" /> Como usar a API REST
              </p>
              <pre className="text-xs bg-gray-900 text-gray-100 rounded p-3 overflow-x-auto">{`# Listar ativos de dados
GET /api/v1/assets
Authorization: Bearer cgd_<sua_chave>

# Buscar no catálogo
GET /api/v1/assets?search=vendas&type=table

# Exportar relatório LGPD
GET /api/v1/lgpd/assets`}</pre>
              <p className="text-xs text-muted-foreground mt-2">
                Base URL: <code className="bg-gray-100 px-1 rounded">
                  {window.location.origin}/api/v1
                </code>
              </p>
            </CardContent>
          </Card>

          {apiKeys.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>Nenhuma API Key gerada.</p>
            </div>
          ) : (
            apiKeys.map((k: any) => {
              const isExpired = k.expiresAt && new Date(k.expiresAt) < new Date();
              return (
                <Card key={k.id} className={!k.active || isExpired ? "opacity-60" : ""}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Key className="h-4 w-4 text-[#1B3A8C]" />
                          <span className="font-semibold">{k.name}</span>
                          <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">cgd_{k.keyPrefix}...</code>
                          {!k.active || isExpired ? (
                            <Badge variant="secondary" className="text-xs">{isExpired ? "Expirada" : "Revogada"}</Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-800 text-xs">Ativa</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(Array.isArray(k.scopes) ? k.scopes : []).map((s: string) => (
                            <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                          ))}
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                          {k.lastUsedAt && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Último uso: {new Date(k.lastUsedAt).toLocaleDateString("pt-BR")}</span>}
                          {k.expiresAt && <span>Expira: {new Date(k.expiresAt).toLocaleDateString("pt-BR")}</span>}
                        </div>
                      </div>
                      {k.active && !isExpired && isAdmin && (
                        <Button size="sm" variant="outline" onClick={() => confirm("Revogar esta chave? Esta ação não pode ser desfeita.") && revokeKey.mutate({ id: k.id })} className="text-red-500 border-red-200 hover:bg-red-50 text-xs">
                          Revogar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      <WebhookDialog
        open={webhookDialog}
        onClose={() => { setWebhookDialog(false); setEditWebhook(null); }}
        webhook={editWebhook}
        onSaved={() => { setWebhookDialog(false); setEditWebhook(null); }}
      />
      <ApiKeyDialog
        open={apiKeyDialog}
        onClose={() => setApiKeyDialog(false)}
        newKey={null}
        onSaved={() => setApiKeyDialog(false)}
      />
    </div>
  );
}
