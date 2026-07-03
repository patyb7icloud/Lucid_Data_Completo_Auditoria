import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ClipboardCheck, User, Calendar, Database, Shield, Tag, Building2, AlertTriangle, Clock, Mail, FileText, CheckCircle2, XCircle } from "lucide-react";

const statusLabels: Record<string, { label: string; color: string }> = {
  pendente_owner: { label: "Aguardando Owner", color: "bg-yellow-100 text-yellow-800" },
  pendente_steward: { label: "Aguardando Steward", color: "bg-blue-100 text-blue-800" },
  aprovado: { label: "Aprovado", color: "bg-green-100 text-green-800" },
  rejeitado_owner: { label: "Rejeitado pelo Owner", color: "bg-red-100 text-red-800" },
  rejeitado_steward: { label: "Rejeitado pelo Steward", color: "bg-red-100 text-red-800" },
};

const nivelLabels: Record<string, string> = {
  leitura: "Leitura",
  leitura_escrita: "Leitura e Escrita",
};

const baseLegalLabels: Record<string, string> = {
  legitimo_interesse: "Legítimo Interesse",
  execucao_contrato: "Execução de Contrato",
};

const sensitivityLabels: Record<string, { label: string; color: string }> = {
  publico: { label: "Público", color: "bg-gray-100 text-gray-600" },
  interno: { label: "Interno", color: "bg-blue-100 text-blue-700" },
  confidencial: { label: "Confidencial", color: "bg-orange-100 text-orange-700" },
  restrito: { label: "Restrito", color: "bg-red-100 text-red-700" },
};

const criticalityLabels: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "bg-gray-100 text-gray-600" },
  media: { label: "Média", color: "bg-yellow-100 text-yellow-700" },
  alta: { label: "Alta", color: "bg-orange-100 text-orange-700" },
  critica: { label: "Crítica", color: "bg-red-100 text-red-700" },
};

const priorityLabels: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "bg-gray-100 text-gray-600" },
  media: { label: "Média", color: "bg-yellow-100 text-yellow-700" },
  alta: { label: "Alta", color: "bg-red-100 text-red-700" },
};

type ActionDialog = {
  id: number;
  action: "approveOwner" | "rejectOwner" | "approveSteward" | "rejectSteward";
  label: string;
  requireComment: boolean;
};

export default function AprovacoesFila() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [dialog, setDialog] = useState<ActionDialog | null>(null);
  const [comment, setComment] = useState("");

  const ownerQueue = trpc.accessRequests.list.useQuery(
    { status: "pendente_owner", ownerId: user?.id },
    { enabled: !!user?.id }
  );
  const stewardQueue = trpc.accessRequests.list.useQuery(
    { status: "pendente_steward", stewardId: user?.id },
    { enabled: !!user?.id }
  );
  const history = trpc.accessRequests.list.useQuery(
    { requesterId: user?.id },
    { enabled: !!user?.id }
  );

  const approveOwner = trpc.accessRequests.approveOwner.useMutation({ onSuccess: refresh });
  const rejectOwner = trpc.accessRequests.rejectOwner.useMutation({ onSuccess: refresh });
  const approveSteward = trpc.accessRequests.approveSteward.useMutation({ onSuccess: refresh });
  const rejectSteward = trpc.accessRequests.rejectSteward.useMutation({ onSuccess: refresh });

  function refresh() {
    toast.success("Ação registrada com sucesso!");
    setDialog(null);
    setComment("");
    utils.accessRequests.list.invalidate();
  }

  function handleConfirm() {
    if (!dialog) return;
    if (dialog.requireComment && !comment.trim()) {
      toast.error("O motivo é obrigatório para rejeição.");
      return;
    }
    const args = { id: dialog.id, comment: comment.trim() };
    if (dialog.action === "approveOwner") approveOwner.mutate(args);
    else if (dialog.action === "rejectOwner") rejectOwner.mutate(args);
    else if (dialog.action === "approveSteward") approveSteward.mutate(args);
    else if (dialog.action === "rejectSteward") rejectSteward.mutate(args);
  }

  function openDialog(id: number, action: ActionDialog["action"], label: string, requireComment = false) {
    setComment("");
    setDialog({ id, action, label, requireComment });
  }

  function RequestCard({ req, showOwnerActions, showStewardActions }: {
    req: any;
    showOwnerActions?: boolean;
    showStewardActions?: boolean;
  }) {
    const st = statusLabels[req.status] ?? { label: req.status, color: "bg-gray-100 text-gray-700" };
    const sensitivity = sensitivityLabels[req.assetSensitivity] ?? { label: req.assetSensitivity ?? "—", color: "bg-gray-100 text-gray-600" };
    const criticality = criticalityLabels[req.assetCriticality] ?? null;
    const priority = priorityLabels[req.priority] ?? null;

    return (
      <Card className="mb-4 border border-gray-200 shadow-sm">
        {/* Cabeçalho */}
        <CardHeader className="pb-3 border-b border-gray-100">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-gray-400">{req.ticketNumber}</span>
                {priority && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priority.color}`}>
                    Prioridade: {priority.label}
                  </span>
                )}
              </div>
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Database size={18} className="text-blue-600" />
                {req.assetName ?? `Ativo #${req.assetId}`}
              </CardTitle>
              {req.assetType && (
                <p className="text-xs text-gray-400 mt-0.5 uppercase tracking-wide">{req.assetType}{req.assetSourceSystem ? ` · ${req.assetSourceSystem}` : ""}{req.assetBusinessArea ? ` · ${req.assetBusinessArea}` : ""}</p>
              )}
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${st.color}`}>{st.label}</span>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4 text-sm">
          {/* Classificação do ativo */}
          <div className="flex flex-wrap gap-2">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${sensitivity.color}`}>
              <Shield size={11} className="inline mr-1" />{sensitivity.label}
            </span>
            {criticality && (
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${criticality.color}`}>
                <AlertTriangle size={11} className="inline mr-1" />Criticidade: {criticality.label}
              </span>
            )}
            <span className="text-xs px-2 py-1 rounded-full font-medium bg-indigo-50 text-indigo-700">
              <Shield size={11} className="inline mr-1" />{nivelLabels[req.nivelAcesso] ?? req.nivelAcesso}
            </span>
          </div>

          {/* Solicitante */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Solicitante</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-700">
              <span className="flex items-center gap-1"><User size={13} /> {req.requesterName ?? "—"}</span>
              {req.requesterEmail && <span className="flex items-center gap-1 text-gray-500"><Mail size={13} /> {req.requesterEmail}</span>}
              <span className="flex items-center gap-1 text-gray-400"><Calendar size={13} /> {new Date(req.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</span>
            </div>
          </div>

          {/* Dados da solicitação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-gray-700">
            <div>
              <span className="font-medium text-gray-500">Papel/Grupo solicitado:</span>
              <p className="mt-0.5 flex items-center gap-1"><Tag size={13} className="text-gray-400" /> {req.papelGrupo ?? "—"}</p>
            </div>
            <div>
              <span className="font-medium text-gray-500">Base legal:</span>
              <p className="mt-0.5">{baseLegalLabels[req.baseLegal] ?? req.baseLegal}</p>
            </div>
            {req.prazoNecessidade && (
              <div>
                <span className="font-medium text-gray-500">Prazo de necessidade:</span>
                <p className="mt-0.5 flex items-center gap-1"><Clock size={13} className="text-gray-400" /> {req.prazoNecessidade}</p>
              </div>
            )}
            {req.envolveTerceiros && (
              <div>
                <span className="font-medium text-gray-500">Terceiros:</span>
                <p className="mt-0.5 text-orange-600 font-medium">⚠ Envolve terceiros</p>
              </div>
            )}
          </div>

          <div>
            <span className="font-medium text-gray-500">Finalidade:</span>
            <p className="mt-1 text-gray-700 leading-relaxed"><FileText size={13} className="inline mr-1 text-gray-400" />{req.finalidade}</p>
          </div>

          {/* Decisões anteriores (histórico de aprovação parcial) */}
          {(req.ownerComment || req.stewardComment) && (
            <div className="border-t border-gray-100 pt-3 space-y-2">
              {req.ownerComment && (
                <div className="flex items-start gap-2 text-xs text-gray-600">
                  {req.statusOwner === "aprovado" ? <CheckCircle2 size={14} className="text-green-500 mt-0.5 shrink-0" /> : <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />}
                  <span><strong>Owner:</strong> {req.ownerComment}</span>
                </div>
              )}
              {req.stewardComment && (
                <div className="flex items-start gap-2 text-xs text-gray-600">
                  {req.statusSteward === "aprovado" ? <CheckCircle2 size={14} className="text-green-500 mt-0.5 shrink-0" /> : <XCircle size={14} className="text-red-500 mt-0.5 shrink-0" />}
                  <span><strong>Steward:</strong> {req.stewardComment}</span>
                </div>
              )}
            </div>
          )}

          {/* Ações */}
          {(showOwnerActions || showStewardActions) && (
            <div className="flex gap-2 pt-1 border-t border-gray-100">
              {showOwnerActions && (
                <>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => openDialog(req.id, "approveOwner", "Aprovar como Data Owner")}>Aprovar</Button>
                  <Button size="sm" variant="destructive" onClick={() => openDialog(req.id, "rejectOwner", "Rejeitar como Data Owner", true)}>Rejeitar</Button>
                </>
              )}
              {showStewardActions && (
                <>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => openDialog(req.id, "approveSteward", "Aprovar como Data Steward")}>Aprovar</Button>
                  <Button size="sm" variant="destructive" onClick={() => openDialog(req.id, "rejectSteward", "Rejeitar como Data Steward", true)}>Rejeitar</Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <ClipboardCheck size={28} className="text-blue-700" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fila de Aprovações</h1>
          <p className="text-sm text-gray-500">Gerencie solicitações de acesso a dados pendentes de aprovação</p>
        </div>
      </div>

      <Tabs defaultValue="owner">
        <TabsList className="mb-4">
          <TabsTrigger value="owner">
            Pendentes (Owner)
            {(ownerQueue.data?.length ?? 0) > 0 && (
              <Badge className="ml-2 bg-yellow-500 text-white">{ownerQueue.data!.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="steward">
            Pendentes (Steward)
            {(stewardQueue.data?.length ?? 0) > 0 && (
              <Badge className="ml-2 bg-blue-500 text-white">{stewardQueue.data!.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="historico">Minhas Solicitações</TabsTrigger>
        </TabsList>

        <TabsContent value="owner">
          {ownerQueue.isLoading && <p className="text-gray-500">Carregando...</p>}
          {!ownerQueue.isLoading && (!ownerQueue.data || ownerQueue.data.length === 0) && (
            <p className="text-gray-500 text-sm">Nenhuma solicitação pendente para você como Data Owner.</p>
          )}
          {ownerQueue.data?.map((req: any) => (
            <RequestCard key={req.id} req={req} showOwnerActions />
          ))}
        </TabsContent>

        <TabsContent value="steward">
          {stewardQueue.isLoading && <p className="text-gray-500">Carregando...</p>}
          {!stewardQueue.isLoading && (!stewardQueue.data || stewardQueue.data.length === 0) && (
            <p className="text-gray-500 text-sm">Nenhuma solicitação pendente para você como Data Steward.</p>
          )}
          {stewardQueue.data?.map((req: any) => (
            <RequestCard key={req.id} req={req} showStewardActions />
          ))}
        </TabsContent>

        <TabsContent value="historico">
          {history.isLoading && <p className="text-gray-500">Carregando...</p>}
          {!history.isLoading && (!history.data || history.data.length === 0) && (
            <p className="text-gray-500 text-sm">Você ainda não fez solicitações de acesso.</p>
          )}
          {history.data?.map((req: any) => (
            <RequestCard key={req.id} req={req} />
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!dialog} onOpenChange={open => { if (!open) setDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder={dialog?.requireComment ? "Motivo da rejeição (obrigatório)..." : "Comentário opcional..."}
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={handleConfirm} className="bg-blue-700 hover:bg-blue-800 text-white">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
