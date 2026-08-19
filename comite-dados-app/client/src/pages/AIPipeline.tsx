import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, ArrowRight, ArrowLeft, GitCommit } from "lucide-react";

const GATES = [
  { id: "G0", title: "Intake / Ideação", color: "bg-blue-50 border-blue-200" },
  { id: "G1", title: "Desenvolvimento", color: "bg-purple-50 border-purple-200" },
  { id: "G2", title: "Produção (Deploy)", color: "bg-orange-50 border-orange-200" },
  { id: "G3", title: "Monitoramento", color: "bg-green-50 border-green-200" }
];

export default function AIPipeline() {
  const { data: projects = [], isLoading } = trpc.aiPipeline.list.useQuery();
  const [showIntake, setShowIntake] = useState(false);
  const [form, setForm] = useState<{name: string, description: string, department: string, riskLevel: "baixo" | "medio" | "alto" | "critico"}>({ name: "", description: "", department: "", riskLevel: "medio" });
  
  const createProject = trpc.aiPipeline.create.useMutation();
  const updateGate = trpc.aiPipeline.updateGate.useMutation();
  const utils = trpc.useUtils();

  const handleCreate = async () => {
    if (!form.name) return toast.error("Nome é obrigatório");
    await createProject.mutateAsync(form);
    toast.success("Iniciativa criada com sucesso no G0!");
    utils.aiPipeline.list.invalidate();
    setShowIntake(false);
    setForm({ name: "", description: "", department: "", riskLevel: "medio" });
  };

  const handleMove = async (id: number, currentGate: string, direction: "next" | "prev") => {
    const currentIndex = GATES.findIndex(g => g.id === currentGate);
    const nextIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= GATES.length) return;
    
    // Simulação de bloqueio para aprovação Compliance
    if (currentGate === "G1" && direction === "next") {
      // Exemplo: Opcional - Exigir aprovação de compliance (mock)
      toast.info("Avaliando compliance e aprovando passagem para G2...");
    }

    await updateGate.mutateAsync({ id, gate: GATES[nextIndex].id as any });
    toast.success(`Projeto movido para ${GATES[nextIndex].id}`);
    utils.aiPipeline.list.invalidate();
  };

  if (isLoading) return <div className="p-6">Carregando Pipeline...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#1B3A8C] flex items-center gap-2">
            <GitCommit className="w-6 h-6" /> Ciclo de Vida de IA (Pipeline)
          </h1>
          <p className="text-gray-500">Gestão de aprovações (Gates) e fluxo de valor dos projetos de IA.</p>
        </div>
        <Button onClick={() => setShowIntake(true)} className="bg-[#1B3A8C] gap-2">
          <Plus className="w-4 h-4" /> Novo Intake
        </Button>
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
                    <div className="flex justify-between items-start">
                      <h4 className="font-semibold text-sm line-clamp-2">{project.name}</h4>
                      <Badge variant={project.riskLevel === 'alto' || project.riskLevel === 'critico' ? 'destructive' : 'secondary'}>
                        Risco: {project.riskLevel}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-3">{project.description}</p>
                    <div className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded inline-block">
                      Dept: {project.department || "Não informado"}
                    </div>
                    
                    <div className="flex justify-between items-center pt-2 border-t mt-2">
                      <Button 
                        size="icon" variant="ghost" className="h-6 w-6" 
                        disabled={gate.id === "G0"}
                        onClick={() => handleMove(project.id, project.gate, "prev")}
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </Button>
                      <Button 
                        size="icon" variant="ghost" className="h-6 w-6"
                        disabled={gate.id === "G3"}
                        onClick={() => handleMove(project.id, project.gate, "next")}
                      >
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {columnProjects.length === 0 && (
                <div className="text-sm text-gray-400 text-center py-10">Nenhum projeto nesta fase</div>
              )}
            </div>
          )
        })}
      </div>

      <Dialog open={showIntake} onOpenChange={setShowIntake}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Projeto de IA (Intake)</DialogTitle>
            <DialogDescription>Preencha os dados básicos para iniciar o fluxo de governança no G0.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nome do Projeto / Caso de Uso</Label>
              <Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
            </div>
            <div>
              <Label>Descrição / Objetivo</Label>
              <Textarea rows={3} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Departamento</Label>
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
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIntake(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createProject.isPending} className="bg-[#1B3A8C]">Criar Intake</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
