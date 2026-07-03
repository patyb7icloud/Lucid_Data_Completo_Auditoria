/**
 * PortalLGPD.tsx
 * Fusão de: ComplianceLGPD + LgpdReport + PiaPage + DsarPage
 * Organizado em 4 abas: Dashboard | Inventário & RIPD | Avaliações de Impacto (PIA) | Direitos do Titular (DSAR)
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, FileText, ClipboardList, UserCheck } from "lucide-react";
import ComplianceLGPD from "./ComplianceLGPD";
import LgpdReport from "./LgpdReport";
import PiaPage from "./PiaPage";
import DsarPage from "./DsarPage";

export default function PortalLGPD() {
  return (
    <div className="p-6 space-y-4 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-[#1B3A8C]">Portal LGPD & Privacidade</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Dashboard de conformidade, inventário de ativos sensíveis, avaliações de impacto e gestão de direitos dos titulares
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-2">
          <TabsTrigger value="dashboard" className="gap-2">
            <ShieldCheck size={15} />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="inventario" className="gap-2">
            <FileText size={15} />
            Inventário & RIPD
          </TabsTrigger>
          <TabsTrigger value="pia" className="gap-2">
            <ClipboardList size={15} />
            Avaliações (PIA)
          </TabsTrigger>
          <TabsTrigger value="dsar" className="gap-2">
            <UserCheck size={15} />
            Direitos do Titular
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-0">
          <ComplianceLGPD />
        </TabsContent>

        <TabsContent value="inventario" className="mt-0">
          <LgpdReport />
        </TabsContent>

        <TabsContent value="pia" className="mt-0">
          <PiaPage />
        </TabsContent>

        <TabsContent value="dsar" className="mt-0">
          <DsarPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
