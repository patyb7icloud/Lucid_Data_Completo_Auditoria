import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Bell, Mail, Send, CheckCircle2, XCircle, Clock,
  RefreshCw, AlertTriangle, Users, Wifi, WifiOff
} from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  enviado: { label: "Enviado", color: "bg-green-100 text-green-800", icon: <CheckCircle2 className="w-3 h-3" /> },
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800", icon: <Clock className="w-3 h-3" /> },
  falhou: { label: "Falhou", color: "bg-red-100 text-red-800", icon: <XCircle className="w-3 h-3" /> },
  cancelado: { label: "Cancelado", color: "bg-gray-100 text-gray-700", icon: <XCircle className="w-3 h-3" /> },
};

const TYPE_LABELS: Record<string, string> = {
  meeting_invite: "Convite de Reunião",
  meeting_reminder: "Lembrete de Reunião",
  meeting_cancelled: "Cancelamento",
  decision_registered: "Decisão Registrada",
  meeting_summary: "Resumo de Reunião",
  domain_update: "Atualização de Domínio",
  custom: "Comunicado",
};

export default function Notifications() {
  const [customSubject, setCustomSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [customEmails, setCustomEmails] = useState("");

  const { data: notifications, isLoading, refetch } = trpc.notifications.list.useQuery({ limit: 100, offset: 0 });
  const { data: smtpData } = trpc.notifications.verifySmtp.useQuery();
  const smtpStatus = smtpData?.ok ?? false;

  const sendCustom = trpc.notifications.sendCustomEmail.useMutation({
    onSuccess: (data) => {
      toast.success(`E-mail enviado para ${data.sent} destinatário(s)!`);
      setCustomSubject("");
      setCustomMessage("");
      setCustomEmails("");
      refetch();
    },
    onError: (err) => toast.error(`Erro ao enviar: ${err.message}`),
  });

  const handleSendCustom = () => {
    const emails = customEmails.split(",").map((e) => e.trim()).filter(Boolean);
    if (!emails.length) return toast.error("Informe ao menos um e-mail destinatário.");
    if (!customSubject.trim()) return toast.error("Informe o assunto do e-mail.");
    if (!customMessage.trim()) return toast.error("Informe o conteúdo do e-mail.");
    sendCustom.mutate({ recipientEmails: emails, subject: customSubject, message: customMessage });
  };

  const stats = {
    total: notifications?.length ?? 0,
    enviado: notifications?.filter((n) => n.status === "enviado").length ?? 0,
    pendente: notifications?.filter((n) => n.status === "pendente").length ?? 0,
    falhou: notifications?.filter((n) => n.status === "falhou").length ?? 0,
  };

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-vc-blue">Notificações por E-mail</h1>
            <p className="text-gray-500 text-sm mt-1">Gerencie e monitore os envios de e-mail do Lucid Data Governance</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${smtpStatus ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
              {smtpStatus ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {smtpData ? (smtpStatus ? "SMTP Conectado" : "SMTP Desconectado") : "Verificando SMTP..."}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Enviados", value: stats.total, icon: <Mail className="w-5 h-5 text-vc-blue" />, color: "text-vc-blue" },
            { label: "Entregues", value: stats.enviado, icon: <CheckCircle2 className="w-5 h-5 text-green-600" />, color: "text-green-600" },
            { label: "Pendentes", value: stats.pendente, icon: <Clock className="w-5 h-5 text-yellow-600" />, color: "text-yellow-600" },
            { label: "Falhas", value: stats.falhou, icon: <AlertTriangle className="w-5 h-5 text-red-600" />, color: "text-red-600" },
          ].map((s) => (
            <Card key={s.label} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{s.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                  </div>
                  <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">{s.icon}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="historico">
          <TabsList className="bg-gray-100">
            <TabsTrigger value="historico" className="data-[state=active]:bg-vc-blue data-[state=active]:text-white">
              <Bell className="w-4 h-4 mr-2" /> Histórico
            </TabsTrigger>
            <TabsTrigger value="comunicado" className="data-[state=active]:bg-vc-blue data-[state=active]:text-white">
              <Send className="w-4 h-4 mr-2" /> Enviar Comunicado
            </TabsTrigger>
          </TabsList>

          {/* Histórico */}
          <TabsContent value="historico">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-vc-blue flex items-center gap-2">
                  <Bell className="w-4 h-4" /> Histórico de Notificações
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-gray-400">Carregando...</div>
                ) : !notifications?.length ? (
                  <div className="text-center py-12">
                    <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">Nenhuma notificação enviada ainda</p>
                    <p className="text-gray-400 text-sm mt-1">Os e-mails enviados aparecerão aqui</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {notifications.map((n) => {
                      const s = STATUS_LABELS[n.status ?? "pendente"] ?? STATUS_LABELS.pendente;
                      return (
                        <div key={n.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 bg-vc-blue/10 rounded-full flex items-center justify-center flex-shrink-0">
                              <Mail className="w-4 h-4 text-vc-blue" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-gray-800 truncate">{n.subject}</p>
                              <p className="text-xs text-gray-500 truncate">{n.recipientEmail}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                            <span className="text-xs text-gray-400 hidden md:block">
                              {TYPE_LABELS[n.type ?? "custom"] ?? n.type}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
                              {s.icon} {s.label}
                            </span>
                            <span className="text-xs text-gray-400 hidden lg:block">
                              {n.createdAt ? new Date(n.createdAt).toLocaleString("pt-BR") : "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Enviar Comunicado */}
          <TabsContent value="comunicado">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-vc-blue flex items-center gap-2">
                  <Send className="w-4 h-4" /> Enviar Comunicado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Destinatários</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <Input
                      placeholder="email1@vc.com, email2@vc.com (separados por vírgula)"
                      value={customEmails}
                      onChange={(e) => setCustomEmails(e.target.value)}
                      className="border-gray-200"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Assunto</Label>
                  <Input
                    placeholder="Assunto do e-mail"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    className="mt-1 border-gray-200"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Mensagem</Label>
                  <Textarea
                    placeholder="Escreva o conteúdo do comunicado..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={6}
                    className="mt-1 border-gray-200 resize-none"
                  />
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="text-xs text-blue-700">
                    <strong>Nota:</strong> O e-mail será enviado com o template oficial da Lucid Data Governance, incluindo cabeçalho, rodapé e identidade visual da empresa.
                  </p>
                </div>
                <Button
                  className="bg-vc-blue hover:bg-vc-blue/90 text-white w-full"
                  onClick={handleSendCustom}
                  disabled={sendCustom.isPending}
                >
                  {sendCustom.isPending ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" /> Enviar Comunicado</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    </div>
  );
}
