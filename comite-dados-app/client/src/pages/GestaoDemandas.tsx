/**
 * GestaoDemandas.tsx
 * Fusão de: IntakePage + ServiceNow
 * Organizado em 2 abas: Entrada de Demandas (Intake) | Tickets ServiceNow
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Inbox, Ticket } from "lucide-react";
import IntakePage from "./IntakePage";
import ServiceNow from "./ServiceNow";

export default function GestaoDemandas() {
  return (
    <div className="p-6 space-y-4 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-[#1B3A8C]">Gestão de Demandas</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Submissão e triagem de demandas ao Comitê (Intake) e acompanhamento de tickets no ServiceNow
        </p>
      </div>

      <Tabs defaultValue="intake" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-2">
          <TabsTrigger value="intake" className="gap-2">
            <Inbox size={15} />
            Entrada de Demandas
          </TabsTrigger>
          <TabsTrigger value="servicenow" className="gap-2">
            <Ticket size={15} />
            Tickets ServiceNow
          </TabsTrigger>
        </TabsList>

        <TabsContent value="intake" className="mt-0">
          <IntakePage />
        </TabsContent>

        <TabsContent value="servicenow" className="mt-0">
          <ServiceNow />
        </TabsContent>
      </Tabs>
    </div>
  );
}
