import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { getRequiredChecklist, type GateChecklistItem } from "@shared/aiProjectGates";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { GitCommit, Plus, ArrowRight, ArrowLeft, ExternalLink, ShieldAlert, CheckCircle2, XCircle, AlertTriangle, Play, BrainCircuit, Activity, BarChart3, Database, Code, GitMerge } from "lucide-react";

const GATES = [
  { id: "G0", title: "Intake / Ideação", color: "bg-blue-50 border-blue-200" },
  { id: "G1", title: "Desenvolvimento", color: "bg-purple-50 border-purple-200" },
  { id: "G2", title: "Produção (Deploy)", color: "bg-orange-50 border-orange-200" },
  { id: "G3", title: "Monitoramento", color: "bg-green-50 border-green-200" },
] as const;

export default function AIPipeline() {
  const { data: projects = [], isLoading } = trpc.aiPipeline.list.useQuery();
  const { data: metrics } = trpc.aiPipeline.metrics.useQuery();
  
  const [showIntake, setShowIntake] = useState(false);
  const [form, setForm] = useState<{
    name: string, description: string, department: string, 
    riskLevel: "baixo" | "medio" | "alto" | "critico",
    servicenowTicket: string, azureDevopsUrl: string, termsAccepted: boolean, projectType: string
  }>({ name: "", description: "", department: "", riskLevel: "medio", servicenowTicket: "", azureDevopsUrl: "", termsAccepted: false, projectType: "IA" });
  
  const [transitionDialog, setTransitionDialog] = useState<{open: boolean, projectId: number, nextGate: string, gateTitle: string, checklists: GateChecklistItem[]}>({open: false, projectId: 0, nextGate: "", gateTitle: "", checklists: []});
  const [checklistValues, setChecklistValues] = useState<{[key: number]: boolean}>({});
  const [evidenceValues, setEvidenceValues] = useState<{[key: number]: string}>({});

  const createProject = trpc.aiPipeline.create.useMutation();
  const updateGate = trpc.aiPipeline.updateGate.useMutation();
  const updateGoNoGo = trpc.aiPipeline.updateGoNoGo.useMutation();
  const syncExternal = trpc.aiPipeline.syncExternal.useMutation();
  const utils = trpc.useUtils();

  const handleCreate = async () => {
    if (!form.name) return toast.error("Nome é obrigatório");
    if (!form.termsAccepted) return toast.error("Você deve aceitar as políticas (Aceite Digital).");
    
    try {
      await createProject.mutateAsync({
        ...form,
        termsAccepted: true
      });
      toast.success("Iniciativa criada com sucesso no G0!");
      utils.aiPipeline.list.invalidate();
      utils.aiPipeline.metrics.invalidate();
      setShowIntake(false);
      setForm({ name: "", description: "", department: "", riskLevel: "medio", servicenowTicket: "", azureDevopsUrl: "", termsAccepted: false, projectType: "IA" });
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar projeto");
    }
  };

  const attemptMove = (project: any, direction: "next" | "prev") => {
    const currentIndex = GATES.findIndex(g => g.id === project.gate);
    const nextIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= GATES.length) return;
    
    const nextGate = GATES[nextIndex];

    if (direction === "next") {
      const checklists = getRequiredChecklist(project.projectType || "IA", nextGate.id as any);
      setChecklistValues({});
      setEvidenceValues({});
      setTransitionDialog({
        open: true,
        projectId: project.id,
        nextGate: nextGate.id,
        gateTitle: nextGate.title,
        checklists
      });
      return;
    }
    const reason = window.prompt("Justificativa obrigatória para retornar o projeto ao gate anterior (mínimo 10 caracteres):");
    if (!reason || reason.trim().length < 10) return toast.error("O rollback exige uma justificativa de pelo menos 10 caracteres.");
    executeMove(project.id, nextGate.id, [], reason.trim());
  };

  const executeMove = async (id: number, gate: string, checkedItems: {itemKey: string, evidenceLink: string}[] = [], reason?: string) => {
    try {
      await updateGate.mutateAsync({ id, gate: gate as any, items: checkedItems, reason });
      toast.success(`Projeto movido para ${gate}`);
      utils.aiPipeline.list.invalidate();
      utils.aiPipeline.metrics.invalidate();
      setTransitionDialog({ open: false, projectId: 0, nextGate: "", gateTitle: "", checklists: [] });
    } catch(err: any) {
      toast.error(err.message || "Erro ao mover card");
    }
  };

  const handleGoNoGo = async (id: number, status: "go" | "no_go") => {
    const reason = window.prompt(`Justificativa obrigatória para ${status.toUpperCase()} (mínimo 10 caracteres):`);
    if (!reason || reason.trim().length < 10) return toast.error("A decisão exige uma justificativa de pelo menos 10 caracteres.");
    try {
      await updateGoNoGo.mutateAsync({ id, status, reason: reason.trim() });
      toast.success(`Business Case avaliado como ${status.toUpperCase()}`);
      utils.aiPipeline.list.invalidate();
      utils.aiPipeline.metrics.invalidate();
    } catch(err: any) {
      toast.error(err.message);
    }
  };

  const handleSyncExternal = async (id: number) => {
    try {
      const result = await syncExternal.mutateAsync({ id });
      toast.success(result.message);
      utils.aiPipeline.syncStatus.invalidate({ id });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enfileirar a sincronização.");
    }
  };

  if (isLoading) return <div className="p-6">Carregando Pipeline...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#1B3A8C] mb-2 flex items-center">
            <GitMerge className="mr-2" /> Gestão de Portfólio de Projetos (Ciclo de Vida)
          </h1>
          <p className="text-sm text-gray-500">Gestão de aprovações de Intake, ServiceNow, Go/No-Go e Azure DevOps.</p>
        </div>
        <div className="flex gap-4 items-center">
          {metrics && (
            <div className="flex bg-white shadow-sm border rounded-lg overflow-hidden text-sm mr-4">
              <div className="px-3 py-2 bg-gray-50 border-r flex items-center gap-2 font-medium">
                <Activity className="w-4 h-4 text-gray-500" /> Intake
              </div>
              <div className="px-3 py-2 border-r">Avaliados: <span className="font-bold">{metrics.evaluated}</span></div>
              <div className="px-3 py-2 border-r text-green-700">Go: <span className="font-bold">{metrics.approvedPercentage}%</span></div>
              <div className="px-3 py-2 text-red-700">No-Go: <span className="font-bold">{metrics.rejectedPercentage}%</span></div>
            </div>
          )}
          <Button onClick={() => setShowIntake(true)} className="bg-[#1B3A8C] gap-2">
            <Plus className="w-4 h-4" /> Novo Intake Formal
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {GATES.map((gate) => {
          const columnProjects = projects.filter((p: any) => p.gate === gate.id);
          return (
            <div key={gate.id} className={`p-4 rounded-xl border ${gate.color} flex flex-col gap-4 min-h-[60vh]`}>
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="font-bold text-gray-800">{gate.id}: {gate.title}</h3>
                <Badge variant="secondary">{columnProjects.length}</Badge>
              </div>
              
              {columnProjects.map((project: any) => (
                <Card key={project.id} className="shadow-sm border-gray-200">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-800">{project.name}</h3>
                      <Badge variant="outline" className={project.riskLevel === 'critico' ? 'border-red-500 text-red-700 bg-red-50' : 'border-gray-200 text-gray-600'}>
                        {project.riskLevel}
                      </Badge>
                    </div>
                    
                    <div className="mb-2">
                      <Badge className="bg-[#1B3A8C] hover:bg-[#1B3A8C] text-[10px] uppercase">{project.projectType || 'IA'}</Badge>
                    </div>

                    <p className="text-xs text-gray-500 mb-4 line-clamp-2">{project.description}</p>
                    
                    {(project.servicenowTicket || project.azureDevopsUrl) && (
                      <div className="flex gap-2 text-xs">
                        {project.servicenowTicket && (
                          <a href="#" className="flex items-center gap-1 text-blue-600 hover:underline"><ExternalLink className="w-3 h-3"/> SNOW: {project.servicenowTicket}</a>
                        )}
                        {project.azureDevopsUrl && (
                          <a href={project.azureDevopsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-purple-600 hover:underline"><ExternalLink className="w-3 h-3"/> DevOps</a>
                        )}
                      </div>
                    )}

                    <Button size="sm" variant="outline" className="w-full text-xs" disabled={syncExternal.isPending} onClick={() => handleSyncExternal(project.id)}>
                      Sincronizar com ServiceNow / Azure DevOps
                    </Button>
                    
                    {gate.id === "G0" && (
                      <div className="pt-2 border-t flex flex-col gap-2">
                        <div className="text-xs font-medium text-gray-700">Business Case (Go/No-go):</div>
                        {project.goNoGoStatus === "pending" ? (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="flex-1 border-green-200 text-green-700 hover:bg-green-50" onClick={() => handleGoNoGo(project.id, "go")}><CheckCircle2 className="w-3 h-3 mr-1" /> GO</Button>
                            <Button size="sm" variant="outline" className="flex-1 border-red-200 text-red-700 hover:bg-red-50" onClick={() => handleGoNoGo(project.id, "no_go")}><XCircle className="w-3 h-3 mr-1" /> NO-GO</Button>
                          </div>
                        ) : (
                          <div className={`text-xs px-2 py-1 rounded font-bold text-center ${project.goNoGoStatus === 'go' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {project.goNoGoStatus === 'go' ? 'APROVADO (GO)' : 'REJEITADO (NO-GO)'}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center pt-2 border-t mt-2">
                      <Button 
                        size="icon" variant="ghost" className="h-6 w-6" 
                        disabled={gate.id === "G0"}
                        onClick={() => attemptMove(project, "prev")}
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </Button>
                      <Button 
                        size="icon" variant="ghost" className="h-6 w-6"
                        disabled={gate.id === "G3"}
                        onClick={() => attemptMove(project, "next")}
                      >
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {columnProjects.length === 0 && (
                <div className="text-sm text-gray-400 text-center py-10">Nenhum projeto</div>
              )}
            </div>
          )
        })}
      </div>

      <Dialog open={showIntake} onOpenChange={setShowIntake}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo Projeto de IA (Intake ServiceNow Formal)</DialogTitle>
            <DialogDescription>Preencha os dados básicos para iniciar a governança e o fluxo de Business Case no G0.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome da Iniciativa</label>
              <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ex: Motor de Recomendação" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Projeto</label>
              <Select value={form.projectType} onValueChange={(val: any) => setForm({...form, projectType: val})}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="IA">Inteligência Artificial (IA)</SelectItem>
                  <SelectItem value="Engenharia de Dados">Engenharia de Dados</SelectItem>
                  <SelectItem value="Business Intelligence (BI)">Business Intelligence (BI)</SelectItem>
                  <SelectItem value="Automação / RPA">Automação / RPA</SelectItem>
                  <SelectItem value="App / Software">App / Software</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Descrição / Objetivo de Negócio</Label>
              <Textarea rows={2} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
            </div>
            <div>
              <Label>Departamento / Área Solicitante</Label>
              <Input value={form.department} onChange={e => setForm(f => ({...f, department: e.target.value}))} />
            </div>
            <div>
              <Label>Impacto (Risco Estimado)</Label>
              <Select value={form.riskLevel} onValueChange={v => setForm(f => ({...f, riskLevel: v as any}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixo">Baixo</SelectItem>
                  <SelectItem value="medio">Médio</SelectItem>
                  <SelectItem value="alto">Alto</SelectItem>
                  <SelectItem value="critico">Crítico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="col-span-2 border-t pt-4 mt-2 grid grid-cols-2 gap-4">
              <div>
                <Label>ServiceNow Ticket ID (Origem)</Label>
                <Input placeholder="REQ123456" value={form.servicenowTicket} onChange={e => setForm(f => ({...f, servicenowTicket: e.target.value}))} />
              </div>
              <div>
                <Label>URL do Azure DevOps (Hub Central)</Label>
                <Input placeholder="https://dev.azure.com/..." value={form.azureDevopsUrl} onChange={e => setForm(f => ({...f, azureDevopsUrl: e.target.value}))} />
              </div>
            </div>

            <div className="col-span-2 bg-gray-50 border p-3 rounded-lg flex gap-3 mt-4 items-start">
              <Checkbox 
                id="terms" 
                checked={form.termsAccepted} 
                onCheckedChange={checked => setForm(f => ({...f, termsAccepted: checked === true}))}
                className="mt-1"
              />
              <div className="space-y-1 leading-none">
                <label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Aceite Digital das Políticas de IA
                </label>
                <p className="text-xs text-gray-500">
                  Declaro que li e concordo com os Termos de Uso. Comprometo-me a utilizar 
                  apenas ferramentas homologadas (ex: Python, Copilot Studio) e seguir os ritos de 
                  segurança exigidos para o desenvolvimento deste modelo.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIntake(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createProject.isPending || !form.termsAccepted} className="bg-[#1B3A8C]">Gerar Intake (Business Case)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transitionDialog.open} onOpenChange={(val) => !val && setTransitionDialog(prev => ({...prev, open: false}))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovação de Transição: {transitionDialog.gateTitle}</DialogTitle>
            <DialogDescription>
              Para avançar de fase, é necessário confirmar que os seguintes critérios do checklist de governança foram atendidos.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {transitionDialog.checklists.map((check, idx) => (
              <div key={idx} className={`flex flex-col space-y-2 border p-3 rounded transition-colors ${checklistValues[idx] ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-start space-x-2">
                  <Checkbox 
                    id={`chk-${idx}`} 
                    checked={checklistValues[idx] || false}
                    onCheckedChange={val => setChecklistValues(prev => ({...prev, [idx]: val === true}))}
                    className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 data-[state=checked]:text-white h-5 w-5 mt-0.5"
                  />
                  <label htmlFor={`chk-${idx}`} className={`text-sm font-medium leading-tight cursor-pointer ${checklistValues[idx] ? 'text-green-800' : 'text-gray-700'}`}>
                    {check.label}
                  </label>
                </div>
                {checklistValues[idx] && (
                  <div className="pl-7 pt-1">
                    <Input 
                      placeholder="Link HTTPS obrigatório da evidência (SharePoint, Azure, Ticket SNOW...)"
                      value={evidenceValues[idx] || ""}
                      onChange={e => setEvidenceValues(prev => ({...prev, [idx]: e.target.value}))}
                      className="bg-white text-xs h-8 border-green-200 focus-visible:ring-green-500"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransitionDialog(prev => ({...prev, open: false}))}>Cancelar</Button>
            <Button 
              disabled={transitionDialog.checklists.some((_, idx) => {
                if (!checklistValues[idx]) return true;
                try { return new URL(evidenceValues[idx] || "").protocol !== "https:"; } catch { return true; }
              })}
              onClick={() => executeMove(
                transitionDialog.projectId, 
                transitionDialog.nextGate, 
                transitionDialog.checklists.map((c, i) => ({ itemKey: c.key, evidenceLink: evidenceValues[i] || "" }))
              )}
              className="bg-green-600 hover:bg-green-700"
            >
              Aprovar e Avançar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
