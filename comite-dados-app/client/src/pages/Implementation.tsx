import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle, Circle, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

const STATUS_COLORS: Record<string, string> = {
  planejado: "bg-gray-100 text-gray-600",
  em_andamento: "bg-blue-100 text-blue-700",
  concluido: "bg-green-100 text-green-700",
  pausado: "bg-amber-100 text-amber-700",
};

export default function Implementation() {
  const { user } = useAuth();
  const [expandedDomain, setExpandedDomain] = useState<number | null>(null);
  const [showAddItem, setShowAddItem] = useState<number | null>(null);
  const [newItem, setNewItem] = useState({ phase: "", title: "", description: "" });
  const utils = trpc.useUtils();
  const { data: domains } = trpc.domains.list.useQuery();

  const addItem = trpc.implementation.addItem.useMutation({
    onSuccess: () => {
      utils.implementation.checklist.invalidate();
      toast.success("Item adicionado!");
      setShowAddItem(null);
      setNewItem({ phase: "", title: "", description: "" });
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Implantação por Domínio</h1>
        <p className="text-sm text-gray-500 mt-0.5">Acompanhe o progresso de implantação do Lucid Data Governance</p>
      </div>

      {(domains ?? []).length === 0 ? (
        <Card className="border border-dashed border-gray-200">
          <CardContent className="py-16 text-center text-gray-400 text-sm">
            Nenhum domínio cadastrado. Acesse Organograma para criar domínios.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {(domains ?? []).map((domain) => (
            <DomainCard
              key={domain.id}
              domain={domain}
              expanded={expandedDomain === domain.id}
              onToggle={() => setExpandedDomain(expandedDomain === domain.id ? null : domain.id)}
              onAddItem={() => setShowAddItem(domain.id)}
              userName={user?.name ?? ""}
            />
          ))}
        </div>
      )}

      <Dialog open={showAddItem !== null} onOpenChange={(v) => { if (!v) setShowAddItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1B3A8C]">Adicionar Item ao Checklist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Fase *</Label>
              <Input value={newItem.phase} onChange={(e) => setNewItem(f => ({ ...f, phase: e.target.value }))} placeholder="Ex: Fase 1 - Planejamento" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Título *</Label>
              <Input value={newItem.title} onChange={(e) => setNewItem(f => ({ ...f, title: e.target.value }))} placeholder="Título do item" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Descrição</Label>
              <Input value={newItem.description} onChange={(e) => setNewItem(f => ({ ...f, description: e.target.value }))} placeholder="Descrição opcional" className="h-9 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItem(null)} size="sm">Cancelar</Button>
            <Button onClick={() => {
              if (!newItem.phase || !newItem.title) { toast.error("Fase e título obrigatórios"); return; }
              addItem.mutate({ domainId: showAddItem!, phase: newItem.phase, title: newItem.title, description: newItem.description || undefined });
            }} className="bg-[#1B3A8C] hover:bg-[#122970]" size="sm" disabled={addItem.isPending}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DomainCard({ domain, expanded, onToggle, onAddItem, userName }: {
  domain: any; expanded: boolean; onToggle: () => void; onAddItem: () => void; userName: string;
}) {
  const utils = trpc.useUtils();
  const { data: checklist } = trpc.implementation.checklist.useQuery({ domainId: domain.id });
  const toggleItem = trpc.implementation.toggleItem.useMutation({
    onSuccess: () => utils.implementation.checklist.invalidate(),
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const updateProgress = trpc.implementation.updateProgress.useMutation({
    onSuccess: () => utils.domains.list.invalidate(),
  });

  const completed = (checklist ?? []).filter((i) => i.completed).length;
  const total = (checklist ?? []).length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : (domain.implementationProgress ?? 0);
  const phases = Array.from(new Set((checklist ?? []).map((i: any) => i.phase as string)));

  const handleToggle = (id: number, newCompleted: boolean) => {
    toggleItem.mutate({ id, completed: newCompleted, completedBy: userName || undefined });
    const newDone = (checklist ?? []).filter((i: any) => i.completed !== (i.id === id) ? i.completed : newCompleted).length;
    if (total > 0) updateProgress.mutate({ domainId: domain.id, progress: Math.round((newDone / total) * 100) });
  };

  return (
    <Card className="border border-gray-100 shadow-sm">
      <CardHeader className="pb-3 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {expanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
            <div>
              <CardTitle className="text-base font-semibold text-gray-800">{domain.name}</CardTitle>
              <p className="text-xs text-gray-400 mt-0.5">{completed}/{total} itens concluídos</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={`text-xs ${STATUS_COLORS[domain.status ?? "planejado"]}`}>{domain.status ?? "planejado"}</Badge>
            <span className="text-lg font-bold text-[#1B3A8C]">{progress}%</span>
          </div>
        </div>
        <Progress value={progress} className="h-2 mt-2" />
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {phases.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Nenhum item no checklist</p>
          ) : (
            phases.map((phase) => (
              <div key={String(phase)}>
                <p className="text-xs font-semibold text-[#1B3A8C] uppercase tracking-wide mb-2">{String(phase)}</p>
                <div className="space-y-1.5">
                  {(checklist ?? []).filter((i: any) => i.phase === phase).map((item: any) => (
                    <div key={item.id} className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleToggle(item.id, !item.completed)}>
                      {item.completed ? (
                        <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Circle size={16} className="text-gray-300 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className={`text-sm ${item.completed ? "line-through text-gray-400" : "text-gray-700"}`}>{item.title}</p>
                        {item.description && <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>}
                        {item.completed && item.completedBy && (
                          <p className="text-xs text-green-500 mt-0.5">✓ {item.completedBy}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
          <Button onClick={(e) => { e.stopPropagation(); onAddItem(); }} variant="outline" size="sm" className="gap-1 text-xs border-dashed">
            <Plus size={12} /> Adicionar Item
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
