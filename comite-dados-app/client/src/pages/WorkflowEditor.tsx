/**
 * WorkflowEditor.tsx
 * Editor visual de fluxos de aprovação usando ReactFlow.
 * Rota: /workflow
 *
 * Funcionalidades:
 *  - Listar, criar e editar definições de workflow
 *  - Canvas interativo de steps (nós) com ReactFlow
 *  - Painel de tarefas pendentes do usuário logado
 *  - Trigger manual de fluxo em um ativo
 */
import { useState, useCallback } from "react";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
} from "reactflow";
import "reactflow/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Play, Trash2, CheckCircle2, XCircle, ClockIcon, Users, Bell,
  GitMerge, ListChecks, ChevronRight, Pencil, Save, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useBrand } from "@/contexts/BrandContext";

// ─── Tipos de step ────────────────────────────────────────────────────────────
type StepType = "approval" | "parallel_approval" | "notification";

interface WorkflowStep {
  id: string;
  type: StepType;
  label: string;
  approvers?: string[];
  parallelAll?: boolean;
  notifyEmails?: string[];
}

// ─── Nó customizado do ReactFlow ──────────────────────────────────────────────
const STEP_ICONS: Record<StepType, React.ReactNode> = {
  approval: <CheckCircle2 size={14} />,
  parallel_approval: <Users size={14} />,
  notification: <Bell size={14} />,
};
const STEP_COLORS: Record<StepType, string> = {
  approval: "#3B82F6",
  parallel_approval: "#8B5CF6",
  notification: "#F59E0B",
};

function StepNode({ data }: { data: WorkflowStep & { selected?: boolean } }) {
  const color = STEP_COLORS[data.type] ?? "#6B7280";
  return (
    <div
      className="bg-white border-2 rounded-xl shadow-md px-4 py-3 min-w-[160px]"
      style={{ borderColor: color }}
    >
      <Handle type="target" position={Position.Left} style={{ background: color }} />
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color }}>{STEP_ICONS[data.type]}</span>
        <span className="text-xs font-semibold text-gray-700">{data.label}</span>
      </div>
      <div className="text-xs text-gray-400">
        {data.type === "approval" && "Aprovação simples"}
        {data.type === "parallel_approval" && `Paralelo (${data.approvers?.length ?? 0} aprovadores)`}
        {data.type === "notification" && "Notificação"}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: color }} />
    </div>
  );
}

const nodeTypes = { stepNode: StepNode };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function stepsToNodes(steps: WorkflowStep[]): Node[] {
  return steps.map((s, i) => ({
    id: s.id,
    type: "stepNode",
    position: { x: i * 220, y: 80 },
    data: s,
  }));
}

function stepsToEdges(steps: WorkflowStep[]): Edge[] {
  return steps.slice(0, -1).map((s, i) => ({
    id: `e-${s.id}-${steps[i + 1].id}`,
    source: s.id,
    target: steps[i + 1].id,
    animated: true,
    style: { stroke: "#94A3B8" },
  }));
}

function nanoid6() {
  return Math.random().toString(36).slice(2, 8);
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function WorkflowEditor() {
  const { primaryColor } = useBrand();
  const [activeTab, setActiveTab] = useState<"definitions" | "tasks">("definitions");
  const [editingDef, setEditingDef] = useState<{
    id?: number; name: string; steps: WorkflowStep[]; orgId: number;
  } | null>(null);

  // Dados do servidor
  const { data: definitions = [], refetch: refetchDefs } = trpc.workflow.listDefinitions.useQuery({ orgId: 1 });
  const { data: myTasks = [], refetch: refetchTasks } = trpc.workflow.myTasks.useQuery();

  const createDef = trpc.workflow.createDefinition.useMutation({
    onSuccess: () => { toast.success("Fluxo criado!"); refetchDefs(); setEditingDef(null); }
  });
  const updateDef = trpc.workflow.updateDefinition.useMutation({
    onSuccess: () => { toast.success("Fluxo atualizado!"); refetchDefs(); setEditingDef(null); }
  });
  const deleteDef = trpc.workflow.deleteDefinition.useMutation({
    onSuccess: () => { toast.success("Fluxo excluído."); refetchDefs(); }
  });
  const decide = trpc.workflow.decide.useMutation({
    onSuccess: () => { toast.success("Decisão registrada!"); refetchTasks(); }
  });

  // ─── Lista de definições ───────────────────────────────────────────────────
  function DefList() {
    return (
      <div className="space-y-3">
        {definitions.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <GitMerge size={40} className="mx-auto mb-3 opacity-40" />
            Nenhum fluxo criado ainda.
          </div>
        )}
        {definitions.map((d: any) => (
          <div key={d.id} className="bg-white border rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <div className="font-semibold text-gray-800">{d.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {(d.stepsJson as WorkflowStep[]).length} steps · {d.triggerEntityType} · {d.active ? "Ativo" : "Inativo"}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditingDef({ id: d.id, name: d.name, steps: d.stepsJson as WorkflowStep[], orgId: d.orgId })}>
                <Pencil size={14} />
              </Button>
              <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => deleteDef.mutate({ id: d.id })}>
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        ))}
        <Button
          className="w-full"
          style={{ background: primaryColor }}
          onClick={() => setEditingDef({ name: "Novo Fluxo", steps: [], orgId: 1 })}
        >
          <Plus size={14} className="mr-1" /> Novo Fluxo
        </Button>
      </div>
    );
  }

  // ─── Tarefas pendentes ──────────────────────────────────────────────────────
  function MyTasks() {
    return (
      <div className="space-y-3">
        {myTasks.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <ListChecks size={40} className="mx-auto mb-3 opacity-40" />
            Sem tarefas pendentes.
          </div>
        )}
        {myTasks.map((t: any) => (
          <div key={t.id} className="bg-white border rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div>
                <Badge variant="outline">{t.entityType} #{t.entityId}</Badge>
                <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <ClockIcon size={12} /> Step {t.currentStep + 1}
                </div>
              </div>
              <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pendente</Badge>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="bg-green-600 text-white hover:bg-green-700"
                onClick={() => decide.mutate({ instanceId: t.id, decision: "approved" })}>
                <CheckCircle2 size={12} className="mr-1" /> Aprovar
              </Button>
              <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50"
                onClick={() => decide.mutate({ instanceId: t.id, decision: "rejected" })}>
                <XCircle size={12} className="mr-1" /> Rejeitar
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflow de Aprovações</h1>
          <p className="text-gray-500 text-sm mt-1">Crie e gerencie fluxos de aprovação visuais</p>
        </div>
        {myTasks.length > 0 && (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-sm px-3 py-1">
            {myTasks.length} tarefas pendentes
          </Badge>
        )}
      </div>

      <AnimatePresence mode="wait">
        {editingDef ? (
          <motion.div
            key="editor"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <WorkflowEditorCanvas
              def={editingDef}
              primaryColor={primaryColor}
              onSave={(name, steps) => {
                if (editingDef.id) {
                  updateDef.mutate({ id: editingDef.id, name, stepsJson: steps as any });
                } else {
                  createDef.mutate({ orgId: editingDef.orgId, name, stepsJson: steps as any, triggerEntityType: "asset" });
                }
              }}
              onCancel={() => setEditingDef(null)}
              isSaving={createDef.isPending || updateDef.isPending}
            />
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="mb-4">
                <TabsTrigger value="definitions">
                  <GitMerge size={14} className="mr-1" /> Definições
                </TabsTrigger>
                <TabsTrigger value="tasks">
                  <ListChecks size={14} className="mr-1" /> Minhas Tarefas
                  {myTasks.length > 0 && (
                    <span className="ml-1.5 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">{myTasks.length}</span>
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="definitions"><DefList /></TabsContent>
              <TabsContent value="tasks"><MyTasks /></TabsContent>
            </Tabs>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Canvas de edição visual ──────────────────────────────────────────────────
function WorkflowEditorCanvas({ def, primaryColor, onSave, onCancel, isSaving }: {
  def: { name: string; steps: WorkflowStep[] };
  primaryColor: string;
  onSave: (name: string, steps: WorkflowStep[]) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(def.name);
  const [steps, setSteps] = useState<WorkflowStep[]>(def.steps);

  const [nodes, setNodes, onNodesChange] = useNodesState(stepsToNodes(steps));
  const [edges, setEdges, onEdgesChange] = useEdgesState(stepsToEdges(steps));

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge({ ...connection, animated: true }, eds));
  }, []);

  function addStep(type: StepType) {
    const newStep: WorkflowStep = {
      id: nanoid6(),
      type,
      label: type === "approval" ? "Aprovação" : type === "parallel_approval" ? "Aprovação Paralela" : "Notificação",
      approvers: [],
    };
    const newSteps = [...steps, newStep];
    setSteps(newSteps);
    setNodes(stepsToNodes(newSteps));
    setEdges(stepsToEdges(newSteps));
  }

  function removeStep(id: string) {
    const newSteps = steps.filter((s) => s.id !== id);
    setSteps(newSteps);
    setNodes(stepsToNodes(newSteps));
    setEdges(stepsToEdges(newSteps));
  }

  return (
    <div className="space-y-4">
      {/* Nome do fluxo */}
      <div className="flex items-center gap-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="text-lg font-semibold max-w-sm" />
        <Button variant="outline" onClick={onCancel}><X size={14} className="mr-1" /> Cancelar</Button>
        <Button onClick={() => onSave(name, steps)} disabled={isSaving || !name.trim()}
          style={{ background: primaryColor }} className="text-white hover:opacity-90">
          <Save size={14} className="mr-1" /> {isSaving ? "Salvando..." : "Salvar Fluxo"}
        </Button>
      </div>

      {/* Toolbar de tipos de step */}
      <div className="flex gap-2">
        <span className="text-xs text-gray-500 self-center mr-2">Adicionar step:</span>
        {(["approval", "parallel_approval", "notification"] as StepType[]).map((type) => (
          <Button key={type} size="sm" variant="outline" onClick={() => addStep(type)}
            style={{ borderColor: STEP_COLORS[type], color: STEP_COLORS[type] }}>
            {STEP_ICONS[type]}
            <span className="ml-1 text-xs">
              {type === "approval" ? "Simples" : type === "parallel_approval" ? "Paralela" : "Notificação"}
            </span>
          </Button>
        ))}
      </div>

      {/* Canvas ReactFlow */}
      <div className="border rounded-xl overflow-hidden" style={{ height: 340 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      {/* Lista editável de steps */}
      <div className="space-y-2">
        <Label>Steps ({steps.length})</Label>
        {steps.length === 0 && <div className="text-sm text-gray-400">Nenhum step adicionado.</div>}
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
            <span style={{ color: STEP_COLORS[s.type] }}>{STEP_ICONS[s.type]}</span>
            <span className="text-xs text-gray-500 w-5">{i + 1}.</span>
            <Input
              className="text-sm h-7 flex-1"
              value={s.label}
              onChange={(e) => {
                const updated = steps.map((st) => st.id === s.id ? { ...st, label: e.target.value } : st);
                setSteps(updated);
                setNodes(stepsToNodes(updated));
              }}
            />
            <Input
              className="text-xs h-7 w-48"
              placeholder="openIds aprovadores (,)"
              value={s.approvers?.join(",") ?? ""}
              onChange={(e) => {
                const updated = steps.map((st) => st.id === s.id
                  ? { ...st, approvers: e.target.value.split(",").map(x => x.trim()).filter(Boolean) }
                  : st);
                setSteps(updated);
              }}
            />
            <Button size="sm" variant="ghost" className="text-red-400" onClick={() => removeStep(s.id)}>
              <Trash2 size={12} />
            </Button>
            {i < steps.length - 1 && <ChevronRight size={14} className="text-gray-300" />}
          </div>
        ))}
      </div>
    </div>
  );
}
