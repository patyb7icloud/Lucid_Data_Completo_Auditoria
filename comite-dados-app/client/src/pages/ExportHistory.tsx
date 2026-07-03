import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import * as XLSX from "xlsx";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  FileText,
  FileDown,
  BarChart3,
  GitBranch,
  Download,
  Trash2,
  Search,
  RefreshCw,
  History,
  ChevronLeft,
  ChevronRight,
  User,
  Clock,
  HardDrive,
  FileSpreadsheet,
  FileType2,
  Loader2,
  ShieldCheck,
  UserCircle2,
} from "lucide-react";

// ─── Tipos e constantes ───────────────────────────────────────────────────────
const DOC_TYPE_LABELS: Record<string, string> = {
  meeting_minutes_pdf: "Ata de Reunião (PDF)",
  meeting_minutes_docx: "Ata de Reunião (Word)",
  organogram_pdf: "Organograma (PDF)",
  metrics_report_pdf: "Relatório de Métricas (PDF)",
};

const DOC_TYPE_ICONS: Record<string, React.ReactNode> = {
  meeting_minutes_pdf: <FileText size={14} className="text-red-500" />,
  meeting_minutes_docx: <FileDown size={14} className="text-blue-600" />,
  organogram_pdf: <GitBranch size={14} className="text-purple-600" />,
  metrics_report_pdf: <BarChart3 size={14} className="text-green-600" />,
};

const DOC_TYPE_BADGE: Record<string, string> = {
  meeting_minutes_pdf: "bg-red-50 text-red-700 border-red-200",
  meeting_minutes_docx: "bg-blue-50 text-blue-700 border-blue-200",
  organogram_pdf: "bg-purple-50 text-purple-700 border-purple-200",
  metrics_report_pdf: "bg-green-50 text-green-700 border-green-200",
};

const FORMAT_BADGE: Record<string, string> = {
  pdf: "bg-orange-50 text-orange-700 border-orange-200",
  docx: "bg-sky-50 text-sky-700 border-sky-200",
};

function formatBytes(bytes?: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PAGE_SIZE = 15;

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ExportHistory() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const [docTypeFilter, setDocTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [exportingFormat, setExportingFormat] = useState<"csv" | "xlsx" | null>(null);

  // Query para exportar TODOS os registros (sem paginação)
  const { refetch: fetchAllForExport } = trpc.export.historyExport.useQuery(
    { documentType: docTypeFilter === "all" ? undefined : docTypeFilter },
    { enabled: false }
  );

  const { data, isLoading, isFetching } = trpc.export.history.useQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    documentType: docTypeFilter === "all" ? undefined : docTypeFilter,
  });

  const deleteMutation = trpc.export.deleteHistory.useMutation({
    onSuccess: () => {
      utils.export.history.invalidate();
      toast.success("Registro removido do histórico.");
      setDeleteId(null);
    },
    onError: (e) => {
      toast.error("Erro ao remover: " + e.message);
      setDeleteId(null);
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  // isAdmin vem do backend (fonte de verdade); fallback para o papel local enquanto carrega
  const isAdmin = data?.isAdmin ?? (user?.role === "admin");

  // Filtro local por título/usuário (busca no conjunto já paginado)
  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i) =>
        i.documentTitle.toLowerCase().includes(q) ||
        (i.generatedBy ?? "").toLowerCase().includes(q) ||
        (i.referenceName ?? "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setSearch("");
  };

  const handleFilterChange = (value: string) => {
    setDocTypeFilter(value);
    setPage(0);
    setSearch("");
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildRows = (records: any[]) =>
    records.map((item) => ({
      "ID": item.id,
      "Título do Documento": item.documentTitle,
      "Tipo": DOC_TYPE_LABELS[item.documentType] ?? item.documentType,
      "Formato": item.fileFormat.toUpperCase(),
      "Referência": item.referenceName ?? "",
      "Gerado por": item.generatedBy ?? "",
      "Tamanho (bytes)": item.fileSizeBytes ?? 0,
      "Data/Hora": formatDateTime(item.createdAt),
      "URL do Arquivo": item.fileUrl,
    }));

  const handleExportCSV = useCallback(async () => {
    setExportingFormat("csv");
    try {
      const { data: allItems } = await fetchAllForExport();
      const rows = buildRows(allItems ?? []);
      const ws = XLSX.utils.json_to_sheet(rows);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `historico-exportacoes-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`CSV gerado com ${rows.length} registros.`);
    } catch (e) {
      toast.error("Erro ao gerar CSV.");
    } finally {
      setExportingFormat(null);
    }
  }, [docTypeFilter, fetchAllForExport]);

  const handleExportXLSX = useCallback(async () => {
    setExportingFormat("xlsx");
    try {
      const { data: allItems } = await fetchAllForExport();
      const rows = buildRows(allItems ?? []);
      const ws = XLSX.utils.json_to_sheet(rows);

      // Larguras de coluna
      ws["!cols"] = [
        { wch: 6 },   // ID
        { wch: 48 },  // Título
        { wch: 26 },  // Tipo
        { wch: 8 },   // Formato
        { wch: 30 },  // Referência
        { wch: 24 },  // Gerado por
        { wch: 16 },  // Tamanho
        { wch: 18 },  // Data/Hora
        { wch: 60 },  // URL
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Histórico de Exportações");
      XLSX.writeFile(wb, `historico-exportacoes-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`Excel gerado com ${rows.length} registros.`);
    } catch (e) {
      toast.error("Erro ao gerar Excel.");
    } finally {
      setExportingFormat(null);
    }
  }, [docTypeFilter, fetchAllForExport]);

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <History size={22} className="text-[#1B3A8C]" />
            Histórico de Exportações
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-gray-500">
              {isAdmin
                ? "Auditoria de todos os documentos gerados pela plataforma"
                : "Exibindo apenas suas exportações"}
            </p>
            {isAdmin ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#1B3A8C]/10 text-[#1B3A8C]">
                <ShieldCheck size={11} />
                Visão de Administrador
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                <UserCircle2 size={11} />
                Suas Exportações
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs border-gray-200 text-gray-600 hover:text-gray-900"
            onClick={handleExportCSV}
            disabled={exportingFormat !== null || total === 0}
            title="Exportar histórico completo em CSV"
          >
            {exportingFormat === "csv" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <FileType2 size={13} className="text-green-600" />
            )}
            Exportar CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs border-gray-200 text-gray-600 hover:text-gray-900"
            onClick={handleExportXLSX}
            disabled={exportingFormat !== null || total === 0}
            title="Exportar histórico completo em Excel"
          >
            {exportingFormat === "xlsx" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={13} className="text-emerald-600" />
            )}
            Exportar Excel
          </Button>
          <div className="w-px h-5 bg-gray-200" />
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => utils.export.history.invalidate()}
            disabled={isFetching}
          >
            <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Estatísticas rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { type: "meeting_minutes_pdf", label: "Atas PDF" },
          { type: "meeting_minutes_docx", label: "Atas Word" },
          { type: "organogram_pdf", label: "Organogramas" },
          { type: "metrics_report_pdf", label: "Relatórios" },
        ].map((stat) => {
          const count = items.filter((i) => i.documentType === stat.type).length;
          return (
            <button
              key={stat.type}
              onClick={() => handleFilterChange(docTypeFilter === stat.type ? "all" : stat.type)}
              className={`p-3 rounded-lg border text-left transition-all ${
                docTypeFilter === stat.type
                  ? "border-[#1B3A8C] bg-[#E8EDF8]"
                  : "border-gray-100 bg-white hover:border-[#1B3A8C]/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {DOC_TYPE_ICONS[stat.type]}
                <span className="text-xs text-gray-500">{stat.label}</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{count}</p>
              <p className="text-xs text-gray-400">nesta página</p>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <Card className="border border-gray-100 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Buscar por título, usuário ou referência..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-sm h-9"
              />
            </div>
            <Select value={docTypeFilter} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-[220px] h-9 text-sm">
                <SelectValue placeholder="Tipo de documento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="meeting_minutes_pdf">Ata de Reunião (PDF)</SelectItem>
                <SelectItem value="meeting_minutes_docx">Ata de Reunião (Word)</SelectItem>
                <SelectItem value="organogram_pdf">Organograma (PDF)</SelectItem>
                <SelectItem value="metrics_report_pdf">Relatório de Métricas</SelectItem>
              </SelectContent>
            </Select>
            {(docTypeFilter !== "all" || search) && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-gray-500 h-9"
                onClick={() => { setDocTypeFilter("all"); setSearch(""); setPage(0); }}
              >
                Limpar filtros
              </Button>
            )}
            <span className="text-xs text-gray-400 ml-auto">
              {total} registro{total !== 1 ? "s" : ""} no total
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de histórico */}
      <Card className="border border-gray-100 shadow-sm overflow-hidden">
        <CardHeader className="pb-0 px-5 pt-4">
          <CardTitle className="text-sm font-semibold text-gray-700">
            Registros de Exportação
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B3A8C]"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <History size={40} className="mx-auto mb-3 text-gray-200" />
              <p className="text-gray-500 font-medium">Nenhuma exportação encontrada</p>
              <p className="text-sm text-gray-400 mt-1">
                {search || docTypeFilter !== "all"
                  ? "Tente ajustar os filtros de busca"
                  : "Os documentos exportados aparecerão aqui automaticamente"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Documento
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Tipo
                    </th>
                    {isAdmin && (
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">
                        Gerado por
                      </th>
                    )}
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">
                      Tamanho
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Data/Hora
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50/50 transition-colors group"
                    >
                      {/* Documento */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 flex-shrink-0">
                            {DOC_TYPE_ICONS[item.documentType]}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate max-w-[280px]">
                              {item.documentTitle}
                            </p>
                            {item.referenceName && (
                              <p className="text-xs text-gray-400 truncate max-w-[280px] mt-0.5">
                                {item.referenceName}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Tipo */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant="outline"
                            className={`text-xs w-fit ${DOC_TYPE_BADGE[item.documentType]}`}
                          >
                            {DOC_TYPE_LABELS[item.documentType] ?? item.documentType}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs w-fit uppercase font-mono ${FORMAT_BADGE[item.fileFormat]}`}
                          >
                            {item.fileFormat}
                          </Badge>
                        </div>
                      </td>

                      {/* Gerado por — visível apenas para admins */}
                      {isAdmin && (
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <User size={12} className="text-gray-400 flex-shrink-0" />
                            <span className="text-xs truncate max-w-[140px]">
                              {item.generatedBy ?? "—"}
                            </span>
                          </div>
                        </td>
                      )}

                      {/* Tamanho */}
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <div className="flex items-center gap-1.5 text-gray-500">
                          <HardDrive size={12} className="text-gray-400" />
                          <span className="text-xs font-mono">
                            {formatBytes(item.fileSizeBytes)}
                          </span>
                        </div>
                      </td>

                      {/* Data/Hora */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 text-gray-500">
                          <Clock size={12} className="text-gray-400 flex-shrink-0" />
                          <span className="text-xs">
                            {formatDateTime(item.createdAt)}
                          </span>
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a
                            href={item.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Baixar documento"
                          >
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-[#1B3A8C] hover:bg-[#E8EDF8]"
                            >
                              <Download size={13} />
                            </Button>
                          </a>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                            title="Remover do histórico"
                            onClick={() => setDeleteId(item.id)}
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Página {page + 1} de {totalPages} — {total} registros
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              disabled={page === 0}
              onClick={() => handlePageChange(page - 1)}
            >
              <ChevronLeft size={14} />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pageNum = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
              return (
                <Button
                  key={pageNum}
                  size="sm"
                  variant={pageNum === page ? "default" : "outline"}
                  className={`h-8 w-8 p-0 text-xs ${pageNum === page ? "bg-[#1B3A8C] hover:bg-[#122970]" : ""}`}
                  onClick={() => handlePageChange(pageNum)}
                >
                  {pageNum + 1}
                </Button>
              );
            })}
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              disabled={page >= totalPages - 1}
              onClick={() => handlePageChange(page + 1)}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteId !== null} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover do histórico?</AlertDialogTitle>
            <AlertDialogDescription>
              Este registro será removido do histórico de auditoria. O arquivo no armazenamento
              não será excluído, mas o link de acesso ficará indisponível nesta listagem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
