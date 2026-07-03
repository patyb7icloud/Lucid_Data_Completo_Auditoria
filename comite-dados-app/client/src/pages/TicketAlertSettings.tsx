import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  AlertTriangle, Bell, BellOff, Save, Settings2,
  Play, CheckCircle2, XCircle, Loader2, Mail, Ticket,
} from "lucide-react";

// Defaults globais
const GLOBAL_CRITICAL_DAYS = 3;
const GLOBAL_HIGH_DAYS = 7;

// ─── Resultado da execução manual ────────────────────────────────────────────
interface RunResult {
  totalTickets: number;
  staleTickets: number;
  emailsSent: number;
  emailsFailed: number;
  recipients: string[];
  summary: string;
}

// ─── Linha de configuração por domínio ───────────────────────────────────────
interface DomainConfigRowProps {
  domain: { id: number; name: string; color?: string | null };
  config?: {
    id: number;
    domainId: number;
    criticalDays: number | null;
    highDays: number | null;
    enabled: number | null;
  };
  onSaved: () => void;
}

function DomainConfigRow({ domain, config, onSaved, disabled }: DomainConfigRowProps & { disabled?: boolean }) {
  const [criticalDays, setCriticalDays] = useState<number>(
    config?.criticalDays ?? GLOBAL_CRITICAL_DAYS
  );
  const [highDays, setHighDays] = useState<number>(
    config?.highDays ?? GLOBAL_HIGH_DAYS
  );
  const [enabled, setEnabled] = useState<boolean>(
    config ? (config.enabled ?? 1) === 1 : true
  );
  const [isDirty, setIsDirty] = useState(false);

  const upsert = trpc.ticketAlertConfigs.upsert.useMutation({
    onSuccess: () => {
      toast.success(`Configuração de "${domain.name}" salva com sucesso.`);
      setIsDirty(false);
      onSaved();
    },
    onError: (err) => toast.error(`Erro ao salvar: ${err.message}`),
  });

  const handleSave = () => {
    if (disabled) return;
    upsert.mutate({ domainId: domain.id, criticalDays, highDays, enabled: enabled ? 1 : 0 });
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 py-4 border-b last:border-0">
      <div className="flex items-center gap-2 min-w-[180px]">
        <span
          className="inline-block w-3 h-3 rounded-full flex-shrink-0"
          style={{ background: domain.color ?? "#1B3A8C" }}
        />
        <span className="font-medium text-sm text-gray-800 truncate">{domain.name}</span>
      </div>

      <div className="flex items-center gap-2 min-w-[100px]">
        <Switch
          checked={enabled}
          disabled={disabled}
          onCheckedChange={(v) => { setEnabled(v); setIsDirty(true); }}
        />
        <span className="text-xs text-gray-500">{enabled ? "Ativo" : "Inativo"}</span>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-xs text-gray-500 whitespace-nowrap">Crítico (dias)</Label>
        <Input
          type="number"
          min={1}
          max={365}
          value={criticalDays}
          disabled={!enabled || disabled}
          onChange={(e) => { setCriticalDays(Number(e.target.value)); setIsDirty(true); }}
          className="w-20 h-8 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-xs text-gray-500 whitespace-nowrap">Alta (dias)</Label>
        <Input
          type="number"
          min={1}
          max={365}
          value={highDays}
          disabled={!enabled || disabled}
          onChange={(e) => { setHighDays(Number(e.target.value)); setIsDirty(true); }}
          className="w-20 h-8 text-sm"
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {!config && (
          <Badge variant="outline" className="text-xs text-gray-400 border-gray-200">
            Padrão global
          </Badge>
        )}
        {!disabled && (
          <Button
            size="sm"
            variant={isDirty ? "default" : "outline"}
            disabled={!isDirty || upsert.isPending}
            onClick={handleSave}
            className="h-8 gap-1"
          >
            <Save size={13} />
            {upsert.isPending ? "Salvando..." : "Salvar"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Painel de resultado da execução manual ───────────────────────────────────
function RunResultPanel({ result, onDismiss }: { result: RunResult; onDismiss: () => void }) {
  const hasErrors = result.emailsFailed > 0;
  const isSuccess = result.staleTickets === 0 || result.emailsSent > 0;

  return (
    <div className={`rounded-xl border p-4 ${hasErrors ? "bg-amber-50 border-amber-200" : isSuccess ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {hasErrors ? (
            <XCircle size={18} className="text-amber-600 flex-shrink-0" />
          ) : (
            <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
          )}
          <span className={`text-sm font-semibold ${hasErrors ? "text-amber-800" : "text-green-800"}`}>
            Execução concluída
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="text-gray-400 hover:text-gray-600 text-xs underline"
        >
          Fechar
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg p-3 border border-gray-100 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Ticket size={13} className="text-gray-400" />
            <span className="text-xs text-gray-500">Tickets elegíveis</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{result.totalTickets}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-gray-100 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <AlertTriangle size={13} className="text-amber-500" />
            <span className="text-xs text-gray-500">Tickets parados</span>
          </div>
          <p className="text-xl font-bold text-amber-600">{result.staleTickets}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-gray-100 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Mail size={13} className="text-green-500" />
            <span className="text-xs text-gray-500">E-mails enviados</span>
          </div>
          <p className="text-xl font-bold text-green-600">{result.emailsSent}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-gray-100 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <XCircle size={13} className="text-red-400" />
            <span className="text-xs text-gray-500">Falhas</span>
          </div>
          <p className="text-xl font-bold text-red-500">{result.emailsFailed}</p>
        </div>
      </div>

      {result.recipients.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-gray-600 mb-1">Destinatários notificados:</p>
          <div className="flex flex-wrap gap-1">
            {result.recipients.map((r) => (
              <Badge key={r} variant="outline" className="text-xs bg-white">
                {r}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-gray-500 italic">{result.summary}</p>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function TicketAlertSettings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: domains, isLoading: loadingDomains } = trpc.domains.list.useQuery();
  const { data: configs, refetch: refetchConfigs, isLoading: loadingConfigs } =
    trpc.ticketAlertConfigs.list.useQuery();

  const [runResult, setRunResult] = useState<RunResult | null>(null);

  const runNow = trpc.ticketAlertConfigs.runNow.useMutation({
    onSuccess: (data) => {
      setRunResult(data);
      if (data.staleTickets === 0) {
        toast.info("Nenhum ticket parado encontrado com os limiares configurados.");
      } else if (data.emailsSent > 0) {
        toast.success(`${data.emailsSent} e-mail(s) de alerta enviado(s) com sucesso.`);
      } else {
        toast.warning("Tickets parados encontrados, mas nenhum e-mail foi enviado (sem responsável cadastrado).");
      }
    },
    onError: (err) => toast.error(`Erro ao executar: ${err.message}`),
  });

  type ConfigItem = NonNullable<typeof configs>[number];
  const configByDomain = (configs ?? []).reduce<Record<number, ConfigItem>>(
    (acc, c) => { acc[c.domainId] = c; return acc; },
    {}
  );

  const isLoading = loadingDomains || loadingConfigs;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-[#1B3A8C]/10 rounded-xl">
            <Settings2 size={22} className="text-[#1B3A8C]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Configuração de Alertas de Tickets</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Defina o intervalo (em dias) sem atualização que dispara o alerta de tickets parados para cada domínio.
            </p>
          </div>
        </div>

        {/* Botão Executar agora — apenas admins */}
        {isAdmin && (
          <Button
            onClick={() => { setRunResult(null); runNow.mutate(); }}
            disabled={runNow.isPending}
            className="flex-shrink-0 gap-2 bg-[#1B3A8C] hover:bg-[#0F2460] text-white"
          >
            {runNow.isPending ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Executando...
              </>
            ) : (
              <>
                <Play size={15} />
                Executar agora
              </>
            )}
          </Button>
        )}
      </div>

      {/* Resultado da execução manual */}
      {runResult && (
        <RunResultPanel result={runResult} onDismiss={() => setRunResult(null)} />
      )}

      {/* Info box */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <p className="font-semibold mb-1">Como funciona</p>
          <p>
            Tickets de prioridade <strong>Crítica</strong> ou <strong>Alta</strong> que estejam com status{" "}
            <em>Novo</em> ou <em>Em andamento</em> e não tenham sido atualizados dentro do prazo configurado
            receberão o indicador <strong>⚠ Parado</strong> na tela ServiceNow e acionarão o e-mail de alerta
            diário ao responsável.
          </p>
          <p className="mt-1 text-amber-600">
            Domínios sem configuração específica utilizam os padrões globais:{" "}
            <strong>{GLOBAL_CRITICAL_DAYS} dias</strong> para crítico e{" "}
            <strong>{GLOBAL_HIGH_DAYS} dias</strong> para alta.
          </p>
          {isAdmin && (
            <p className="mt-1 font-medium text-amber-700">
              O botão <strong>Executar agora</strong> dispara o job imediatamente, enviando os e-mails de alerta
              conforme as configurações atuais — útil para validar as regras antes do ciclo diário.
            </p>
          )}
        </div>
      </div>

      <Separator />

      {/* Global defaults card */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Bell size={15} className="text-[#1B3A8C]" />
            Padrões Globais
          </CardTitle>
          <CardDescription className="text-xs">
            Aplicados a domínios sem configuração específica.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
              <span className="text-sm text-gray-600">Crítico:</span>
              <span className="font-semibold text-sm text-gray-900">{GLOBAL_CRITICAL_DAYS} dias</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-sm text-gray-600">Alta:</span>
              <span className="font-semibold text-sm text-gray-900">{GLOBAL_HIGH_DAYS} dias</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-domain config */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Settings2 size={15} className="text-[#1B3A8C]" />
            Configuração por Domínio
          </CardTitle>
          <CardDescription className="text-xs">
            Personalize os limiares de alerta para cada domínio individualmente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : !domains || domains.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <BellOff size={32} className="mb-2" />
              <p className="text-sm">Nenhum domínio cadastrado.</p>
            </div>
          ) : (
            <div>
              <div className="hidden sm:flex gap-4 pb-2 mb-1 border-b text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <span className="min-w-[180px]">Domínio</span>
                <span className="min-w-[100px]">Notificações</span>
                <span className="w-[120px]">Crítico (dias)</span>
                <span className="w-[110px]">Alta (dias)</span>
                <span className="ml-auto">Ação</span>
              </div>
              {domains.map((domain) => (
                <DomainConfigRow
                  key={domain.id}
                  domain={domain}
                  config={configByDomain[domain.id]}
                  onSaved={refetchConfigs}                  disabled={!isAdmin}                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Configuração de SMTP — apenas admins */}

      {isAdmin && (
        <SmtpSettings />
      )}
    </div>
  );
}

// ─── Componente de Configuração de SMTP ──────────────────────────────────────────
function SmtpSettings() {
  const { data: settings, refetch, isLoading } = trpc.settings.list.useQuery();
  
  const setSetting = trpc.settings.set.useMutation({
    onSuccess: () => toast.success("Configuração salva com sucesso."),
    onError: (err) => toast.error(`Erro ao salvar: ${err.message}`),
  });

  const verifySmtp = trpc.notifications.verifySmtp.useQuery(undefined, {
    enabled: false,
    retry: false,
  });

  const [localSettings, setLocalSettings] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Inicializa o estado local quando os dados chegam
  useState(() => {
    if (settings) {
      const initial: Record<string, string> = {};
      settings.forEach(s => { initial[s.key] = s.value || ""; });
      setLocalSettings(initial);
    }
  });

  // Sincroniza se os settings mudarem externamente
  const handleUpdateLocal = (key: string, value: string) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    const keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_SECURE", "SMTP_FROM_NAME", "SMTP_FROM_EMAIL"];
    for (const key of keys) {
      if (localSettings[key] !== undefined) {
        await setSetting.mutateAsync({ key, value: localSettings[key] });
      }
    }
    setIsDirty(false);
    refetch();
  };

  const handleTestConnection = async () => {
    toast.promise(verifySmtp.refetch(), {
      loading: "Testando conexão SMTP...",
      success: (res) => {
        if (res.data?.ok) return "Conexão SMTP estabelecida com sucesso!";
        throw new Error(res.data?.message || "Falha na conexão SMTP.");
      },
      error: (err) => err.message,
    });
  };

  const getVal = (key: string) => localSettings[key] ?? settings?.find(s => s.key === key)?.value ?? "";

  return (
    <Card className="border border-gray-100 shadow-lg overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-[#1B3A8C] to-[#2D3748] text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Mail size={20} className="text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Configurações de E-mail (SMTP)</CardTitle>
              <CardDescription className="text-white/70 text-xs">
                Defina as credenciais para o disparo de comunicados e alertas do sistema.
              </CardDescription>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleTestConnection}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-8 gap-2"
          >
            <Play size={13} />
            Testar Conexão
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#1B3A8C]" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Servidor e Porta */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                  <Settings2 size={14} /> Servidor de Saída
                </h3>
                <div className="space-y-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="smtp_host" className="text-xs text-gray-500">Host SMTP</Label>
                    <Input 
                      id="smtp_host" 
                      placeholder="ex: smtp.office365.com" 
                      value={getVal("SMTP_HOST")}
                      onChange={(e) => handleUpdateLocal("SMTP_HOST", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-1.5">
                      <Label htmlFor="smtp_port" className="text-xs text-gray-500">Porta</Label>
                      <Input 
                        id="smtp_port" 
                        placeholder="587" 
                        value={getVal("SMTP_PORT")}
                        onChange={(e) => handleUpdateLocal("SMTP_PORT", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="smtp_secure" className="text-xs text-gray-500">Segurança (SSL/TLS)</Label>
                      <div className="flex items-center h-10 gap-2 px-3 border rounded-md">
                        <Switch 
                          id="smtp_secure" 
                          checked={getVal("SMTP_SECURE") === "true"}
                          onCheckedChange={(v) => handleUpdateLocal("SMTP_SECURE", String(v))}
                        />
                        <span className="text-xs text-gray-500">{getVal("SMTP_SECURE") === "true" ? "Ativo" : "Inativo"}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        Use <b>Ativo</b> apenas para porta 465. Para porta 587, deixe <b>Inativo</b> (STARTTLS).
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Autenticação */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                  <CheckCircle2 size={14} /> Autenticação
                </h3>
                <div className="space-y-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="smtp_user" className="text-xs text-gray-500">Usuário / E-mail</Label>
                    <Input 
                      id="smtp_user" 
                      placeholder="usuario@votorantim.com" 
                      value={getVal("SMTP_USER")}
                      onChange={(e) => handleUpdateLocal("SMTP_USER", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="smtp_pass" className="text-xs text-gray-500">Senha</Label>
                    <Input 
                      id="smtp_pass" 
                      type="password" 
                      placeholder="••••••••" 
                      value={getVal("SMTP_PASS")}
                      onChange={(e) => handleUpdateLocal("SMTP_PASS", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Identidade visual */}
              <div className="space-y-4 md:col-span-2">
                <Separator />
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                  <Badge className="bg-[#6DC23A] hover:bg-[#6DC23A]">Remetente</Badge> Identidade do E-mail
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="grid gap-1.5">
                    <Label htmlFor="from_name" className="text-xs text-gray-500">Nome de Exibição</Label>
                    <Input 
                      id="from_name" 
                      placeholder="Lucid Data Governance" 
                      value={getVal("SMTP_FROM_NAME")}
                      onChange={(e) => handleUpdateLocal("SMTP_FROM_NAME", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="from_email" className="text-xs text-gray-500">E-mail de Resposta (Reply-to)</Label>
                    <Input 
                      id="from_email" 
                      placeholder="comite.dados@votorantim.com" 
                      value={getVal("SMTP_FROM_EMAIL")}
                      onChange={(e) => handleUpdateLocal("SMTP_FROM_EMAIL", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button 
                disabled={!isDirty || setSetting.isPending} 
                onClick={handleSave}
                className="bg-[#1B3A8C] hover:bg-[#0F2460] text-white px-8 gap-2"
              >
                {setSetting.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Salvar Configurações
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

