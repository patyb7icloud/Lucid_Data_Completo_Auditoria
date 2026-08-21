import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Bot, ShieldAlert, Zap, Plus, ArrowRight, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, Server, Brain } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function AgentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const createMut = trpc.aiGovernance.createAgent.useMutation({
    onSuccess: () => {
      utils.aiGovernance.listAgents.invalidate();
      toast.success("Agente registrado com sucesso.");
      onClose();
    }
  });

  const { data: dbxModels = [], isLoading: isLoadingModels } = trpc.aiGovernance.getAvailableDatabricksModels.useQuery(undefined, { enabled: open });

  const [form, setForm] = useState({ name: "", description: "", model: "", endpointUrl: "", assetType: "agent" });

  const handleModelSelect = (selectedName: string) => {
    const model = dbxModels.find((m: any) => m.name === selectedName);
    if (model) {
      setForm({
        name: model.name,
        description: model.description || "",
        model: model.model || "",
        endpointUrl: model.endpointUrl || "",
        assetType: model.assetType || "agent"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar Novo Agente de IA</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Buscar Agente do Databricks</Label>
            <Select value={form.name} onValueChange={handleModelSelect}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingModels ? "Carregando Databricks..." : "Selecione um agente integrado"} />
              </SelectTrigger>
              <SelectContent>
                {dbxModels.map((m: any) => (
                  <SelectItem key={m.name} value={m.name}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="O que este agente faz?" />
          </div>
          <div className="space-y-2">
            <Label>Tipo de Ativo</Label>
            <Select value={form.assetType} onValueChange={v => setForm({ ...form, assetType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="agent">Agente de IA (GenAI)</SelectItem>
                <SelectItem value="model">Modelo Tradicional (ML)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Modelo Base/Framework</Label>
              <Input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="ex: gpt-4, xgboost" />
            </div>
            <div className="space-y-2">
              <Label>Endpoint (Databricks/OpenAI)</Label>
              <Input value={form.endpointUrl} onChange={e => setForm({ ...form, endpointUrl: e.target.value })} placeholder="https://..." />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.name || !form.model} className="bg-[#1B3A8C] hover:bg-[#1B3A8C]/90">
            {createMut.isPending ? "Salvando..." : "Salvar Ativo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AiGovernance() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  
  const { data: agents = [], isLoading: isLoadingAgents } = trpc.aiGovernance.listAgents.useQuery();
  const { data: status } = trpc.aiGovernance.getIntegrationStatus.useQuery();
  const utils = trpc.useUtils();

  const syncMut = trpc.aiGovernance.syncDatabricks.useMutation({
    onSuccess: (data) => {
      utils.aiGovernance.listAgents.invalidate();
      if (status?.isSimulated) {
        toast.info("Modo Simulação: Agentes importados com sucesso.");
      } else {
        toast.success(`Integração: ${data.count} agentes importados do Databricks.`);
      }
    }
  });
  
  const { data: assessments = [] } = trpc.aiGovernance.getAgentAssessments.useQuery(
    { agentId: selectedAgentId! },
    { enabled: !!selectedAgentId }
  );

  const runAuditMut = trpc.aiGovernance.runAudit.useMutation({
    onSuccess: () => {
      utils.aiGovernance.getAgentAssessments.invalidate();
    }
  });

  const selectedAssessment = assessments[0]; // latest
  const { data: gaps = [] } = trpc.aiGovernance.getAssessmentGaps.useQuery(
    { assessmentId: selectedAssessment?.id! },
    { enabled: !!selectedAssessment?.id }
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 rounded-xl">
            <Bot className="h-7 w-7 text-indigo-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Governança de IA (AI TRiSM & MRM)</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              Inventário, Auditoria de LLMOps e Segurança de Modelos Clássicos
              {status && (
                <Badge variant="outline" className={status.isSimulated ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-green-50 text-green-600 border-green-200"}>
                  <Server className="w-3 h-3 mr-1" />
                  {status.isSimulated ? "Databricks (Simulado)" : "Databricks Integrado"}
                </Badge>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => syncMut.mutate()} 
            disabled={syncMut.isPending}
            variant="outline" 
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMut.isPending ? 'animate-spin' : ''}`} />
            Sincronizar (MLflow)
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4 mr-2" />
            Registrar Ativo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Agents List */}
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                Inventário de Modelos e Agentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-250px)] pr-4">
                <div className="space-y-3">
                  {isLoadingAgents ? (
                    <div className="text-center py-4 text-slate-500">Carregando inventário...</div>
                  ) : agents.length === 0 ? (
                    <div className="text-center py-4 text-slate-500 text-sm">Nenhum ativo registrado. Sincronize ou adicione manualmente.</div>
                  ) : (
                    agents.map((agent: any) => (
                      <Card 
                        key={agent.id} 
                        className={`cursor-pointer transition-colors hover:border-indigo-300 ${selectedAgentId === agent.id ? 'border-indigo-500 bg-indigo-50/50' : ''}`}
                        onClick={() => setSelectedAgentId(agent.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-slate-800">{agent.name}</h3>
                            <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                              {agent.status}
                            </Badge>
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                            {agent.assetType === 'model' ? (
                              <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200">
                                <Brain className="w-3 h-3 mr-1" /> Modelo
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-purple-600 bg-purple-50 border-purple-200">
                                <Bot className="w-3 h-3 mr-1" /> Agente
                              </Badge>
                            )}
                            <span>{agent.model}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Assessment Details */}
        <div className="md:col-span-2">
          {selectedAgentId ? (
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        Painel de Auditoria 
                      </CardTitle>
                      <CardDescription>Varredura de segurança e conformidade do Agente</CardDescription>
                    </div>
                    <Button 
                      onClick={() => runAuditMut.mutate({ agentId: selectedAgentId })} 
                      disabled={runAuditMut.isPending}
                      variant="outline" 
                      className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      {runAuditMut.isPending ? "Analisando..." : "Rodar Varredura"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  {assessments.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <ShieldCheck className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                      <p>Nenhuma auditoria realizada ainda.</p>
                      <p className="text-sm">Clique em "Rodar Varredura" para avaliar este agente.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 border">
                        <div className={`p-3 rounded-full ${selectedAssessment?.riskLevel === 'critical' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                          {selectedAssessment?.riskLevel === 'critical' ? <ShieldAlert className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Última Varredura: {new Date(selectedAssessment?.runDate).toLocaleString()}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <h3 className="font-bold text-lg text-slate-800">Risco: <span className="uppercase">{selectedAssessment?.riskLevel}</span></h3>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium text-sm text-slate-700 mb-3 flex items-center gap-2">
                          Gaps Encontrados ({gaps.length})
                        </h4>
                        <div className="space-y-3">
                          {gaps.length === 0 ? (
                            <div className="p-4 border border-green-200 bg-green-50 rounded-lg flex items-center gap-3 text-green-700 text-sm">
                              <CheckCircle2 className="h-5 w-5" />
                              Nenhum risco detectado. O agente está em conformidade.
                            </div>
                          ) : (
                            gaps.map((gap: any) => (
                              <div key={gap.id} className="p-4 border rounded-lg bg-white shadow-sm flex gap-4">
                                <div className="mt-1">
                                  {gap.severity === 'critical' ? (
                                    <AlertTriangle className="h-5 w-5 text-red-500" />
                                  ) : (
                                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className="text-xs bg-slate-100">{gap.category}</Badge>
                                    <Badge className={`text-[10px] ${gap.severity === 'critical' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                                      {gap.severity.toUpperCase()}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-slate-700">{gap.description}</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl p-12 text-center text-muted-foreground">
              <div>
                <Bot className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="font-medium text-slate-700">Selecione um Agente</h3>
                <p className="text-sm mt-1">Escolha um agente ao lado para visualizar os detalhes e auditorias.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <AgentDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
