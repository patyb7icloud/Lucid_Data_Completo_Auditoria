import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText as FileContract,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  ChevronRight,
  Users,
  Calendar,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

type ContractStatus = "rascunho" | "em_revisao" | "ativo" | "expirado" | "cancelado";

const statusConfig: Record<ContractStatus, { label: string; icon: React.ElementType; className: string }> = {
  rascunho: { label: "Rascunho", icon: FileText, className: "bg-gray-100 text-gray-700 border-gray-200" },
  em_revisao: { label: "Em revisão", icon: Clock, className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  ativo: { label: "Ativo", icon: CheckCircle2, className: "bg-green-100 text-green-700 border-green-200" },
  expirado: { label: "Expirado", icon: AlertCircle, className: "bg-red-100 text-red-700 border-red-200" },
  cancelado: { label: "Cancelado", icon: XCircle, className: "bg-gray-100 text-gray-500 border-gray-200" },
};

const slaOptions = ["bronze", "silver", "gold", "platinum"];
const frequencyOptions = ["tempo_real", "horario", "diario", "semanal", "mensal", "sob_demanda"];
const frequencyLabels: Record<string, string> = {
  tempo_real: "Tempo real",
  horario: "Horário",
  diario: "Diário",
  semanal: "Semanal",
  mensal: "Mensal",
  sob_demanda: "Sob demanda",
};

interface ContractFormData {
  assetId: number | null;
  name: string;
  producerTeam: string;
  consumerTeam: string;
  description: string;
  slaLevel: string;
  deliveryFrequency: string;
  version: string;
  status: ContractStatus;
  changeNotes: string;
  expiresAt: string;
}

const defaultForm: ContractFormData = {
  assetId: null,
  name: "",
  producerTeam: "",
  consumerTeam: "",
  description: "",
  slaLevel: "silver",
  deliveryFrequency: "diario",
  version: "1.0.0",
  status: "rascunho",
  changeNotes: "",
  expiresAt: "",
};

export default function DataContracts() {
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const requestedAssetId = Number(searchParams.get("assetId") || "0") || null;
  const shouldOpenCreateFromUrl = searchParams.get("create") === "1";
  const autoOpenKey = shouldOpenCreateFromUrl ? `${requestedAssetId ?? 0}:create` : null;

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ContractFormData>(defaultForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [lastAutoOpenKey, setLastAutoOpenKey] = useState<string | null>(null);

  const { data: contracts = [], refetch } = trpc.dataContracts.list.useQuery({});
  const { data: assets = [] } = trpc.governance.listAssets.useQuery({ limit: 500 });

  const assetById = useMemo(() => {
    const map = new Map<number, string>();
    for (const asset of assets) map.set(asset.id, asset.name);
    return map;
  }, [assets]);

  useEffect(() => {
    if (!requestedAssetId || editingId) return;
    const hasAsset = assets.some((asset) => asset.id === requestedAssetId);
    if (!hasAsset) return;

    setForm((prev) => (prev.assetId ? prev : { ...prev, assetId: requestedAssetId }));

    if (autoOpenKey && lastAutoOpenKey !== autoOpenKey && !dialogOpen) {
      setDialogOpen(true);
      setLastAutoOpenKey(autoOpenKey);

      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (params.has("create")) {
          params.delete("create");
          const nextSearch = params.toString();
          const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
          window.history.replaceState(window.history.state, "", nextUrl);
        }
      }
    }
  }, [requestedAssetId, assets, editingId, dialogOpen, autoOpenKey, lastAutoOpenKey]);

  const createContract = trpc.dataContracts.create.useMutation({
    onSuccess: () => {
      toast.success("Contrato criado", { description: "O data contract foi criado com sucesso." });
      setDialogOpen(false);
      setForm(defaultForm);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateContract = trpc.dataContracts.update.useMutation({
    onSuccess: () => {
      toast.success("Contrato atualizado", { description: "As alterações foram salvas." });
      setDialogOpen(false);
      setEditingId(null);
      setForm(defaultForm);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteContract = trpc.dataContracts.delete.useMutation({
    onSuccess: () => {
      toast.success("Contrato excluído");
      setDeleteConfirmId(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const activateContract = trpc.dataContracts.update.useMutation({
    onSuccess: () => {
      toast.success("Contrato ativado", { description: "O contrato foi ativado com sucesso." });
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  function clearContractContextFromUrl() {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const hadContext = params.has("assetId") || params.has("assetName") || params.has("create");
    if (!hadContext) return;

    params.delete("assetId");
    params.delete("assetName");
    params.delete("create");

    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      setEditingId(null);
      setForm(defaultForm);
      clearContractContextFromUrl();
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...defaultForm, assetId: requestedAssetId ?? null });
    setDialogOpen(true);
  }

  function openEdit(contract: (typeof contracts)[0]) {
    setEditingId(contract.id);
    setForm({
      assetId: contract.assetId ?? null,
      name: contract.name ?? "",
      producerTeam: contract.producerTeam ?? "",
      consumerTeam: contract.consumerTeam ?? "",
      description: contract.description ?? "",
      slaLevel: contract.slaLevel ?? "silver",
      deliveryFrequency: contract.deliveryFrequency ?? "diario",
      version: contract.version ?? "1.0.0",
      status: (contract.status as ContractStatus) ?? "rascunho",
      changeNotes: contract.changeNotes ?? "",
      expiresAt: contract.expiresAt ? new Date(contract.expiresAt).toISOString().split("T")[0] : "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.assetId) {
      toast.error("Selecione o ativo relacionado ao contrato.");
      return;
    }

    const payload = {
      ...form,
      assetId: form.assetId as number, // already guarded: we return early if null
      expiresAt: form.expiresAt || null,
    };
    if (editingId) {
      updateContract.mutate({ id: editingId, ...payload });
    } else {
      createContract.mutate(payload);
    }
  }

  const filtered = contracts.filter((c) => {
    const matchSearch =
      !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.producerTeam?.toLowerCase().includes(search.toLowerCase()) ||
      c.consumerTeam?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusCounts = contracts.reduce<Record<string, number>>((acc, c) => {
    const s = c.status ?? "rascunho";
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileContract className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Contracts</h1>
            <p className="text-sm text-gray-500">Acordos formais de entrega e qualidade de dados entre produtores e consumidores</p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Contrato
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(Object.entries(statusConfig) as [ContractStatus, typeof statusConfig[ContractStatus]][]).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <Card key={key} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}>
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-2xl font-bold">{statusCounts[key] ?? 0}</p>
                  <p className="text-xs text-gray-500">{cfg.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar contratos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FileContract className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum contrato encontrado</p>
          <p className="text-sm mt-1">Crie o primeiro data contract para começar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((contract) => {
            const status = (contract.status ?? "rascunho") as ContractStatus;
            const cfg = statusConfig[status];
            const Icon = cfg.icon;
            return (
              <motion.div
                key={contract.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 truncate">{contract.name}</h3>
                          <Badge variant="outline" className={`text-xs shrink-0 ${cfg.className}`}>
                            <Icon className="h-3 w-3 mr-1" />
                            {cfg.label}
                          </Badge>
                          <span className="text-xs text-gray-400 shrink-0">v{contract.version}</span>
                        </div>

                        {contract.description && (
                          <p className="text-sm text-gray-500 mb-2 line-clamp-1">{contract.description}</p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                          {contract.assetId && (
                            <span className="flex items-center gap-1">
                              <FileContract className="h-3 w-3" />
                              Ativo: <strong>{assetById.get(contract.assetId) ?? `#${contract.assetId}`}</strong>
                            </span>
                          )}
                          {contract.producerTeam && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              Producer: <strong>{contract.producerTeam}</strong>
                            </span>
                          )}
                          {contract.consumerTeam && (
                            <span className="flex items-center gap-1">
                              <ChevronRight className="h-3 w-3" />
                              Consumer: <strong>{contract.consumerTeam}</strong>
                            </span>
                          )}
                          {contract.slaLevel && (
                            <span className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              SLA: <strong className="uppercase">{contract.slaLevel}</strong>
                            </span>
                          )}
                          {contract.deliveryFrequency && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {frequencyLabels[contract.deliveryFrequency] ?? contract.deliveryFrequency}
                            </span>
                          )}
                          {contract.expiresAt && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Expira: {new Date(contract.expiresAt).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {status === "em_revisao" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => activateContract.mutate({ id: contract.id, status: "ativo" })}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Ativar
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => openEdit(contract)}>
                          <Edit2 className="h-4 w-4 text-gray-400" />
                        </Button>
                        {isAdmin && (
                          <Button size="icon" variant="ghost" onClick={() => setDeleteConfirmId(contract.id)}>
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Data Contract" : "Novo Data Contract"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Ativo de Dados *</Label>
              <Select
                value={form.assetId ? String(form.assetId) : ""}
                onValueChange={(v) => setForm(f => ({ ...f, assetId: Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um ativo" />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((asset) => (
                    <SelectItem key={asset.id} value={String(asset.id)}>{asset.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Contrato de Vendas → Analytics" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Time Produtor</Label>
                <Input value={form.producerTeam} onChange={(e) => setForm(f => ({ ...f, producerTeam: e.target.value }))} placeholder="Ex: Time de Vendas" />
              </div>
              <div className="space-y-1">
                <Label>Time Consumidor</Label>
                <Input value={form.consumerTeam} onChange={(e) => setForm(f => ({ ...f, consumerTeam: e.target.value }))} placeholder="Ex: Analytics" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Descreva o propósito e escopo do contrato..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>SLA</Label>
                <Select value={form.slaLevel} onValueChange={(v) => setForm(f => ({ ...f, slaLevel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {slaOptions.map(o => <SelectItem key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Frequência de Entrega</Label>
                <Select value={form.deliveryFrequency} onValueChange={(v) => setForm(f => ({ ...f, deliveryFrequency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {frequencyOptions.map(o => <SelectItem key={o} value={o}>{frequencyLabels[o]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Versão</Label>
                <Input value={form.version} onChange={(e) => setForm(f => ({ ...f, version: e.target.value }))} placeholder="1.0.0" />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v as ContractStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Data de Expiração</Label>
              <Input type="date" value={form.expiresAt} onChange={(e) => setForm(f => ({ ...f, expiresAt: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Notas de alteração</Label>
              <Textarea value={form.changeNotes} onChange={(e) => setForm(f => ({ ...f, changeNotes: e.target.value }))} rows={2} placeholder="Descreva o que mudou nesta versão..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.name || !form.assetId || createContract.isPending || updateContract.isPending}
            >
              {editingId ? "Salvar alterações" : "Criar contrato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir contrato?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">Esta ação não pode ser desfeita. O contrato será excluído permanentemente.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteContract.mutate({ id: deleteConfirmId })}
              disabled={deleteContract.isPending}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
