/**
 * FilaAprovacoes.tsx
 * Fusão de: AprovacoesFila + WorkflowEditor
 * Organizado em 2 abas: Fila de Aprovações | Editor de Workflows
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardCheck, GitBranch } from "lucide-react";
import AprovacoesFila from "./AprovacoesFila";
import WorkflowEditor from "./WorkflowEditor";

export default function FilaAprovacoes() {
  return (
    <div className="p-6 space-y-4 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-[#1B3A8C]">Fila de Aprovações</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Solicitações de acesso a dados pendentes de aprovação e configuração de workflows de governança
        </p>
      </div>

      <Tabs defaultValue="fila" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-2">
          <TabsTrigger value="fila" className="gap-2">
            <ClipboardCheck size={15} />
            Fila de Aprovações
          </TabsTrigger>
          <TabsTrigger value="workflows" className="gap-2">
            <GitBranch size={15} />
            Editor de Workflows
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fila" className="mt-0">
          <AprovacoesFila />
        </TabsContent>

        <TabsContent value="workflows" className="mt-0">
          <WorkflowEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
