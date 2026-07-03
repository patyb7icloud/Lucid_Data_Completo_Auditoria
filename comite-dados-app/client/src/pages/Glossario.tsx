import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  BookOpen, Search, Plus, Pencil, Trash2, CheckCircle2,
  Tag, Folder, Clock, User, X, ChevronDown, ChevronUp, Wand2, Loader2,
} from "lucide-react";

// ─── Tipos ───────────────────────────────────────────────────────────────────
type GlossaryStatus = "rascunho" | "em_revisao" | "aprovado" | "obsoleto";

const statusConfig: Record<GlossaryStatus, { label: string; className: string }> = {
  rascunho:   { label: "Rascunho",    className: "bg-gray-100 text-gray-700" },
  em_revisao: { label: "Em Revisão",  className: "bg-yellow-100 text-yellow-800" },
  aprovado:   { label: "Aprovado",    className: "bg-green-100 text-green-800" },
  obsoleto:   { label: "Obsoleto",    className: "bg-red-100 text-red-700" },
};

// ─── Formulário (Criar / Editar) ─────────────────────────────────────────────
const EMPTY_FORM = {
  term: "",
  definition: "",
  abbreviation: "",
  category: "",
  synonyms: "",
  examples: "",
  notes: "",
  status: "rascunho" as GlossaryStatus,
  domainId: undefined as number | undefined,
  ownerId: undefined as number | undefined,
};

type TermForm = typeof EMPTY_FORM & { id?: number };

function TermDialog({
  open,
  onClose,
  initialData,
  categories,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initialData?: TermForm;
  categories: string[];
  onSaved: () => void;
}) {
  const isEdit = !!initialData?.id;
  const [form, setForm] = useState<TermForm>(initialData ?? EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const utils = trpc.useUtils();
  const createMut = trpc.glossary.create.useMutation();
  const updateMut = trpc.glossary.update.useMutation();

  const set = (key: keyof TermForm, val: string) =>
    setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.term.trim() || !form.definition.trim()) {
      toast.error("Termo e definição são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && initialData?.id) {
        await updateMut.mutateAsync({ id: initialData.id, ...form });
        toast.success("Termo atualizado.");
      } else {
        await createMut.mutateAsync(form as any);
        toast.success("Termo criado.");
      }
      utils.glossary.list.invalidate();
      utils.glossary.categories.invalidate();
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            {isEdit ? "Editar Termo" : "Novo Termo do Glossário"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label>Termo *</Label>
              <Input
                value={form.term}
                onChange={e => set("term", e.target.value)}
                placeholder="Ex: Dado Mestre"
              />
            </div>
            <div>
              <Label>Sigla / Abreviação</Label>
              <Input
                value={form.abbreviation}
                onChange={e => set("abbreviation", e.target.value)}
                placeholder="Ex: MDM"
              />
            </div>
          </div>

          <div>
            <Label>Definição *</Label>
            <Textarea
              value={form.definition}
              onChange={e => set("definition", e.target.value)}
              rows={4}
              placeholder="Definição clara e objetiva do termo de negócio..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Categoria</Label>
              <Input
                value={form.category}
                onChange={e => set("category", e.target.value)}
                list="categories-list"
                placeholder="Ex: Governança de Dados"
              />
              <datalist id="categories-list">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="em_revisao">Em Revisão</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="obsoleto">Obsoleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Sinônimos</Label>
            <Input
              value={form.synonyms}
              onChange={e => set("synonyms", e.target.value)}
              placeholder="Ex: dado principal, registro mestre (separados por vírgula)"
            />
          </div>

          <div>
            <Label>Exemplos de uso</Label>
            <Textarea
              value={form.examples}
              onChange={e => set("examples", e.target.value)}
              rows={2}
              placeholder="Exemplos práticos de aplicação deste termo..."
            />
          </div>

          <div>
            <Label>Notas adicionais</Label>
            <Textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              rows={2}
              placeholder="Observações, referências, links úteis..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar termo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Card de Termo ────────────────────────────────────────────────────────────
function TermCard({
  term,
  canEdit,
  onEdit,
  onDelete,
  onApprove,
}: {
  term: any;
  canEdit: boolean;
  onEdit: (t: any) => void;
  onDelete: (id: number) => void;
  onApprove: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = statusConfig[(term.status as GlossaryStatus) ?? "rascunho"];

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base font-semibold text-gray-900">
              {term.term}
            </CardTitle>
            {term.abbreviation && (
              <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                {term.abbreviation}
              </span>
            )}
            <Badge className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>
          </div>
          {canEdit && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {term.status !== "aprovado" && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-green-600" onClick={() => onApprove(term.id)}>
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onEdit(term)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500" onClick={() => onDelete(term.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        {term.category && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Folder className="h-3 w-3" />
            {term.category}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <p className={`text-sm text-gray-700 leading-relaxed ${!expanded && "line-clamp-3"}`}>
          {term.definition}
        </p>
        {(term.synonyms || term.examples || term.notes || term.approvedBy) && (
          <>
            <button
              onClick={() => setExpanded(e => !e)}
              className="mt-2 text-xs text-blue-600 flex items-center gap-1 hover:underline"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Menos detalhes" : "Mais detalhes"}
            </button>
            {expanded && (
              <div className="mt-3 space-y-2 text-sm">
                {term.synonyms && (
                  <div>
                    <span className="font-medium text-gray-600">Sinônimos:</span>{" "}
                    <span className="text-gray-700">{term.synonyms}</span>
                  </div>
                )}
                {term.examples && (
                  <div>
                    <span className="font-medium text-gray-600">Exemplos:</span>
                    <p className="text-gray-700 mt-0.5">{term.examples}</p>
                  </div>
                )}
                {term.notes && (
                  <div>
                    <span className="font-medium text-gray-600">Notas:</span>
                    <p className="text-gray-700 mt-0.5">{term.notes}</p>
                  </div>
                )}
                {term.approvedBy && (
                  <div className="flex items-center gap-1 text-xs text-green-700 mt-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Aprovado por {term.approvedBy}
                    {term.approvedAt && (
                      <span className="text-gray-500">
                        {" "}em {new Date(term.approvedAt).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                )}
                {term.createdByName && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <User className="h-3 w-3" />
                    Criado por {term.createdByName}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Glossario() {
  const { user } = useAuth();
  const canEdit = ["admin", "data_owner", "data_steward"].includes(user?.role ?? "");

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterCategory, setFilterCategory] = useState<string>("todas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<TermForm | undefined>(undefined);
  const [isAiFeeding, setIsAiFeeding] = useState(false);
  const [aiAssetId, setAiAssetId] = useState<number | ''>('');

  const { data: terms = [], refetch } = trpc.glossary.list.useQuery({
    status: filterStatus !== "todos" ? filterStatus : undefined,
    category: filterCategory !== "todas" ? filterCategory : undefined,
  });

  const { data: categories = [] } = trpc.glossary.categories.useQuery();
  const utils = trpc.useUtils();
  const approveMut = trpc.glossary.approve.useMutation();
  const deleteMut = trpc.glossary.delete.useMutation();
  const pushGlossaryMut = trpc.governance.pushToGlossaryWithLLM.useMutation();
  const { data: allAssets } = trpc.governance.listAssets.useQuery({});

  const handleAiFeeding = async () => {
    if (!aiAssetId) { toast.error('Selecione um ativo para extrair termos.'); return; }
    setIsAiFeeding(true);
    try {
      const res = await pushGlossaryMut.mutateAsync({ assetId: Number(aiAssetId) });
      toast.success(`${res.created} termos criados no Glossário! (${res.skipped} ignorados)`);
      utils.glossary.list.invalidate();
    } catch (err: any) {
      toast.error(`Erro: ${err?.message ?? err}`);
    } finally {
      setIsAiFeeding(false);
    }
  };

  const filteredTerms = useMemo(() => {
    if (!search.trim()) return terms;
    const q = search.toLowerCase();
    return terms.filter(
      t =>
        t.term?.toLowerCase().includes(q) ||
        t.definition?.toLowerCase().includes(q) ||
        t.abbreviation?.toLowerCase().includes(q) ||
        t.synonyms?.toLowerCase().includes(q)
    );
  }, [terms, search]);

  // Agrupa por letra inicial
  const grouped = useMemo(() => {
    const map: Record<string, typeof filteredTerms> = {};
    filteredTerms.forEach(t => {
      const letter = (t.term?.[0] ?? "#").toUpperCase();
      if (!map[letter]) map[letter] = [];
      map[letter].push(t);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredTerms]);

  const handleEdit = (term: any) => {
    setEditingTerm({ ...term, id: term.id });
    setDialogOpen(true);
  };

  const handleNewTerm = () => {
    setEditingTerm(undefined);
    setDialogOpen(true);
  };

  const handleApprove = async (id: number) => {
    try {
      await approveMut.mutateAsync({ id });
      toast.success("Termo aprovado.");
      utils.glossary.list.invalidate();
    } catch {
      toast.error("Erro ao aprovar.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remover este termo do glossário?")) return;
    try {
      await deleteMut.mutateAsync({ id });
      toast.success("Termo removido.");
      utils.glossary.list.invalidate();
    } catch {
      toast.error("Erro ao remover.");
    }
  };

  const counts = useMemo(() => ({
    total: terms.length,
    aprovado: terms.filter(t => t.status === "aprovado").length,
    em_revisao: terms.filter(t => t.status === "em_revisao").length,
    rascunho: terms.filter(t => t.status === "rascunho").length,
  }), [terms]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-blue-600" />
            Glossário de Negócios
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Vocabulário oficial de termos, conceitos e definições de dados da organização
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Select value={String(aiAssetId)} onValueChange={v => setAiAssetId(v === '' ? '' : Number(v))}>
              <SelectTrigger className="w-48 h-9 text-xs">
                <SelectValue placeholder="Selecionar ativo..." />
              </SelectTrigger>
              <SelectContent>
                {(allAssets ?? []).map((a: any) => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50"
              onClick={handleAiFeeding}
              disabled={isAiFeeding || !aiAssetId}
              title="Extrai termos de negócio via IA a partir das colunas do ativo selecionado"
            >
              {isAiFeeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              Alimentar com IA
            </Button>
            <Button onClick={handleNewTerm} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Novo Termo
            </Button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: counts.total, color: "text-gray-700" },
          { label: "Aprovados", value: counts.aprovado, color: "text-green-700" },
          { label: "Em Revisão", value: counts.em_revisao, color: "text-yellow-700" },
          { label: "Rascunhos", value: counts.rascunho, color: "text-gray-500" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="text-center py-3">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Buscar termos, definições, sinônimos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}>
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="em_revisao">Em Revisão</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="obsoleto">Obsoleto</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {categories.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Conteúdo */}
      {filteredTerms.length === 0 ? (
        <Card className="py-16 text-center text-gray-500">
          <BookOpen className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Nenhum termo encontrado</p>
          {canEdit && (
            <Button variant="outline" className="mt-4" onClick={handleNewTerm}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar primeiro termo
            </Button>
          )}
        </Card>
      ) : (
        <Tabs defaultValue="alfabetico">
          <TabsList className="mb-4">
            <TabsTrigger value="alfabetico">Ordem Alfabética</TabsTrigger>
            <TabsTrigger value="grade">Grade</TabsTrigger>
          </TabsList>

          <TabsContent value="alfabetico" className="space-y-6">
            {grouped.map(([letter, group]) => (
              <div key={letter}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl font-bold text-blue-600 w-8">{letter}</span>
                  <Separator className="flex-1" />
                  <span className="text-xs text-gray-400">{group.length}</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {group.map(t => (
                    <TermCard
                      key={t.id}
                      term={t}
                      canEdit={canEdit}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onApprove={handleApprove}
                    />
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="grade">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTerms.map(t => (
                <TermCard
                  key={t.id}
                  term={t}
                  canEdit={canEdit}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onApprove={handleApprove}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Dialog */}
      <TermDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingTerm(undefined); }}
        initialData={editingTerm}
        categories={categories}
        onSaved={() => refetch()}
      />
    </div>
  );
}
