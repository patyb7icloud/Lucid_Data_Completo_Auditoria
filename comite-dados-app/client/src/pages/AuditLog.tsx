import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Search, Download, User, Clock, Database, FileText, Tag, ChevronRight } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const actionConfig: Record<string, { label: string; className: string }> = {
  create:         { label: "Criação",           className: "bg-green-100 text-green-800" },
  update:         { label: "Atualização",        className: "bg-blue-100 text-blue-800" },
  delete:         { label: "Exclusão",           className: "bg-red-100 text-red-800" },
  view:           { label: "Visualização",       className: "bg-gray-100 text-gray-700" },
  export:         { label: "Exportação",         className: "bg-purple-100 text-purple-800" },
  approve:        { label: "Aprovação",          className: "bg-emerald-100 text-emerald-800" },
  reject:         { label: "Rejeição",           className: "bg-orange-100 text-orange-800" },
  login:          { label: "Login",              className: "bg-indigo-100 text-indigo-800" },
  logout:         { label: "Logout",             className: "bg-indigo-50 text-indigo-600" },
  access_request: { label: "Solicitação Acesso", className: "bg-yellow-100 text-yellow-800" },
  role_change:    { label: "Mudança de Papel",   className: "bg-pink-100 text-pink-800" },
};

const entityLabels: Record<string, string> = {
  data_asset:     "Ativo de Dados",
  access_request: "Solicitação de Acesso",
  participant:    "Participante",
  meeting:        "Reunião",
  domain:         "Domínio",
  glossary_term:  "Termo do Glossário",
  organization:   "Organização",
  user:           "Usuário",
};

function formatDate(d: string | Date) {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

// ─── Log Item ─────────────────────────────────────────────────────────────────
function LogRow({ log }: { log: any }) {
  const [expanded, setExpanded] = useState(false);
  const action = actionConfig[log.action] ?? { label: log.action, className: "bg-gray-100 text-gray-600" };

  return (
    <div className="border-b last:border-0 py-3 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3">
        {/* Ação */}
        <Badge className={`text-xs shrink-0 mt-0.5 ${action.className}`}>
          {action.label}
        </Badge>

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-gray-900">
              {log.userName ?? log.userEmail ?? `Usuário #${log.userId}`}
            </span>
            <ChevronRight className="h-3 w-3 text-gray-400" />
            <span className="text-gray-600">
              {entityLabels[log.entity] ?? log.entity}
              {log.entityName && <> — <span className="font-medium">{log.entityName}</span></>}
              {log.entityId && !log.entityName && <span className="text-gray-400"> #{log.entityId}</span>}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(log.createdAt)}
            </span>
            {log.ipAddress && (
              <span className="flex items-center gap-1">
                <Database className="h-3 w-3" />
                {log.ipAddress}
              </span>
            )}
          </div>

          {/* Detalhes expandíveis */}
          {log.details && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="mt-1 text-xs text-blue-600 hover:underline"
            >
              {expanded ? "Ocultar detalhes" : "Ver detalhes"}
            </button>
          )}
          {expanded && log.details && (
            <pre className="mt-2 p-2 bg-gray-50 border rounded text-xs text-gray-700 overflow-auto max-h-40 whitespace-pre-wrap">
              {typeof log.details === "string"
                ? log.details
                : JSON.stringify(log.details, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function AuditLog() {
  const { user } = useAuth();
  const [filterAction, setFilterAction] = useState("todos");
  const [filterEntity, setFilterEntity] = useState("todos");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  const { data: logs = [], isLoading, refetch } = trpc.auditLog.list.useQuery({
    action: filterAction !== "todos" ? filterAction : undefined,
    entity: filterEntity !== "todos" ? filterEntity : undefined,
    limit: LIMIT,
    offset,
  });

  // Filtro de busca local (por nome de usuário/entidade)
  const filtered = search.trim()
    ? logs.filter(l =>
        l.userName?.toLowerCase().includes(search.toLowerCase()) ||
        l.userEmail?.toLowerCase().includes(search.toLowerCase()) ||
        l.entityName?.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const handleExportCSV = () => {
    const headers = ["Data/Hora","Usuário","Email","Ação","Entidade","Nome Entidade","IP"];
    const rows = filtered.map(l => [
      formatDate(l.createdAt),
      l.userName ?? "",
      l.userEmail ?? "",
      l.action,
      l.entity,
      l.entityName ?? "",
      l.ipAddress ?? "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (user?.role !== "admin") {
    return (
      <div className="p-8 text-center text-gray-500">
        <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p className="font-medium">Acesso restrito a administradores</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-7 w-7 text-blue-600" />
            Log de Auditoria
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Rastreabilidade completa de todas as ações realizadas no portal
          </p>
        </div>
        <Button variant="outline" onClick={handleExportCSV} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Registros carregados", value: logs.length },
          { label: "Ações únicas", value: new Set(logs.map(l => l.action)).size },
          { label: "Usuários distintos", value: new Set(logs.map(l => l.userId).filter(Boolean)).size },
          { label: "Entidades distintas", value: new Set(logs.map(l => l.entity)).size },
        ].map(({ label, value }) => (
          <Card key={label} className="text-center py-3">
            <div className="text-2xl font-bold text-gray-800">{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Buscar por usuário ou entidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterAction} onValueChange={v => { setFilterAction(v); setOffset(0); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tipo de ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as ações</SelectItem>
            {Object.entries(actionConfig).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterEntity} onValueChange={v => { setFilterEntity(v); setOffset(0); }}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Tipo de entidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as entidades</SelectItem>
            {Object.entries(entityLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      <Card>
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-sm font-medium text-gray-600">
            {filtered.length} registro(s) — exibindo até {LIMIT} por vez
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 divide-y">
          {isLoading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              <Shield className="h-8 w-8 mx-auto mb-2 text-gray-200" />
              Nenhum registro encontrado
            </div>
          ) : (
            <div className="px-4">
              {filtered.map(log => (
                <LogRow key={log.id} log={log} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginação */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <Button
          variant="outline"
          size="sm"
          disabled={offset === 0}
          onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
        >
          ← Anterior
        </Button>
        <span>Página {Math.floor(offset / LIMIT) + 1}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={logs.length < LIMIT}
          onClick={() => setOffset(o => o + LIMIT)}
        >
          Próxima →
        </Button>
      </div>
    </div>
  );
}
