import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, Users, Mail, Phone, Pencil, Trash2, Building2, Filter, AlertCircle } from "lucide-react";

const ROLES = [
  { value: "data_owner", label: "Data Owner" },
  { value: "data_steward", label: "Data Steward" },
  { value: "product_owner", label: "Product Owner" },
  { value: "project_manager", label: "Project Manager" },
  { value: "ai_owner", label: "AI Owner" },
  { value: "ai_steward", label: "AI Steward" },
  { value: "ai_ethics_officer", label: "AI Ethics Officer" },
  { value: "ml_engineer", label: "ML Engineer" },
  { value: "model_manager", label: "Model Manager" },
  { value: "data_engineer", label: "Data Engineer" },
  { value: "data_architect", label: "Data Architect" },
  { value: "facilitador", label: "Facilitador" },
  { value: "representante_negocio", label: "Representante de Negócio" },
  { value: "outro", label: "Outro" },
];

const ROLE_COLORS: Record<string, string> = {
  data_owner: "bg-blue-100 text-blue-800 border-blue-200",
  data_steward: "bg-indigo-100 text-indigo-800 border-indigo-200",
  product_owner: "bg-amber-100 text-amber-800 border-amber-200",
  project_manager: "bg-orange-100 text-orange-800 border-orange-200",
  ai_owner: "bg-purple-100 text-purple-800 border-purple-200",
  ai_steward: "bg-violet-100 text-violet-800 border-violet-200",
  ai_ethics_officer: "bg-rose-100 text-rose-800 border-rose-200",
  ml_engineer: "bg-cyan-100 text-cyan-800 border-cyan-200",
  model_manager: "bg-teal-100 text-teal-800 border-teal-200",
  data_engineer: "bg-sky-100 text-sky-800 border-sky-200",
  data_architect: "bg-slate-100 text-slate-800 border-slate-200",
  facilitador: "bg-green-100 text-green-800 border-green-200",
  representante_negocio: "bg-pink-100 text-pink-800 border-pink-200",
  outro: "bg-gray-100 text-gray-800 border-gray-200",
};

const STATUS_COLORS: Record<string, string> = {
  ativo: "bg-green-100 text-green-700",
  inativo: "bg-gray-100 text-gray-600",
  a_designar: "bg-amber-100 text-amber-700",
};

const STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo", inativo: "Inativo", a_designar: "A Designar",
};

type ParticipantForm = {
  name: string; email: string; jobTitle: string; department: string;
  phone: string; domainId: string; role: string; status: string; notes: string;
};

type FormErrors = {
  name?: string;
  email?: string;
  role?: string;
};

const emptyForm: ParticipantForm = {
  name: "", email: "", jobTitle: "", department: "",
  phone: "", domainId: "none", role: "data_owner", status: "ativo", notes: "",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
      <AlertCircle size={11} className="flex-shrink-0" />
      {message}
    </p>
  );
}

export default function Participants() {
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterDomain, setFilterDomain] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ParticipantForm>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});

  const utils = trpc.useUtils();
  const { data: participants, isLoading } = trpc.participants.list.useQuery({});
  const { data: domains } = trpc.domains.list.useQuery();

  const createMutation = trpc.participants.create.useMutation({
    onSuccess: () => { utils.participants.list.invalidate(); toast.success("Participante criado com sucesso!"); closeForm(); },
    onError: (e) => toast.error("Erro ao criar participante: " + e.message),
  });
  const updateMutation = trpc.participants.update.useMutation({
    onSuccess: () => { utils.participants.list.invalidate(); toast.success("Participante atualizado!"); closeForm(); },
    onError: (e) => toast.error("Erro ao atualizar: " + e.message),
  });
  const deleteMutation = trpc.participants.delete.useMutation({
    onSuccess: () => { utils.participants.list.invalidate(); toast.success("Participante removido."); },
    onError: (e) => toast.error("Erro ao remover: " + e.message),
  });

  const closeForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
    setErrors({});
  };

  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      name: p.name, email: p.email, jobTitle: p.jobTitle ?? "",
      department: p.department ?? "", phone: p.phone ?? "",
      domainId: p.domainId?.toString() ?? "none", role: p.role,
      status: p.status ?? "ativo", notes: p.notes ?? "",
    });
    setErrors({});
    setShowForm(true);
  };

  const validate = (): FormErrors => {
    const errs: FormErrors = {};
    if (!form.name.trim()) errs.name = "Nome completo é obrigatório.";
    if (!form.email.trim()) {
      errs.email = "E-mail é obrigatório.";
    } else if (!EMAIL_REGEX.test(form.email.trim())) {
      errs.email = "Informe um e-mail válido.";
    }
    if (!form.role) errs.role = "Selecione um papel para o participante.";
    return errs;
  };

  const handleFieldChange = <K extends keyof ParticipantForm>(field: K, value: ParticipantForm[K]) => {
    setForm(f => ({ ...f, [field]: value }));
    // Clear error for the field being edited
    if (field in errors) {
      setErrors(prev => { const next = { ...prev }; delete next[field as keyof FormErrors]; return next; });
    }
  };

  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    // Check for duplicate email via backend
    setIsCheckingEmail(true);
    try {
      const result = await utils.participants.checkEmail.fetch({
        email: form.email.trim(),
        excludeId: editId ?? undefined,
      });
      if (result.exists) {
        setErrors(prev => ({ ...prev, email: "Este e-mail já está cadastrado para outro participante." }));
        setIsCheckingEmail(false);
        return;
      }
    } catch {
      // If check fails, proceed anyway (non-blocking)
    }
    setIsCheckingEmail(false);
    const payload = {
      name: form.name.trim(), email: form.email.trim(),
      jobTitle: form.jobTitle || undefined, department: form.department || undefined,
      phone: form.phone || undefined,
      domainId: (form.domainId && form.domainId !== "none") ? parseInt(form.domainId) : undefined,
      role: form.role as any, status: form.status as any, notes: form.notes || undefined,
    };
    if (editId) updateMutation.mutate({ id: editId, ...payload });
    else createMutation.mutate(payload);
  };

  const filtered = (participants ?? []).filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase()) ||
      (p.jobTitle ?? "").toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "all" || p.role === filterRole;
    const matchDomain = filterDomain === "all" || p.domainId?.toString() === filterDomain;
    return matchSearch && matchRole && matchDomain;
  });

  const domainMap = Object.fromEntries((domains ?? []).map(d => [d.id, d.name]));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Participantes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestão de membros do Lucid Data Governance</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-[#1B3A8C] hover:bg-[#122970] gap-2">
          <Plus size={16} /> Novo Participante
        </Button>
      </div>

      {/* Filters */}
      <Card className="border border-gray-100 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input placeholder="Buscar por nome, e-mail ou cargo..." className="pl-9 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-full sm:w-48 h-9 text-sm">
                <Filter size={13} className="mr-1 text-gray-400" />
                <SelectValue placeholder="Papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os papéis</SelectItem>
                {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterDomain} onValueChange={setFilterDomain}>
              <SelectTrigger className="w-full sm:w-48 h-9 text-sm">
                <Building2 size={13} className="mr-1 text-gray-400" />
                <SelectValue placeholder="Domínio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os domínios</SelectItem>
                {(domains ?? []).map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: participants?.length ?? 0, color: "text-[#1B3A8C]" },
          { label: "Ativos", value: participants?.filter(p => p.status === 'ativo').length ?? 0, color: "text-green-600" },
          { label: "A Designar", value: participants?.filter(p => p.status === 'a_designar').length ?? 0, color: "text-amber-600" },
        ].map(s => (
          <Card key={s.label} className="border border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Participants Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div></div>
      ) : filtered.length === 0 ? (
        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="py-16 text-center">
            <Users size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">Nenhum participante encontrado</p>
            <p className="text-sm text-gray-400 mt-1">Adicione participantes ao Lucid Data Governance</p>
            <Button onClick={() => setShowForm(true)} className="mt-4 bg-[#1B3A8C] hover:bg-[#122970] gap-2" size="sm">
              <Plus size={14} /> Adicionar Participante
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <Card key={p.id} className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-[#1B3A8C] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {p.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{p.name}</p>
                      <p className="text-xs text-gray-500 truncate">{p.jobTitle ?? "—"}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => { if (confirm("Remover participante?")) deleteMutation.mutate({ id: p.id }); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Mail size={11} className="flex-shrink-0" />
                    <span className="truncate">{p.email}</span>
                  </div>
                  {p.phone && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Phone size={11} className="flex-shrink-0" />
                      <span>{p.phone}</span>
                    </div>
                  )}
                  {p.domainId && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Building2 size={11} className="flex-shrink-0" />
                      <span>{domainMap[p.domainId] ?? "—"}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ROLE_COLORS[p.role] ?? "bg-gray-100 text-gray-700"}`}>
                    {ROLES.find(r => r.value === p.role)?.label ?? p.role}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status ?? 'ativo']}`}>
                    {STATUS_LABELS[p.status ?? 'ativo']}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) closeForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#1B3A8C]">{editId ? "Editar Participante" : "Novo Participante"}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1"><span className="text-red-500">*</span> Campos obrigatórios</p>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">

            {/* Nome */}
            <div className="col-span-2 space-y-1">
              <Label className={`text-xs font-medium ${errors.name ? "text-red-600" : ""}`}>
                Nome completo <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={e => handleFieldChange("name", e.target.value)}
                placeholder="Nome completo"
                className={`h-9 text-sm ${errors.name ? "border-red-500 focus-visible:ring-red-400" : ""}`}
              />
              <FieldError message={errors.name} />
            </div>

            {/* E-mail */}
            <div className="col-span-2 space-y-1">
              <Label className={`text-xs font-medium ${errors.email ? "text-red-600" : ""}`}>
                E-mail <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.email}
                onChange={e => handleFieldChange("email", e.target.value)}
                placeholder="email@votorantim.com.br"
                type="email"
                className={`h-9 text-sm ${errors.email ? "border-red-500 focus-visible:ring-red-400" : ""}`}
              />
              <FieldError message={errors.email} />
            </div>

            {/* Cargo */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Cargo</Label>
              <Input value={form.jobTitle} onChange={e => handleFieldChange("jobTitle", e.target.value)} placeholder="Cargo" className="h-9 text-sm" />
            </div>

            {/* Departamento */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Departamento</Label>
              <Input value={form.department} onChange={e => handleFieldChange("department", e.target.value)} placeholder="Departamento" className="h-9 text-sm" />
            </div>

            {/* Telefone */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Telefone</Label>
              <Input value={form.phone} onChange={e => handleFieldChange("phone", e.target.value)} placeholder="+55 11 99999-9999" className="h-9 text-sm" />
            </div>

            {/* Domínio */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Domínio</Label>
              <Select value={form.domainId} onValueChange={v => handleFieldChange("domainId", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar domínio" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum domínio</SelectItem>
                  {(domains ?? []).map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Papel */}
            <div className="space-y-1">
              <Label className={`text-xs font-medium ${errors.role ? "text-red-600" : ""}`}>
                Papel <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.role}
                onValueChange={v => handleFieldChange("role", v)}
              >
                <SelectTrigger className={`h-9 text-sm ${errors.role ? "border-red-500 ring-1 ring-red-400" : ""}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldError message={errors.role} />
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Status</Label>
              <Select value={form.status} onValueChange={v => handleFieldChange("status", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="a_designar">A Designar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Observações */}
            <div className="col-span-2 space-y-1">
              <Label className="text-xs font-medium">Observações</Label>
              <Textarea value={form.notes} onChange={e => handleFieldChange("notes", e.target.value)} placeholder="Notas adicionais..." className="text-sm resize-none" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm} size="sm">Cancelar</Button>
            <Button onClick={handleSubmit} className="bg-[#1B3A8C] hover:bg-[#122970]" size="sm"
              disabled={createMutation.isPending || updateMutation.isPending || isCheckingEmail}>
              {isCheckingEmail ? "Verificando e-mail..." : editId ? "Salvar Alterações" : "Criar Participante"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
