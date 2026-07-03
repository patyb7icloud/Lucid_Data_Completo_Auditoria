import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  BookText, 
  Search, 
  Info,
  Key,
  ArrowRightLeft,
  Loader2,
  Database,
  ShieldCheck,
  User,
  History,
  Lock,
  Download,
  Sparkles,
  AlertCircle,
  X,
  Edit3,
  Save,
  CheckCircle2,
  Activity,
  Verified,
  ShieldAlert,
  Tag,
  Wand2,
  Upload,
  BookOpen,
  Eye
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function DataDictionary() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [selectedAttr, setSelectedAttr] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isAiScanning, setIsAiScanning] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isTagging, setIsTagging] = useState(false);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [syncPreview, setSyncPreview] = useState<any | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGlossaryPushing, setIsGlossaryPushing] = useState(false);

  // Estados para edição
  const [editDesc, setEditDesc] = useState("");
  const [editRules, setEditRules] = useState("");
  const [editPii, setEditPii] = useState(false);

  // Busca ativos reais do banco
  const { data: assets, isLoading: isLoadingAssets } = trpc.governance.listAssets.useQuery({});
  const { data: user } = trpc.auth.me.useQuery();
  
  // Rota de chat da IA para o scan
  const aiChat = trpc.ai.chat.useMutation();
  
  // Scanner de PII nativo (não depende de LLM externo)
  const scanPii = trpc.governance.scanPii.useMutation();

  // Mutação para salvar alterações
  const utils = trpc.useContext();
  const updateAttribute = trpc.governance.updateAttribute.useMutation({
    onSuccess: () => {
      utils.governance.getAttributes.invalidate();
      setIsEditing(false);
      setIsDialogOpen(false);
    }
  });

  const tagWithLLM = trpc.governance.tagAttributesWithLLM.useMutation();
  const suggestTags = trpc.governance.suggestTagsWithLLM.useMutation();
  const pushToDatabricks = trpc.governance.pushVerifiedTagsToDatabricks.useMutation();
  const pushToGlossary = trpc.governance.pushToGlossaryWithLLM.useMutation();
  const previewSync = trpc.governance.previewDatabricksSync.useMutation();

  // Verifica papel do usuário (sync Databricks requer admin ou data_steward)
  const canSyncDatabricks = user?.role === 'admin' || user?.role === 'data_steward';

  // Define o ativo selecionado
  const selectedAsset = useMemo(() => {
    if (!assets || assets.length === 0) return null;
    if (selectedAssetId) return assets.find(a => a.id === selectedAssetId) || assets[0];
    return assets[0];
  }, [assets, selectedAssetId]);

  // Busca atributos (campos) do ativo selecionado
  const { data: attributes, isLoading: isLoadingAttributes } = trpc.governance.getAttributes.useQuery(
    { assetId: selectedAsset?.id ?? 0 },
    { enabled: !!selectedAsset }
  );

  const filteredAttributes = useMemo(() => {
    if (!attributes) return [];
    return attributes.filter(attr => 
      attr.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (attr.description || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [attributes, searchTerm]);

  const handleShowDetails = (attr: any) => {
    setSelectedAttr(attr);
    setEditDesc(attr.description || "");
    setEditRules(attr.businessRules || "");
    setEditPii(!!attr.isPii);
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedAttr) return;
    await updateAttribute.mutateAsync({
      id: selectedAttr.id,
      description: editDesc,
      businessRules: editRules,
      isPii: editPii,
      isVerified: false // Resetamos a verificação se houve mudança manual
    });
  };

  const handleApprove = async () => {
    if (!selectedAttr) return;
    await updateAttribute.mutateAsync({
      id: selectedAttr.id,
      isVerified: true,
      verifiedBy: user?.name || user?.openId || "Steward"
    });
  };

  const handleAiScan = async () => {
    if (!selectedAsset) return;
    setIsAiScanning(true);
    setAiReport(null);
    try {
      // Passo 1: Scanner de PII nativo (sempre funciona, sem dependência de LLM)
      const piiResult = await scanPii.mutateAsync({ assetId: selectedAsset.id });
      const piiFields = piiResult.results.filter(r => r.isPii);
      
      let report = `✅ Scan de Sensibilidade LGPD concluído para "${selectedAsset.name}"\n`;
      report += `• Total de campos analisados: ${piiResult.total}\n`;
      report += `• Campos com dados pessoais detectados: ${piiResult.piiDetected}\n\n`;

      if (piiFields.length > 0) {
        report += `🔴 Campos sensíveis identificados (LGPD):\n`;
        piiFields.forEach(f => {
          report += `  - ${f.name} (${f.dataType || 'tipo desconhecido'}) → Classificar como RESTRITO\n`;
        });
        report += `\nRecomendação: Revise esses campos e aplique as classificações de sensibilidade adequadas.`;
      } else {
        report += `✅ Nenhum campo com dados pessoais sensíveis detectado automaticamente.\nRecomendação: Valide manualmente os campos de negócio para garantir conformidade LGPD.`;
      }

      // Passo 2: Sugerir tags governadas com Gemini
      try {
        const tagResult = await suggestTags.mutateAsync({ assetId: selectedAsset.id });
        if (tagResult.suggestions.length > 0) {
          report += `\n\n🏷️ Sugestões de Tags Governadas (Gemini):\n`;
          if (tagResult.assetSummary) {
            report += `Resumo: ${tagResult.assetSummary}\n`;
          }
          tagResult.suggestions.forEach(s => {
            const conf = Math.round((s.confidence ?? 0) * 100);
            report += `  • ${s.tagKey} → ${s.suggestedValue} (${conf}% confiança)\n    ${s.rationale}\n`;
          });
          report += `\nAcesse Tags Governadas para aplicar essas sugestões ao ativo.`;
        } else {
          report += `\n\n🏷️ Nenhuma sugestão de tag governada identificada pelo Gemini.`;
        }
      } catch (tagErr: any) {
        const tagMsg = tagErr?.message ?? String(tagErr ?? "");
        report += `\n\n⚠️ Sugestão de tags indisponível: ${tagMsg || 'Verifique a configuração do LLM.'}`;
      }

      // Passo 3: Enriquecer com análise geral de LLM (opcional, falha graciosamente)
      try {
        const columnNames = (filteredAttributes.length ? filteredAttributes : piiResult.results)
          .map(a => `${a.name} (${(a as any).description || 'sem desc'})`).join(", ");
        const llmResponse = await aiChat.mutateAsync({
          sessionId: "scan-sensibilidade-" + Date.now(),
          message: `Analise as seguintes colunas do ativo "${selectedAsset.name}" e sugira classificações de sensibilidade LGPD e regras de negócio: ${columnNames}`
        });
        const llmContent = (llmResponse as any).message ?? (llmResponse as any).content ?? "";
        if (llmContent) {
          report += `\n\n🤖 Análise do Co-Piloto de Governança (Gemini):\n${llmContent}`;
        }
      } catch (llmErr: any) {
        // LLM pode estar configurado mas falhou (timeout, rate-limit, erro de rede)
        const llmMsg = llmErr?.message ?? String(llmErr ?? "");
        if (llmMsg) {
          report += `\n\n⚠️ Análise IA indisponível no momento: ${llmMsg}`;
        } else {
          report += `\n\n⚠️ Análise IA indisponível no momento. Verifique o servidor e tente novamente.`;
        }
      }

      setAiReport(report);
      // Recarregar atributos para refletir atualizações de isPii
      utils.governance.getAttributes.invalidate();
    } catch (err: any) {
      const detail = err?.message || "";
      setAiReport(`⚠️ Erro ao executar o Scan IA: ${detail || "Verifique se o servidor está rodando corretamente."}`);
    } finally {
      setIsAiScanning(false);
    }
  };

  const handleTagWithLLM = async () => {
    if (!selectedAsset) return;
    setIsTagging(true);
    try {
      const res = await tagWithLLM.mutateAsync({ assetId: selectedAsset.id });
      utils.governance.getAttributes.invalidate();
      utils.governance.listAssets.invalidate();
      toast.success(`${res.tagged} colunas tagueadas com IA!`);
    } catch (err: any) {
      toast.error(`Erro ao taguear com IA: ${err?.message ?? err}`);
    } finally {
      setIsTagging(false);
    }
  };

  const handleOpenSyncDialog = async () => {
    if (!selectedAsset) return;
    try {
      const preview = await previewSync.mutateAsync({ assetId: selectedAsset.id });
      setSyncPreview(preview);
      setIsSyncDialogOpen(true);
    } catch (err: any) {
      toast.error(`Erro ao carregar preview: ${err?.message ?? err}`);
    }
  };

  const handleConfirmSync = async () => {
    if (!selectedAsset) return;
    setIsSyncing(true);
    try {
      const res = await pushToDatabricks.mutateAsync({ assetId: selectedAsset.id });
      toast.success(`${res.succeeded}/${res.total} colunas sincronizadas ao Databricks!`);
      setIsSyncDialogOpen(false);
      setSyncPreview(null);
    } catch (err: any) {
      toast.error(`Erro na sincronização: ${err?.message ?? err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePushToGlossary = async () => {
    if (!selectedAsset) return;
    setIsGlossaryPushing(true);
    try {
      const res = await pushToGlossary.mutateAsync({ assetId: selectedAsset.id });
      toast.success(`${res.created} termos criados no Glossário! (${res.skipped} ignorados)`);
    } catch (err: any) {
      toast.error(`Erro ao alimentar glossário: ${err?.message ?? err}`);
    } finally {
      setIsGlossaryPushing(false);
    }
  };

  const handleExport = () => {
    if (!filteredAttributes || filteredAttributes.length === 0) return;
    const headers = ["Nome do Campo", "Tipo", "Descricao", "Regras de Negocio", "Sensibilidade", "Tags IA", "Status Curadoria"];
    const csvRows = [headers.join(",")];
    filteredAttributes.forEach(attr => {
      let aiTags = '';
      try { aiTags = attr.aiSuggestion ? (JSON.parse(attr.aiSuggestion).tags ?? []).join(';') : ''; } catch {}
      const row = [
        attr.name, 
        attr.dataType || "VARCHAR", 
        `"${(attr.description || "").replace(/"/g, '""')}"`, 
        `"${(attr.businessRules || "").replace(/"/g, '""')}"`, 
        attr.isPii ? "Restrito (LGPD)" : "Publico",
        `"${aiTags}"`,
        attr.isVerified ? "Verificado" : "Pendente"
      ];
      csvRows.push(row.join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dicionario_${selectedAsset?.name || 'export'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoadingAssets) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-[#1B3A8C]" />
        <p className="text-lg font-bold text-[#1B3A8C] animate-pulse">Carregando Governança...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <BookText className="h-6 w-6 text-[#1B3A8C]" />
            Dicionário de Dados & Metadados
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            Curadoria humana: Valide as sugestões da IA e publique regras de negócio oficiais.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="gap-2 shadow-sm border-purple-200 text-purple-700 hover:bg-purple-50 transition-all"
            onClick={handleAiScan}
            disabled={isAiScanning || !selectedAsset}
          >
            {isAiScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Scan IA
          </Button>
          <Button
            variant="outline"
            className="gap-2 shadow-sm border-amber-200 text-amber-700 hover:bg-amber-50 transition-all"
            onClick={handleTagWithLLM}
            disabled={isTagging || !selectedAsset}
            title="Usa o LLM para sugerir tags e regras de negócio a partir dos comentários do catálogo"
          >
            {isTagging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Auto-Tagear com IA
          </Button>
          {canSyncDatabricks && selectedAsset?.sourceSystem === 'Databricks' && (
            <Button
              variant="outline"
              className="gap-2 shadow-sm border-blue-200 text-blue-700 hover:bg-blue-50 transition-all"
              onClick={handleOpenSyncDialog}
              disabled={!selectedAsset}
              title="Envia tags e comentários aprovados de volta ao Unity Catalog (somente admin/steward)"
            >
              <Upload className="h-4 w-4" />
              Sync Databricks
            </Button>
          )}
          {canSyncDatabricks && (
            <Button
              variant="outline"
              className="gap-2 shadow-sm border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-all"
              onClick={handlePushToGlossary}
              disabled={isGlossaryPushing || !selectedAsset}
              title="Extrai termos de negócio via IA e alimenta o Glossário Corporativo"
            >
              {isGlossaryPushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
              Alimentar Glossário
            </Button>
          )}
          <Button 
            className="bg-[#1B3A8C] hover:bg-[#0F2460] shadow-md gap-2"
            onClick={handleExport}
            disabled={!filteredAttributes.length}
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {aiReport && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="p-5 bg-purple-50 border border-purple-100 rounded-2xl relative mb-4 shadow-sm flex gap-4">
              <div className="p-3 bg-purple-600 rounded-xl text-white shadow-lg shrink-0 h-fit">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-3 w-full">
                <h4 className="font-bold text-purple-900">Sugestões do Co-Piloto de Governança</h4>
                <div className="text-sm text-purple-800 whitespace-pre-wrap leading-relaxed font-medium bg-white/50 p-4 rounded-lg border border-purple-100/50">
                  {aiReport}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setAiReport(null)} className="h-8 text-purple-600 hover:bg-purple-100 font-bold">Entendido</Button>
                  <p className="text-[10px] text-purple-400 self-center">Aplique as sugestões editando os campos abaixo.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1 space-y-4">
          <Card className="border-none shadow-sm bg-white/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">Ativos de Dados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {assets?.map((asset) => (
                  <button 
                    key={asset.id}
                    onClick={() => setSelectedAssetId(asset.id)}
                    className={`w-full text-left text-sm py-2 px-3 rounded-md transition-all flex items-center gap-2 ${
                      selectedAsset?.id === asset.id ? 'bg-[#1B3A8C] text-white font-bold shadow-md' : 'text-gray-600 hover:bg-blue-50'
                    }`}
                  >
                    <Database className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{asset.name}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>

        <main className="lg:col-span-3 space-y-4">
          <Card className="border-none shadow-sm overflow-hidden bg-white">
            <CardHeader className="pb-4 border-b border-gray-50 bg-gray-50/30">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg text-[#1B3A8C] flex items-center gap-2">
                    Atributos de Dados 
                    <Badge variant="outline" className="text-[10px] bg-blue-50 border-blue-100 text-blue-700">
                      {filteredAttributes.filter(a => a.isVerified).length}/{filteredAttributes.length} Verificados
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Curadoria técnica de <span className="text-gray-900 font-bold">{selectedAsset?.name}</span>
                  </CardDescription>
                </div>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder="Filtrar campos..." className="pl-9 h-9 border-gray-200" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50/50">
                    <TableRow>
                      <TableHead className="font-bold">Campo & Status</TableHead>
                      <TableHead className="font-bold">Sensibilidade</TableHead>
                      <TableHead className="font-bold w-[300px]">Regra de Negócio</TableHead>
                      <TableHead className="text-right font-bold">Curadoria</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAttributes.map((attr) => (
                      <TableRow key={attr.id} className="hover:bg-blue-50/30 transition-colors">
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-gray-900">{attr.name}</span>
                              <span className="text-[10px] text-gray-400 font-mono">{attr.dataType}</span>
                              {attr.isVerified ? (
                                <Verified className="h-3.5 w-3.5 text-blue-500" aria-label="Verificado por Steward" />
                              ) : (
                                <ShieldAlert className="h-3.5 w-3.5 text-gray-300" aria-label="Pendente de Revisão" />
                              )}
                            </div>
                            <span className="text-xs text-gray-500">{attr.description || "Sem descrição."}</span>
                            {(() => {
                              try {
                                const ai = attr.aiSuggestion ? JSON.parse(attr.aiSuggestion) : null;
                                const tags: string[] = ai?.tags ?? [];
                                if (!tags.length) return null;
                                return (
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {tags.map((tag: string) => (
                                      <span key={tag} className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5">
                                        <Tag className="h-2.5 w-2.5" />{tag}
                                      </span>
                                    ))}
                                  </div>
                                );
                              } catch { return null; }
                            })()}
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            let sensitivity = 'publico';
                            try { sensitivity = attr.aiSuggestion ? (JSON.parse(attr.aiSuggestion).sensitivity ?? 'publico') : 'publico'; } catch {}
                            const isPii = attr.isPii || sensitivity === 'restrito';
                            const isConfidential = sensitivity === 'confidencial';
                            const isInternal = sensitivity === 'interno';
                            if (isPii) return <Badge className="bg-red-50 text-red-700 border-red-200 text-[9px] font-bold">RESTRITO</Badge>;
                            if (isConfidential) return <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-[9px] font-bold">CONFIDENCIAL</Badge>;
                            if (isInternal) return <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[9px] font-bold">INTERNO</Badge>;
                            return <Badge className="bg-green-50 text-green-700 border-green-200 text-[9px] font-bold">PÚBLICO</Badge>;
                          })()}
                        </TableCell>
                        <TableCell className="text-[11px] text-gray-600 italic">
                          {(() => {
                            try {
                              const ai = attr.aiSuggestion ? JSON.parse(attr.aiSuggestion) : null;
                              return attr.businessRules || ai?.businessRule || "Nenhuma regra definida.";
                            } catch { return attr.businessRules || "Nenhuma regra definida."; }
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleShowDetails(attr)} className="text-gray-400 hover:text-[#1B3A8C] gap-2">
                            <Edit3 className="h-4 w-4" />
                            <span className="text-[10px] font-bold uppercase">{attr.isVerified ? 'Revisar' : 'Validar'}</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#1B3A8C] text-xl">
              {isEditing ? <Edit3 className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6 text-blue-600" />}
              {isEditing ? "Editar Metadados" : "Curadoria de Atributo"}
            </DialogTitle>
            {!isEditing && selectedAttr?.isVerified && (
              <p className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded w-fit">
                ✓ Verificado por {selectedAttr.verifiedBy} em {selectedAttr.verifiedAt ? new Date(selectedAttr.verifiedAt).toLocaleDateString() : '--'}
              </p>
            )}
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Nome Técnico</p>
                <p className="text-sm font-mono font-bold text-[#1B3A8C]">{selectedAttr?.name}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Sensibilidade</p>
                {isEditing ? (
                  <Select onValueChange={(val) => setEditPii(val === "pii")} defaultValue={editPii ? "pii" : "public"}>
                    <SelectTrigger className="h-8 bg-white border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Público</SelectItem>
                      <SelectItem value="pii">Restrito (LGPD)</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={selectedAttr?.isPii ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}>
                    {selectedAttr?.isPii ? "Restrito" : "Público"}
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                <BookText className="h-3 w-3" /> Descrição Amigável
              </label>
              {isEditing ? (
                <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="border-gray-200" placeholder="Ex: Nome completo do cliente conforme cadastrado no SAP" />
              ) : (
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100 italic">{selectedAttr?.description || "Sem descrição."}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                <Activity className="h-3 w-3" /> Regras de Negócio
              </label>
              {isEditing ? (
                <Textarea value={editRules} onChange={(e) => setEditRules(e.target.value)} className="min-h-[120px] border-gray-200" placeholder="Descreva a lógica, cálculos ou validações deste campo..." />
              ) : (
                <p className="text-sm text-gray-800 bg-blue-50/30 p-4 rounded-xl border border-blue-100 leading-relaxed min-h-[100px]">
                  {selectedAttr?.businessRules || "Nenhuma regra definida para este campo."}
                </p>
              )}
            </div>

            {(() => {
              try {
                const ai = selectedAttr?.aiSuggestion ? JSON.parse(selectedAttr.aiSuggestion) : null;
                if (!ai) return null;
                const tags: string[] = ai.tags ?? [];
                return (
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl space-y-2">
                    <p className="text-[10px] font-bold text-amber-700 uppercase flex items-center gap-1.5">
                      <Wand2 className="h-3 w-3" /> Sugestão IA (Auto-Tagueamento)
                    </p>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {tags.map((tag: string) => (
                          <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-white text-amber-700 border border-amber-200 rounded px-2 py-0.5">
                            <Tag className="h-3 w-3" />{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {ai.businessRule && (
                      <p className="text-xs text-amber-800 italic">"{ai.businessRule}"</p>
                    )}
                    {ai.sensitivity && (
                      <p className="text-[10px] text-amber-600">
                        Sensibilidade sugerida: <span className="font-bold uppercase">{ai.sensitivity}</span>
                      </p>
                    )}
                    <p className="text-[9px] text-amber-500">Aceite as sugestões clicando em "Editar" e ajustando os campos acima.</p>
                  </div>
                );
              } catch { return null; }
            })()}
          </div>

          <DialogFooter className="mt-8 border-t pt-6 gap-3">
            {isEditing ? (
              <>
                <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancelar</Button>
                <Button className="bg-green-600 hover:bg-green-700 gap-2 px-8" onClick={handleSave} disabled={updateAttribute.isPending}>
                  {updateAttribute.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar Metadados
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" className="gap-2" onClick={() => setIsEditing(true)}>
                  <Edit3 className="h-4 w-4" /> Editar
                </Button>
                {!selectedAttr?.isVerified && (
                  <Button className="bg-blue-600 hover:bg-blue-700 gap-2 px-8" onClick={handleApprove} disabled={updateAttribute.isPending}>
                    {updateAttribute.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Aprovar Definição
                  </Button>
                )}
                {selectedAttr?.isVerified && (
                  <Button variant="ghost" className="text-gray-400" onClick={() => setIsDialogOpen(false)}>Fechar</Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog de Preview: Sincronização com Databricks ─────────────────── */}
      <Dialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-700">
              <Upload className="h-5 w-5" /> Sincronizar Tags com Databricks Unity Catalog
            </DialogTitle>
            <DialogDescription>
              Os comentários abaixo serão escritos nas colunas via{" "}
              <code className="text-[11px] bg-gray-100 px-1 rounded">ALTER TABLE … ALTER COLUMN … COMMENT</code>.
              <br />
              Apenas colunas com curadoria <strong>aprovada</strong> (✓) e sugestão IA serão sincronizadas.
              <br />
              <span className="text-red-600 font-semibold">
                ⚠️ Ação irreversível no catálogo compartilhado. Confirme antes de prosseguir.
              </span>
            </DialogDescription>
          </DialogHeader>

          {syncPreview && !syncPreview.canSync && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {syncPreview.reason}
            </div>
          )}

          {syncPreview?.commands?.length === 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-700">
              Nenhuma coluna aprovada com sugestão IA encontrada. Primeiro faça o Auto-Tagear e aprove as colunas.
            </div>
          )}

          {syncPreview?.commands?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-500 uppercase">
                {syncPreview.commands.length} coluna(s) serão atualizadas em{" "}
                <code className="text-blue-700">{syncPreview.fqn}</code>:
              </p>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {syncPreview.commands.map((cmd: any, i: number) => (
                  <div key={i} className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <Eye className="h-3 w-3 text-blue-500" />
                      <span className="font-mono font-bold text-gray-800">{cmd.column}</span>
                    </div>
                    <p className="text-gray-600 italic ml-5">{cmd.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 gap-2">
            <Button variant="ghost" onClick={() => { setIsSyncDialogOpen(false); setSyncPreview(null); }}>
              Cancelar
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 gap-2"
              onClick={handleConfirmSync}
              disabled={isSyncing || !syncPreview?.canSync || !syncPreview?.commands?.length}
            >
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Confirmar e Sincronizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
