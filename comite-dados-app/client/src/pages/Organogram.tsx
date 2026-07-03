import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Building2, Users, GitBranch, Pencil, Trash2, FileText, AlertCircle } from "lucide-react";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
      <AlertCircle size={11} className="flex-shrink-0" />
      {message}
    </p>
  );
}

const ROLES = [
  { value: "data_owner", label: "Data Owner", color: "bg-blue-600" },
  { value: "data_steward", label: "Data Steward", color: "bg-indigo-500" },
  { value: "ai_owner", label: "AI Owner", color: "bg-purple-600" },
  { value: "ai_steward", label: "AI Steward", color: "bg-violet-500" },
  { value: "ai_ethics_officer", label: "AI Ethics Officer", color: "bg-rose-600" },
  { value: "product_owner", label: "Product Owner", color: "bg-amber-500" },
  { value: "project_manager", label: "Project Manager", color: "bg-orange-500" },
  { value: "ml_engineer", label: "ML Engineer", color: "bg-cyan-600" },
  { value: "model_manager", label: "Model Manager", color: "bg-teal-600" },
  { value: "data_engineer", label: "Data Engineer", color: "bg-sky-600" },
  { value: "facilitador", label: "Facilitador", color: "bg-green-600" },
  { value: "representante_negocio", label: "Rep. Negócio", color: "bg-pink-600" },
];

type DomainForm = { name: string; description: string; responsible: string };
const emptyDomain: DomainForm = { name: "", description: "", responsible: "" };

export default function Organogram() {
  const [showDomainForm, setShowDomainForm] = useState(false);
  const [editDomainId, setEditDomainId] = useState<number | null>(null);
  const [domainForm, setDomainForm] = useState<DomainForm>(emptyDomain);
  const [exportingDomainId, setExportingDomainId] = useState<number | null>(null);
  const [domainNameError, setDomainNameError] = useState("");
  const [isCheckingDomainName, setIsCheckingDomainName] = useState(false);
  const utils = trpc.useUtils();

  const exportOrganogramMutation = trpc.export.organogramPDF.useMutation({
    onSuccess: (data) => {
      setExportingDomainId(null);
      window.open(data.url, "_blank");
      toast.success("Organograma exportado em PDF!");
    },
    onError: (e) => { setExportingDomainId(null); toast.error("Erro ao gerar PDF: " + e.message); },
  });
  const { data: domains } = trpc.domains.list.useQuery();
  const { data: participants } = trpc.participants.list.useQuery({});

  const createDomain = trpc.domains.create.useMutation({
    onSuccess: () => { utils.domains.list.invalidate(); toast.success("Domínio criado!"); setShowDomainForm(false); setDomainForm(emptyDomain); setDomainNameError(""); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const updateDomain = trpc.domains.update.useMutation({
    onSuccess: () => { utils.domains.list.invalidate(); toast.success("Domínio atualizado!"); setShowDomainForm(false); setEditDomainId(null); setDomainForm(emptyDomain); setDomainNameError(""); },
  });
  const deleteDomain = trpc.domains.delete.useMutation({
    onSuccess: () => { utils.domains.list.invalidate(); toast.success("Domínio removido."); },
  });

  const getParticipantsByDomain = (domainId: number) =>
    (participants ?? []).filter((p) => p.domainId === domainId);

  const closeDomainForm = () => { setShowDomainForm(false); setEditDomainId(null); setDomainForm(emptyDomain); setDomainNameError(""); };

  const handleDomainSubmit = async () => {
    if (!domainForm.name.trim()) { setDomainNameError("Nome do domínio é obrigatório."); return; }
    // Check for duplicate name
    setIsCheckingDomainName(true);
    try {
      const exists = await utils.domains.checkName.fetch({
        name: domainForm.name.trim(),
        excludeId: editDomainId ?? undefined,
      });
      if (exists) {
        setDomainNameError(`Já existe um domínio com o nome "${domainForm.name.trim()}". Escolha um nome diferente.`);
        setIsCheckingDomainName(false);
        return;
      }
    } catch {
      // If check fails, proceed anyway
    }
    setIsCheckingDomainName(false);
    const payload = { name: domainForm.name.trim(), description: domainForm.description || undefined, responsible: domainForm.responsible || undefined };
    if (editDomainId) updateDomain.mutate({ id: editDomainId, ...payload });
    else createDomain.mutate(payload);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organograma</h1>
          <p className="text-sm text-gray-500 mt-0.5">Estrutura de papéis por domínio</p>
        </div>
        <Button onClick={() => setShowDomainForm(true)} className="bg-[#1B3A8C] hover:bg-[#122970] gap-2">
          <Plus size={16} /> Novo Domínio
        </Button>
      </div>

      {(domains ?? []).length === 0 ? (
        <Card className="border border-dashed border-gray-200">
          <CardContent className="py-16 text-center">
            <GitBranch size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">Nenhum domínio cadastrado</p>
            <p className="text-sm text-gray-400 mt-1">Crie domínios para organizar os participantes</p>
            <Button onClick={() => setShowDomainForm(true)} className="mt-4 bg-[#1B3A8C] hover:bg-[#122970] gap-2" size="sm">
              <Plus size={14} /> Criar Domínio
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(domains ?? []).map((domain) => {
            const domainParticipants = getParticipantsByDomain(domain.id);
            return (
              <Card key={domain.id} className="border border-gray-100 shadow-sm">
                <CardHeader className="pb-3 bg-gradient-to-r from-[#1B3A8C] to-[#2A4FA8] rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-white">{domain.name}</CardTitle>
                      {domain.responsible && <p className="text-xs text-white/70 mt-0.5">Responsável: {domain.responsible}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setExportingDomainId(domain.id); exportOrganogramMutation.mutate({ domainId: domain.id }); }}
                        disabled={exportingDomainId === domain.id}
                        title="Exportar Organograma em PDF"
                        className="p-1.5 text-white/70 hover:text-[#6DC23A] hover:bg-white/20 rounded-lg disabled:opacity-50"
                      >
                        <FileText size={13} />
                      </button>
                      <button onClick={() => {
                        setEditDomainId(domain.id);
                        setDomainForm({ name: domain.name, description: domain.description ?? "", responsible: domain.responsible ?? "" });
                        setShowDomainForm(true);
                      }} className="p-1.5 text-white/70 hover:text-white hover:bg-white/20 rounded-lg">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => { if (confirm("Remover domínio?")) deleteDomain.mutate({ id: domain.id }); }}
                        className="p-1.5 text-white/70 hover:text-red-300 hover:bg-white/20 rounded-lg">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {domain.description && <p className="text-xs text-gray-500 mb-3 italic">{domain.description}</p>}
                  <div className="flex justify-center mb-4">
                    <div className="bg-[#1B3A8C] text-white text-xs font-semibold px-4 py-2 rounded-full shadow-sm">
                      Lucid Data Governance
                    </div>
                  </div>
                  {domainParticipants.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-xs">
                      <Users size={24} className="mx-auto mb-1 opacity-30" />
                      Nenhum participante neste domínio
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {ROLES.filter((r) => domainParticipants.some((p) => p.role === r.value)).map((role) => {
                        const roleParticipants = domainParticipants.filter((p) => p.role === role.value);
                        return (
                          <div key={role.value} className="flex items-start gap-3 p-2.5 bg-gray-50 rounded-lg">
                            <div className={`${role.color} text-white text-xs font-semibold px-2 py-1 rounded-md flex-shrink-0 min-w-[100px] text-center`}>
                              {role.label}
                            </div>
                            <div className="flex-1 space-y-1">
                              {roleParticipants.map((p) => (
                                <div key={p.id} className="text-xs">
                                  <span className="font-medium text-gray-800">{p.name}</span>
                                  {p.jobTitle && <span className="text-gray-500 ml-1">— {p.jobTitle}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                    <span>{domainParticipants.length} participante(s)</span>
                    <span>{new Set(domainParticipants.map((p) => p.role)).size} papel(éis)</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showDomainForm} onOpenChange={(v) => { if (!v) closeDomainForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1B3A8C]">{editDomainId ? "Editar Domínio" : "Novo Domínio"}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1"><span className="text-red-500">*</span> Campos obrigatórios</p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className={`text-xs font-medium ${domainNameError ? "text-red-600" : ""}`}>
                Nome do Domínio <span className="text-red-500">*</span>
              </Label>
              <Input
                value={domainForm.name}
                onChange={(e) => { setDomainForm((f) => ({ ...f, name: e.target.value })); if (e.target.value.trim()) setDomainNameError(""); }}
                placeholder="Ex: Logística, RH, Financeiro..."
                className={`h-9 text-sm ${domainNameError ? "border-red-500 focus-visible:ring-red-400" : ""}`}
              />
              <FieldError message={domainNameError} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Responsável</Label>
              <Input value={domainForm.responsible} onChange={(e) => setDomainForm((f) => ({ ...f, responsible: e.target.value }))} placeholder="Nome do responsável" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Descrição</Label>
              <Textarea value={domainForm.description} onChange={(e) => setDomainForm((f) => ({ ...f, description: e.target.value }))} placeholder="Descreva o domínio..." className="text-sm resize-none" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDomainForm} size="sm">Cancelar</Button>
            <Button onClick={handleDomainSubmit} className="bg-[#1B3A8C] hover:bg-[#122970]" size="sm" disabled={createDomain.isPending || updateDomain.isPending || isCheckingDomainName}>
              {editDomainId ? "Salvar" : "Criar Domínio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
