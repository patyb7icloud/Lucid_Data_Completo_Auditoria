import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield, Download, AlertTriangle, Eye, Lock, Search, FileText, Database,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sensitivityConfig: Record<string, { label: string; color: string }> = {
  public:       { label: "Público",       color: "bg-green-100 text-green-800" },
  internal:     { label: "Interno",       color: "bg-blue-100 text-blue-800" },
  confidential: { label: "Confidencial",  color: "bg-orange-100 text-orange-800" },
  restricted:   { label: "Restrito",      color: "bg-red-100 text-red-800" },
};

const typeConfig: Record<string, { label: string }> = {
  table:      { label: "Tabela" },
  view:       { label: "View" },
  api:        { label: "API" },
  report:     { label: "Relatório" },
  file:       { label: "Arquivo" },
  stream:     { label: "Stream" },
  dashboard:  { label: "Dashboard" },
};

// ─── CSV Export ───────────────────────────────────────────────────────────────
function downloadCsv(rows: any[]) {
  if (!rows.length) return;
  const headers = ["ID", "Nome", "Tipo", "Classificação", "Domínio", "Data Owner", "Descrição", "Atualizado Em"];
  const csvRows = rows.map(r => [
    r.id, r.name, typeConfig[r.type]?.label ?? r.type,
    sensitivityConfig[r.sensitivity]?.label ?? r.sensitivity,
    r.domainId ?? "",
    r.ownerName ?? "",
    (r.description ?? "").replace(/,/g, ";"),
    r.updatedAt ? new Date(r.updatedAt).toLocaleDateString("pt-BR") : "",
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
  const blob = new Blob([[headers.join(","), ...csvRows].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "relatorio_lgpd.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ─── Asset row ────────────────────────────────────────────────────────────────
function AssetRow({ asset }: { asset: any }) {
  const s = sensitivityConfig[asset.sensitivity] ?? { label: asset.sensitivity, color: "bg-gray-100 text-gray-700" };
  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-4 py-3">
        <div className="font-medium text-sm">{asset.name}</div>
        <div className="text-xs text-muted-foreground">{asset.description?.slice(0, 80) ?? "—"}</div>
      </td>
      <td className="px-4 py-3 text-sm">{typeConfig[asset.type]?.label ?? asset.type}</td>
      <td className="px-4 py-3">
        <Badge className={`text-xs ${s.color}`}>{s.label}</Badge>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{asset.ownerName ?? "—"}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {asset.updatedAt ? new Date(asset.updatedAt).toLocaleDateString("pt-BR") : "—"}
      </td>
      <td className="px-4 py-3">
        {asset.sensitivity === "restricted" ? (
          <Lock className="h-4 w-4 text-red-500" />
        ) : (
          <Eye className="h-4 w-4 text-orange-400" />
        )}
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LgpdReport() {
  const [search, setSearch] = useState("");
  const [filterSensitivity, setFilterSensitivity] = useState("all");

  const { data: assets = [], isLoading } = trpc.maturity.lgpdAssets.useQuery();

  const filtered = assets.filter((a: any) => {
    if (filterSensitivity !== "all" && a.sensitivity !== filterSensitivity) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) &&
        !(a.description ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const restricted  = assets.filter((a: any) => a.sensitivity === "restricted").length;
  const confidential = assets.filter((a: any) => a.sensitivity === "confidential").length;
  const noOwner     = assets.filter((a: any) => !a.ownerId).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-50 rounded-xl">
            <Shield className="h-7 w-7 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1B3A8C]">Relatório LGPD</h1>
            <p className="text-muted-foreground text-sm">
              Inventário de dados pessoais e sensíveis — Relatório de Impacto (RIPD)
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => downloadCsv(filtered)} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-4 w-4 text-[#1B3A8C]" />
              <span className="text-sm text-muted-foreground">Total de Ativos</span>
            </div>
            <p className="text-3xl font-bold text-[#1B3A8C]">{assets.length}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="h-4 w-4 text-red-600" />
              <span className="text-sm text-muted-foreground">Dados Restritos</span>
            </div>
            <p className="text-3xl font-bold text-red-600">{restricted}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Confidenciais</span>
            </div>
            <p className="text-3xl font-bold text-orange-500">{confidential}</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Sem Data Owner</span>
            </div>
            <p className="text-3xl font-bold text-yellow-600">{noOwner}</p>
          </CardContent>
        </Card>
      </div>

      {/* RIPD Summary */}
      <Card className="border-red-100 bg-red-50/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-red-600" />
            Sumário RIPD — Relatório de Impacto à Proteção de Dados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <Badge className="bg-red-100 text-red-800 shrink-0">Escopo</Badge>
              <span>
                Este relatório identifica automaticamente ativos de dados com classificação <strong>Restrita</strong> ou{" "}
                <strong>Confidencial</strong>, além de ativos cujos metadados referenciam dados pessoais (CPF, dado pessoal, PII).
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-orange-100 text-orange-800 shrink-0">Riscos</Badge>
              <span>
                {noOwner > 0 ? (
                  <><strong>{noOwner} ativo(s)</strong> sem Data Owner atribuído — responsabilidade de tratamento indefinida.</>
                ) : (
                  "Todos os ativos sensíveis possuem Data Owner atribuído."
                )}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-blue-100 text-blue-800 shrink-0">Base Legal</Badge>
              <span>
                Verifique se cada ativo restrito possui base legal documentada no catálogo (consentimento, obrigação legal,
                legítimo interesse, etc.). Utilize o campo "Notas" ou "Descrição" do ativo para registrar.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-emerald-100 text-emerald-800 shrink-0">Ação</Badge>
              <span>
                Exporte este relatório e encaminhe ao DPO (Data Protection Officer) para revisão periódica.
                Recomenda-se revisão trimestral ou após mudanças significativas no catálogo.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome ou descrição..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterSensitivity} onValueChange={setFilterSensitivity}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Classificação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="restricted">Restrito</SelectItem>
            <SelectItem value="confidential">Confidencial</SelectItem>
            <SelectItem value="internal">Interno</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} ativos</span>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Ativo</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Classificação</th>
                <th className="px-4 py-3 text-left">Data Owner</th>
                <th className="px-4 py-3 text-left">Atualizado</th>
                <th className="px-4 py-3 text-left">Risco</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum ativo encontrado.</td></tr>
              ) : (
                filtered.map((a: any) => <AssetRow key={a.id} asset={a} />)
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
