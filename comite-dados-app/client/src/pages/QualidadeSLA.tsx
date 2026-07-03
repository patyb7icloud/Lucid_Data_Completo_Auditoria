/**
 * QualidadeSLA.tsx
 * Fusão de: DataQuality + SlaPage
 * Organizado em 2 abas: Qualidade de Dados | SLA & Violações
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, Gauge } from "lucide-react";
import DataQuality from "./DataQuality";
import SlaPage from "./SlaPage";

export default function QualidadeSLA() {
  return (
    <div className="p-6 space-y-4 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-[#1B3A8C]">Qualidade & SLA</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Monitoramento de qualidade dos ativos de dados e gestão de acordos de nível de serviço
        </p>
      </div>

      <Tabs defaultValue="qualidade" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-2">
          <TabsTrigger value="qualidade" className="gap-2">
            <ShieldCheck size={15} />
            Qualidade de Dados
          </TabsTrigger>
          <TabsTrigger value="sla" className="gap-2">
            <Gauge size={15} />
            SLA & Violações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="qualidade" className="mt-0">
          <DataQuality />
        </TabsContent>

        <TabsContent value="sla" className="mt-0">
          <SlaPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
