import VCLayout from "@/components/VCLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Shield, CheckCircle2, XCircle, Loader2, Eye, EyeOff, Info, Zap, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Connect() {
  const [, navigate] = useLocation();
  const [host, setHost] = useState("");
  const [token, setToken] = useState("");
  const [catalog, setCatalog] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("databricks_config");
      if (stored) {
        const config = JSON.parse(stored);
        if (config.host) setHost(config.host);
        if (config.token) setToken(config.token);
        if (config.catalog) setCatalog(config.catalog);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const testConn = trpc.auditoria.databricks.testConnection.useMutation({
    onMutate: () => setTestStatus("testing"),
    onSuccess: (data) => {
      if (data.ok) {
        setTestStatus("ok");
        setTestMessage(data.message);
        
        let cleanHost = host.trim();
        cleanHost = cleanHost.replace(/^(https?:\/\/)+/, "https://");
        cleanHost = cleanHost.replace(/^https?\/\//, "https://");
        if (!cleanHost.startsWith("http://") && !cleanHost.startsWith("https://")) {
          cleanHost = "https://" + cleanHost;
        }

        localStorage.setItem('databricks_config', JSON.stringify({
          host: cleanHost,
          token: token.trim(),
          catalog: catalog.trim(),
        }));
        setHost(cleanHost);
        toast.success("Conexão estabelecida com sucesso!");
      } else {
        setTestStatus("error");
        setTestMessage(data.message);
        toast.error("Falha na conexão: " + data.message);
      }
    },
    onError: (e) => {
      setTestStatus("error");
      setTestMessage(e.message);
      toast.error("Erro ao testar conexão");
    },
  });

  const startAudit = trpc.auditoria.databricks.startAudit.useMutation({
    onSuccess: (data) => {
      // Save configuration to localStorage
      localStorage.setItem('databricks_config', JSON.stringify({
        host: host.trim(),
        token: token.trim(),
        catalog: catalog.trim(),
      }));
      localStorage.setItem('last_audit_session_id', String(data.sessionId));
      toast.success("Auditoria concluída!");
      navigate(`/auditoria/report/${data.sessionId}`);
    },
    onError: (e) => {
      toast.error("Erro ao executar auditoria: " + e.message);
    },
  });

  const handleTest = () => {
    if (!host || !token || !catalog) {
      toast.error("Preencha todos os campos antes de testar a conexão");
      return;
    }
    testConn.mutate({ host: host.trim(), token: token.trim(), catalog: catalog.trim() });
  };

  const handleStart = async () => {
    if (!host || !token || !catalog) {
      toast.error("Preencha todos os campos");
      return;
    }
    // Se o usuário não testou previamente ou mudou os campos, realizar uma pré-conexão ou simplesmente disparar a auditoria diretamente
    startAudit.mutate({ host: host.trim(), token: token.trim(), catalog: catalog.trim() });
  };

  const isRunning = startAudit.isPending;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-10 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center shadow-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">Nova Auditoria</h1>
              <p className="text-sm text-muted-foreground">Configurar conexão com Databricks Unity Catalog</p>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl animate-fade-in-up" style={{ animationDelay: "60ms" }}>
          <div className="space-y-6">
            {/* Host */}
            <div className="space-y-2">
              <Label htmlFor="host" className="text-sm font-semibold text-foreground">
                Databricks Host <span className="text-destructive">*</span>
              </Label>
              <Input
                id="host"
                placeholder="https://adb-xxxxxxxxxxxx.azuredatabricks.net"
                value={host}
                onChange={(e) => { setHost(e.target.value); setTestStatus("idle"); }}
                className="bg-input border-border h-11 rounded-lg font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Info className="w-3 h-3" />
                URL completa do workspace Databricks (AWS, Azure ou GCP)
              </p>
            </div>

            {/* Token */}
            <div className="space-y-2">
              <Label htmlFor="token" className="text-sm font-semibold text-foreground">
                Token de Acesso Pessoal <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="token"
                  type={showToken ? "text" : "password"}
                  placeholder="dapi••••••••••••••••••••••••••••••••"
                  value={token}
                  onChange={(e) => { setToken(e.target.value); setTestStatus("idle"); }}
                  className="bg-input border-border h-11 rounded-lg font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Info className="w-3 h-3" />
                User Settings → Developer → Access Tokens no Databricks
              </p>
            </div>

            {/* Catalog */}
            <div className="space-y-2">
              <Label htmlFor="catalog" className="text-sm font-semibold text-foreground">
                Catálogo Alvo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="catalog"
                placeholder="main"
                value={catalog}
                onChange={(e) => { setCatalog(e.target.value); setTestStatus("idle"); }}
                className="bg-input border-border h-11 rounded-lg font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Info className="w-3 h-3" />
                Nome do catálogo no Unity Catalog a ser auditado
              </p>
            </div>

            {/* Test Connection Status */}
            {testStatus !== "idle" && (
              <div className={cn(
                "flex items-start gap-3 p-4 rounded-lg border text-sm animate-fade-in-up",
                testStatus === "testing" && "bg-muted/30 border-border text-muted-foreground",
                testStatus === "ok" && "bg-success/10 border-success/30 text-success",
                testStatus === "error" && "bg-destructive/10 border-destructive/30 text-destructive",
              )}>
                {testStatus === "testing" && <Loader2 className="w-4 h-4 mt-0.5 animate-spin flex-shrink-0" />}
                {testStatus === "ok" && <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                {testStatus === "error" && <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                <span>{testStatus === "testing" ? "Testando conectividade..." : testMessage}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={testConn.isPending || isRunning || !host || !token || !catalog}
                className="flex-1 h-11 border-border hover:border-gold/40 hover:text-gold"
              >
                {testConn.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Testando...</>
                ) : (
                  <><Zap className="w-4 h-4 mr-2" />Testar Conexão</>
                )}
              </Button>
              <Button
                onClick={handleStart}
                disabled={testStatus !== "ok" || isRunning}
                className="flex-1 h-11 gradient-gold text-white font-semibold rounded-lg shadow-lg hover:shadow-gold/30 transition-shadow disabled:opacity-50"
              >
                {isRunning ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Executando Análises...</>
                ) : (
                  <>Iniciar Auditoria <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Progress indicator when running */}
        {isRunning && (
          <div className="mt-6 bg-card border border-gold/20 rounded-xl p-6 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full gradient-gold flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">Executando as 6 análises...</p>
                <p className="text-xs text-muted-foreground">Isso pode levar alguns minutos dependendo do tamanho do catálogo</p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                "Mapeamento de Estrutura",
                "Glossário de Dados",
                "Classificação por Tags",
                "Políticas de Acesso",
                "Linhagem de Dados",
                "Segurança Dinâmica",
              ].map((name, i) => (
                <div key={name} className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-gold/40 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                  {name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info box */}
        <div className="mt-6 p-5 rounded-xl bg-muted/30 border border-border animate-fade-in-up" style={{ animationDelay: "120ms" }}>
          <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-gold" />
            Permissões necessárias
          </p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• <code className="text-gold/80 font-mono">USE CATALOG</code> e <code className="text-gold/80 font-mono">USE SCHEMA</code> no catálogo alvo</li>
            <li>• <code className="text-gold/80 font-mono">SELECT</code> em tabelas do <code className="text-gold/80 font-mono">system.information_schema</code></li>
            <li>• <code className="text-gold/80 font-mono">SELECT</code> em <code className="text-gold/80 font-mono">system.access.table_lineage</code> (Análise 5)</li>
            <li>• Acesso a pelo menos um SQL Warehouse ativo</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
