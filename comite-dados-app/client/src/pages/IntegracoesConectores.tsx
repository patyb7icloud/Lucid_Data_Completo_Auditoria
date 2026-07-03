/**
 * IntegracoesConectores.tsx
 * Fusão de: IntegrationsPage + MarketplacePage
 * Organizado em 2 abas: Integrações Ativas | Marketplace de Conectores
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plug, Store } from "lucide-react";
import IntegrationsPage from "./IntegrationsPage";
import MarketplacePage from "./MarketplacePage";

export default function IntegracoesConectores() {
  return (
    <div className="p-6 space-y-4 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-[#1B3A8C]">Integrações & Conectores</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Gerenciamento de integrações ativas e marketplace de conectores para fontes de dados externas
        </p>
      </div>

      <Tabs defaultValue="integracoes" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-2">
          <TabsTrigger value="integracoes" className="gap-2">
            <Plug size={15} />
            Integrações Ativas
          </TabsTrigger>
          <TabsTrigger value="marketplace" className="gap-2">
            <Store size={15} />
            Marketplace
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integracoes" className="mt-0">
          <IntegrationsPage />
        </TabsContent>

        <TabsContent value="marketplace" className="mt-0">
          <MarketplacePage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
