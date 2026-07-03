/**
 * DicionarioCuradoria.tsx
 * Fusão de: DataDictionary + TagPolicies + PiiPolicies
 * Organizado em 3 abas: Dicionário & Curadoria | Políticas de Tags | Políticas PII
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookText, Tag, Shield } from "lucide-react";
import DataDictionary from "./DataDictionary";
import TagPolicies from "./TagPolicies";
import PiiPolicies from "./PiiPolicies";

export default function DicionarioCuradoria() {
  return (
    <div className="p-6 space-y-4 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-[#1B3A8C]">Dicionário & Curadoria</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Curadoria de ativos e atributos, classificação de dados sensíveis e políticas de governança no Unity Catalog
        </p>
      </div>

      <Tabs defaultValue="dicionario" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-2">
          <TabsTrigger value="dicionario" className="gap-2">
            <BookText size={15} />
            Dicionário & Curadoria
          </TabsTrigger>
          <TabsTrigger value="tags" className="gap-2">
            <Tag size={15} />
            Políticas de Tags
          </TabsTrigger>
          <TabsTrigger value="pii" className="gap-2">
            <Shield size={15} />
            Políticas PII
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dicionario" className="mt-0">
          {/* Remove o padding duplo renderizando o conteúdo inline */}
          <DataDictionary />
        </TabsContent>

        <TabsContent value="tags" className="mt-0">
          <TagPolicies />
        </TabsContent>

        <TabsContent value="pii" className="mt-0">
          <PiiPolicies />
        </TabsContent>
      </Tabs>
    </div>
  );
}
