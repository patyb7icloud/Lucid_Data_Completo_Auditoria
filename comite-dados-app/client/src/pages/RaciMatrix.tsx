import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, AlertCircle } from "lucide-react";

type RaciValue = "R" | "A" | "C" | "I" | "-";
const RACI_COLORS: Record<string, string> = {
  R: "bg-red-100 text-red-700 border-red-200",
  A: "bg-amber-100 text-amber-700 border-amber-200",
  C: "bg-blue-100 text-blue-700 border-blue-200",
  I: "bg-green-100 text-green-700 border-green-200",
  "-": "bg-gray-100 text-gray-400 border-gray-200",
};
const RACI_LABELS: Record<string, string> = { R: "Responsável", A: "Aprovador", C: "Consultado", I: "Informado", "-": "N/A" };
const ROLES = ["dataOwner","dataSteward","productOwner","projectManager","aiOwner","aiSteward","aiEthicsOfficer","mlEngineer","modelManager"] as const;
const ROLE_LABELS: Record<string, string> = {
  dataOwner: "Data Owner", dataSteward: "Data Steward", productOwner: "Product Owner",
  projectManager: "Project Manager", aiOwner: "AI Owner", aiSteward: "AI Steward",
  aiEthicsOfficer: "AI Ethics", mlEngineer: "ML Engineer", modelManager: "Model Manager",
};

type NewItem = { activity: string; category: string } & Record<string, string>;
const emptyItem: NewItem = { activity: "", category: "", dataOwner: "-", dataSteward: "-", productOwner: "-", projectManager: "-", aiOwner: "-", aiSteward: "-", aiEthicsOfficer: "-", mlEngineer: "-", modelManager: "-" };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
      <AlertCircle size={11} className="flex-shrink-0" />
      {message}
    </p>
  );
}

export default function RaciMatrix() {
  const [showForm, setShowForm] = useState(false);
  const [newItem, setNewItem] = useState<NewItem>({ ...emptyItem });
  const [activityError, setActivityError] = useState("");

  const utils = trpc.useUtils();
  const { data: items, isLoading } = trpc.raci.list.useQuery({});

  const createMutation = trpc.raci.create.useMutation({
    onSuccess: () => {
      utils.raci.list.invalidate();
      toast.success("Atividade adicionada!");
      setShowForm(false);
      setNewItem({ ...emptyItem });
      setActivityError("");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const deleteMutation = trpc.raci.delete.useMutation({
    onSuccess: () => { utils.raci.list.invalidate(); toast.success("Removido."); },
  });

  const closeForm = () => { setShowForm(false); setNewItem({ ...emptyItem }); setActivityError(""); };

  const handleSubmit = () => {
    if (!newItem.activity.trim()) {
      setActivityError("Nome da atividade é obrigatório.");
      return;
    }
    const { activity, category, ...roles } = newItem;
    createMutation.mutate({ activity: activity.trim(), category: category || undefined, ...roles });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Matriz RACI</h1>
          <p className="text-sm text-gray-500 mt-0.5">Responsabilidades por atividade e papel</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-[#1B3A8C] hover:bg-[#122970] gap-2">
          <Plus size={16} /> Nova Atividade
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        {Object.entries(RACI_LABELS).map(([k, v]) => (
          <span key={k} className={`text-xs px-2 py-1 rounded border font-semibold ${RACI_COLORS[k]}`}>{k} = {v}</span>
        ))}
      </div>

      <Card className="border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#1B3A8C] text-white">
                <th className="text-left px-4 py-3 font-semibold min-w-[180px]">Atividade</th>
                <th className="text-left px-3 py-3 font-semibold min-w-[90px]">Categoria</th>
                {ROLES.map((r) => (
                  <th key={r} className="px-2 py-3 font-semibold text-center min-w-[72px]">{ROLE_LABELS[r]}</th>
                ))}
                <th className="px-3 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={12} className="text-center py-8 text-gray-400">Carregando...</td></tr>
              ) : (items ?? []).length === 0 ? (
                <tr><td colSpan={12} className="text-center py-8 text-gray-400">Nenhuma atividade cadastrada</td></tr>
              ) : (
                (items ?? []).map((item, i) => (
                  <tr key={item.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{item.activity}</td>
                    <td className="px-3 py-2.5 text-gray-500">{item.category ?? "—"}</td>
                    {ROLES.map((r) => {
                      const val = ((item as Record<string, unknown>)[r] as string) ?? "-";
                      return (
                        <td key={r} className="px-2 py-2.5 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded border font-bold ${RACI_COLORS[val] ?? RACI_COLORS["-"]}`}>{val}</span>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5">
                      <button onClick={() => { if (confirm("Remover?")) deleteMutation.mutate({ id: item.id }); }}
                        className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={showForm} onOpenChange={(v) => { if (!v) closeForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#1B3A8C]">Nova Atividade RACI</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1"><span className="text-red-500">*</span> Campos obrigatórios</p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              {/* Atividade — campo obrigatório */}
              <div className="space-y-1">
                <Label className={`text-xs font-medium ${activityError ? "text-red-600" : ""}`}>
                  Atividade <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={newItem.activity}
                  onChange={(e) => {
                    setNewItem(f => ({ ...f, activity: e.target.value }));
                    if (e.target.value.trim()) setActivityError("");
                  }}
                  placeholder="Nome da atividade"
                  className={`h-9 text-sm ${activityError ? "border-red-500 focus-visible:ring-red-400" : ""}`}
                />
                <FieldError message={activityError} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Categoria</Label>
                <Input value={newItem.category} onChange={(e) => setNewItem(f => ({ ...f, category: e.target.value }))} placeholder="Ex: Dados, IA, Segurança..." className="h-9 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {ROLES.map((r) => (
                <div key={r} className="space-y-1">
                  <Label className="text-xs font-medium">{ROLE_LABELS[r]}</Label>
                  <Select value={newItem[r] ?? "-"} onValueChange={(v) => setNewItem(f => ({ ...f, [r]: v }))}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["R","A","C","I","-"] as RaciValue[]).map((v) => (
                        <SelectItem key={v} value={v} className="text-xs">{v} — {RACI_LABELS[v]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm} size="sm">Cancelar</Button>
            <Button onClick={handleSubmit} className="bg-[#1B3A8C] hover:bg-[#122970]" size="sm" disabled={createMutation.isPending}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
