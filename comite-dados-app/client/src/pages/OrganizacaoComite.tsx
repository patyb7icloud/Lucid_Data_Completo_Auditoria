/**
 * OrganizacaoComite.tsx
 * Fusão de: Participants + Organogram + RaciMatrix
 * Organizado em 3 abas: Participantes | Organograma | Matriz RACI
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, GitBranch, Table2 } from "lucide-react";
import Participants from "./Participants";
import Organogram from "./Organogram";
import RaciMatrix from "./RaciMatrix";

export default function OrganizacaoComite() {
  return (
    <div className="p-6 space-y-4 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-[#1B3A8C]">Organização do Comitê</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Membros, estrutura hierárquica e responsabilidades do Lucid Data Governance
        </p>
      </div>

      <Tabs defaultValue="participantes" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-2">
          <TabsTrigger value="participantes" className="gap-2">
            <Users size={15} />
            Participantes
          </TabsTrigger>
          <TabsTrigger value="organograma" className="gap-2">
            <GitBranch size={15} />
            Organograma
          </TabsTrigger>
          <TabsTrigger value="raci" className="gap-2">
            <Table2 size={15} />
            Matriz RACI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="participantes" className="mt-0">
          <Participants />
        </TabsContent>

        <TabsContent value="organograma" className="mt-0">
          <Organogram />
        </TabsContent>

        <TabsContent value="raci" className="mt-0">
          <RaciMatrix />
        </TabsContent>
      </Tabs>
    </div>
  );
}
