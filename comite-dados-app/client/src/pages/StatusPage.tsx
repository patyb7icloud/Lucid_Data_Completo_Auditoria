import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Database, Clock, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Server } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface HealthData {
  status: "ok" | "degraded";
  uptime: number;
  db: { ok: boolean; latencyMs: number };
  version: string;
  env: string;
  timestamp: string;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function StatusIcon({ ok }: { ok: boolean }) {
  if (ok) return <CheckCircle2 className="w-5 h-5 text-green-500" />;
  return <XCircle className="w-5 h-5 text-red-500" />;
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  async function fetchHealth() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealth(data);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError("Não foi possível contactar o servidor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHealth();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const statusColor = health?.status === "ok"
    ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
    : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Status do Sistema
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoramento de saúde e disponibilidade dos serviços
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh((v) => !v)}
            className={autoRefresh ? "border-green-500 text-green-600" : ""}
          >
            {autoRefresh ? "Auto-refresh: ON" : "Auto-refresh: OFF"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchHealth} disabled={loading} className="gap-1.5">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-800 dark:text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Status geral */}
      {health && (
        <>
          <div className={`rounded-xl border p-5 flex items-center justify-between ${statusColor}`}>
            <div className="flex items-center gap-3">
              <StatusIcon ok={health.status === "ok"} />
              <div>
                <p className="font-semibold text-lg">{health.status === "ok" ? "Todos os sistemas operacionais" : "Sistema degradado"}</p>
                <p className="text-sm opacity-80">Última verificação: {format(lastRefresh, "HH:mm:ss", { locale: ptBR })}</p>
              </div>
            </div>
            <Badge className="text-sm px-3 py-1" variant="outline">
              v{health.version} · {health.env}
            </Badge>
          </div>

          {/* Cards de métricas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Server className="w-4 h-4" /> Servidor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <StatusIcon ok={true} />
                  <span className="font-semibold text-lg">Online</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Ambiente: <strong>{health.env}</strong></p>
                <p className="text-sm text-muted-foreground">Versão: <strong>{health.version}</strong></p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Database className="w-4 h-4" /> Banco de Dados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <StatusIcon ok={health.db.ok} />
                  <span className="font-semibold text-lg">{health.db.ok ? "Conectado" : "Desconectado"}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Latência: <strong className={health.db.latencyMs > 500 ? "text-amber-600" : "text-green-600"}>{health.db.latencyMs}ms</strong>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Uptime
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold text-lg">{formatUptime(health.uptime)}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Iniciado em: <strong>{format(new Date(Date.now() - health.uptime * 1000), "dd/MM HH:mm", { locale: ptBR })}</strong>
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Endpoints de monitoramento */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Endpoints de Monitoramento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { path: "/api/health", desc: "Health check (JSON) — compatível com load balancers e k8s liveness probe", auth: "Público" },
                { path: "/api/prometheus", desc: "Métricas no formato Prometheus text — integrar com Grafana / AlertManager", auth: "Público" },
                { path: "/api/v1/openapi.json", desc: "Especificação OpenAPI 3.0 da API pública", auth: "Público" },
                { path: "/api/v1/docs", desc: "Swagger UI interativo", auth: "Público" },
              ].map((ep) => (
                <div key={ep.path} className="flex items-start justify-between gap-4 py-2 border-b last:border-0">
                  <div>
                    <code className="text-sm font-mono bg-muted px-1.5 py-0.5 rounded">{ep.path}</code>
                    <p className="text-sm text-muted-foreground mt-0.5">{ep.desc}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{ep.auth}</Badge>
                    <a
                      href={ep.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline underline-offset-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Abrir
                    </a>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Timestamp */}
          <p className="text-xs text-muted-foreground text-right">
            Timestamp do servidor: {health.timestamp}
          </p>
        </>
      )}

      {loading && !health && (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Verificando status...
        </div>
      )}
    </div>
  );
}
