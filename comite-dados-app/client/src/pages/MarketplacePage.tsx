import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Plus, Trash2, Play, CheckCircle, XCircle, Loader2, Settings, RefreshCw } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

type CatalogEntry = {
  type: string;
  name: string;
  description: string;
  category: string;
  icon: string;
};

type ConnectorConfig = {
  id: number;
  connectorType: string;
  name: string;
  configJson: unknown;
  active: boolean;
  lastTestedAt: Date | null;
  lastTestSuccess: boolean | null;
  lastTestMessage: string | null;
  createdById: number | null;
  createdAt: Date;
  updatedAt: Date;
};

const CATEGORY_LABELS: Record<string, string> = {
  database: "Banco Relacional",
  nosql: "NoSQL",
  cloud: "Cloud / Data Warehouse",
  etl: "ETL / Orquestração",
  bi: "BI / Visualização",
  api: "API",
};

const CATEGORY_COLORS: Record<string, string> = {
  database: "bg-blue-100 text-blue-800",
  nosql: "bg-green-100 text-green-800",
  cloud: "bg-purple-100 text-purple-800",
  etl: "bg-orange-100 text-orange-800",
  bi: "bg-pink-100 text-pink-800",
  api: "bg-gray-100 text-gray-800",
};

function ConfigField({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function getDefaultConfig(connectorType: string): Record<string, string> {
  switch (connectorType) {
    case "mysql":
    case "postgresql":
    case "mssql":
    case "oracle":
    case "sap_hana":
    case "mongodb":
      return { host: "", port: "", database: "", user: "", password: "" };
    case "snowflake":
      return { account: "", database: "", schema: "", warehouse: "", user: "", password: "" };
    case "bigquery":
      return { projectId: "", dataset: "", keyFileJson: "" };
    case "databricks":
      return {
        host: "",
        token: "",
        httpPath: "",
        catalog: "",
        useKeyVault: "false",
        keyVaultSecretName: "Databricks-AccessToken",
      };
    case "s3":
      return { bucket: "", region: "", accessKeyId: "", secretAccessKey: "" };
    case "dbt":
      return { manifestPath: "" };
    case "airflow":
      return { baseUrl: "", username: "", password: "" };
    case "power_bi":
      return { tenantId: "", clientId: "", clientSecret: "" };
    case "tableau":
      return { serverUrl: "", siteName: "", token: "" };
    case "rest_api":
      return { baseUrl: "", authHeader: "", extraHeaders: "" };
    default:
      return { url: "" };
  }
}

function ConnectorConfigForm({
  connectorType,
  value,
  onChange,
}: {
  connectorType: string;
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const set = (k: string, v: string) => onChange({ ...value, [k]: v });

  const field = (label: string, key: string, opts?: { type?: string; placeholder?: string }) => (
    <ConfigField
      key={key}
      label={label}
      name={key}
      value={value[key] ?? ""}
      onChange={(v) => set(key, v)}
      type={opts?.type}
      placeholder={opts?.placeholder}
    />
  );

  switch (connectorType) {
    case "mysql":
    case "postgresql":
    case "mssql":
      return (
        <div className="grid grid-cols-2 gap-3">
          {field("Host", "host", { placeholder: "localhost" })}
          {field("Porta", "port", { placeholder: connectorType === "postgresql" ? "5432" : connectorType === "mssql" ? "1433" : "3306" })}
          {field("Banco de dados", "database")}
          {field("Usuário", "user")}
          {field("Senha", "password", { type: "password" })}
        </div>
      );
    case "oracle":
    case "sap_hana":
      return (
        <div className="grid grid-cols-2 gap-3">
          {field("Host", "host")}
          {field("Porta", "port")}
          {field("Banco / Schema", "database")}
          {field("Usuário", "user")}
          {field("Senha", "password", { type: "password" })}
        </div>
      );
    case "mongodb":
      return (
        <div className="grid grid-cols-2 gap-3">
          {field("Host", "host", { placeholder: "localhost" })}
          {field("Porta", "port", { placeholder: "27017" })}
          {field("Database", "database")}
          {field("Usuário", "user")}
          {field("Senha", "password", { type: "password" })}
        </div>
      );
    case "snowflake":
      return (
        <div className="grid grid-cols-2 gap-3">
          {field("Account", "account", { placeholder: "xyz123.us-east-1" })}
          {field("Warehouse", "warehouse")}
          {field("Database", "database")}
          {field("Schema", "schema")}
          {field("Usuário", "user")}
          {field("Senha", "password", { type: "password" })}
        </div>
      );
    case "bigquery":
      return (
        <div className="space-y-3">
          {field("Project ID", "projectId")}
          {field("Dataset", "dataset")}
          <div className="space-y-1">
            <Label>Service Account JSON</Label>
            <Textarea
              rows={4}
              value={value["keyFileJson"] ?? ""}
              onChange={(e) => set("keyFileJson", e.target.value)}
              placeholder='{"type": "service_account", ...}'
            />
          </div>
        </div>
      );
    case "databricks": {
      const useKeyVault = value.useKeyVault === "true";
      return (
        <div className="space-y-3">
          {field("Host", "host", { placeholder: "adb-2338706343670020.0.azuredatabricks.net" })}
          {field("HTTP Path do Warehouse", "httpPath", { placeholder: "/sql/1.0/warehouses/2ee65d6f13ec811a" })}
          {field("Catálogo", "catalog", { placeholder: "casas_bahia_mvp" })}
          <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              checked={useKeyVault}
              onChange={(e) => set("useKeyVault", String(e.target.checked))}
            />
            <span>Usar token armazenado no Azure Key Vault</span>
          </label>
          {useKeyVault ? (
            <>
              {field("Nome do segredo no Key Vault", "keyVaultSecretName", { placeholder: "Databricks-AccessToken" })}
              <p className="text-xs text-muted-foreground">
                O token será lido no servidor usando DefaultAzureCredential; ele não é enviado nem armazenado neste formulário.
              </p>
            </>
          ) : (
            field("Token (PAT)", "token", { type: "password" })
          )}
        </div>
      );
    }
    case "s3":
      return (
        <div className="grid grid-cols-2 gap-3">
          {field("Bucket", "bucket")}
          {field("Região", "region", { placeholder: "us-east-1" })}
          {field("Access Key ID", "accessKeyId")}
          {field("Secret Access Key", "secretAccessKey", { type: "password" })}
        </div>
      );
    case "dbt":
      return (
        <div className="space-y-3">
          {field("Caminho do manifest.json", "manifestPath", { placeholder: "/path/to/target/manifest.json" })}
        </div>
      );
    case "airflow":
      return (
        <div className="space-y-3">
          {field("URL Base", "baseUrl", { placeholder: "http://airflow:8080" })}
          {field("Usuário", "username")}
          {field("Senha", "password", { type: "password" })}
        </div>
      );
    case "power_bi":
      return (
        <div className="space-y-3">
          {field("Tenant ID", "tenantId")}
          {field("Client ID", "clientId")}
          {field("Client Secret", "clientSecret", { type: "password" })}
        </div>
      );
    case "tableau":
      return (
        <div className="space-y-3">
          {field("URL do servidor", "serverUrl", { placeholder: "https://tableau.empresa.com" })}
          {field("Site Name", "siteName")}
          {field("Token (Personal Access Token)", "token", { type: "password" })}
        </div>
      );
    case "rest_api":
      return (
        <div className="space-y-3">
          {field("URL Base", "baseUrl", { placeholder: "https://api.exemplo.com" })}
          {field("Authorization header", "authHeader", { placeholder: "Bearer <token>" })}
          {field("Headers extras (JSON)", "extraHeaders", { placeholder: '{"X-Custom": "valor"}' })}
        </div>
      );
    default:
      return (
        <div className="space-y-3">
          {field("URL de conexão", "url")}
        </div>
      );
  }
}

export default function MarketplacePage() {
  const { t } = useI18n();

  const { data: catalog = [] } = trpc.connectors.catalog.useQuery();
  const { data: installed = [], refetch } = trpc.connectors.list.useQuery();

  const createMut = trpc.connectors.create.useMutation();
  const updateMut = trpc.connectors.update.useMutation();
  const deleteMut = trpc.connectors.delete.useMutation();
  const testMut = trpc.connectors.test.useMutation();
  const syncMut = trpc.connectors.sync.useMutation();

  const [installDialog, setInstallDialog] = useState<CatalogEntry | null>(null);
  const [editDialog, setEditDialog] = useState<ConnectorConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ConnectorConfig | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);

  const [formName, setFormName] = useState("");
  const [formConfig, setFormConfig] = useState<Record<string, string>>({});

  function openInstall(entry: CatalogEntry) {
    setFormName(entry.name);
    setFormConfig(getDefaultConfig(entry.type));
    setInstallDialog(entry);
  }

  function openEdit(c: ConnectorConfig) {
    setFormName(c.name);
    const configAsStrings = Object.fromEntries(
      Object.entries(c.configJson as Record<string, unknown>).map(([k, v]) => [k, v == null ? "" : String(v)])
    );
    setFormConfig(configAsStrings);
    setEditDialog(c);
  }

  async function handleEdit() {
    if (!editDialog) return;
    try {
      await updateMut.mutateAsync({
        id: editDialog.id,
        name: formName,
        configJson: formConfig,
      });
      toast.success("Conector atualizado com sucesso!");
      setEditDialog(null);
      refetch();
    } catch {
      toast.error("Erro ao atualizar conector");
    }
  }

  async function handleInstall() {
    if (!installDialog) return;
    try {
      await createMut.mutateAsync({
        connectorType: installDialog.type,
        name: formName,
        configJson: formConfig,
      });
      toast.success("Conector instalado com sucesso!");
      setInstallDialog(null);
      refetch();
    } catch {
      toast.error("Erro ao instalar conector");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync({ id: deleteTarget.id });
      toast.success("Conector removido.");
      setDeleteTarget(null);
      refetch();
    } catch {
      toast.error("Erro ao remover conector");
    }
  }

  async function handleTest(id: number) {
    setTestingId(id);
    try {
      const result = await testMut.mutateAsync({ id });
      if (result.success) {
        toast.success("Conexão bem-sucedida!", { description: result.message });
      } else {
        toast.error("Falha na conexão", { description: result.message });
      }
      refetch();
    } catch {
      toast.error("Erro ao testar conexão");
    } finally {
      setTestingId(null);
    }
  }

  async function handleSync(id: number) {
    setSyncingId(id);
    try {
      const result = await syncMut.mutateAsync({ id });
      if (result.success) {
        toast.success("Sincronização concluída!", { description: result.message });
      } else {
        toast.error("Falha na sincronização", { description: result.message });
      }
      refetch();
    } catch {
      toast.error("Erro ao sincronizar metadados");
    } finally {
      setSyncingId(null);
    }
  }

  const installedTypes = new Set(installed.map((c: ConnectorConfig) => c.connectorType));

  const categoryGroups = catalog.reduce<Record<string, CatalogEntry[]>>((acc, entry) => {
    const cat = entry.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(entry as CatalogEntry);
    return acc;
  }, {});

  return (
    <>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("nav.marketplace")}</h1>
          <p className="text-gray-500 mt-1">
            Instale e configure conectores para integrar fontes de dados externas ao catálogo.
          </p>
        </div>

        {/* Conectores Instalados */}
        {installed.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-700 mb-3">Conectores instalados</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {installed.map((c: ConnectorConfig) => {
                const catalogEntry = catalog.find((e) => e.type === c.connectorType);
                const isTestingThis = testingId === c.id;
                const isSyncingThis = syncingId === c.id;
                return (
                  <Card key={c.id} className="border-2 border-blue-200 bg-blue-50/30">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{catalogEntry?.icon ?? "🔌"}</span>
                          <div>
                            <CardTitle className="text-base">{c.name}</CardTitle>
                            <CardDescription className="text-xs">{catalogEntry?.name ?? c.connectorType}</CardDescription>
                          </div>
                        </div>
                        <Badge className="shrink-0 bg-blue-600 text-white text-xs">Instalado</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Status do último teste */}
                      {c.lastTestedAt && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {c.lastTestSuccess ? (
                            <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          )}
                          <span className="break-words min-w-0">{c.lastTestMessage ?? (c.lastTestSuccess ? "OK" : "Falhou")}</span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          disabled={isTestingThis}
                          onClick={() => handleTest(c.id)}
                        >
                          {isTestingThis ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5 mr-1" />
                          )}
                          Testar
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex-1"
                          disabled={isSyncingThis}
                          onClick={() => handleSync(c.id)}
                        >
                          {isSyncingThis ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5 mr-1" />
                          )}
                          Coletar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(c)}
                          title="Editar configuração"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteTarget(c)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Catálogo por categoria */}
        {Object.entries(categoryGroups).map(([category, entries]) => (
          <section key={category}>
            <h2 className="text-lg font-semibold text-gray-700 mb-3">
              {CATEGORY_LABELS[category] ?? category}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {entries.map((entry) => {
                const isInstalled = installedTypes.has(entry.type);
                const installedConfig = installed.find((c: ConnectorConfig) => c.connectorType === entry.type);
                return (
                  <Card
                    key={entry.type}
                    className={isInstalled ? "opacity-60" : "hover:shadow-md transition-shadow"}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{entry.icon}</span>
                          <div>
                            <CardTitle className="text-base">{entry.name}</CardTitle>
                            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${CATEGORY_COLORS[entry.category] ?? "bg-gray-100 text-gray-700"}`}>
                              {CATEGORY_LABELS[entry.category] ?? entry.category}
                            </span>
                          </div>
                        </div>
                        {isInstalled && <Badge variant="secondary" className="shrink-0 text-xs">Instalado</Badge>}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-gray-600">{entry.description}</p>
                      {!isInstalled ? (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => openInstall(entry)}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Instalar
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            disabled={testingId === installedConfig?.id}
                            onClick={() => installedConfig && handleTest(installedConfig.id)}
                          >
                            {testingId === installedConfig?.id ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                            ) : (
                              <Play className="w-3.5 h-3.5 mr-1" />
                            )}
                            Testar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => installedConfig && openEdit(installedConfig)}
                            title="Editar configuração"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => installedConfig && setDeleteTarget(installedConfig)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Dialog — Instalar conector */}
      <Dialog open={!!installDialog} onOpenChange={(open) => !open && setInstallDialog(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {installDialog?.icon} Instalar {installDialog?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nome da conexão</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            {installDialog && (
              <ConnectorConfigForm
                connectorType={installDialog.type}
                value={formConfig}
                onChange={setFormConfig}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInstallDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleInstall} disabled={createMut.isPending}>
              {createMut.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Instalar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Editar conector */}
      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <Settings className="inline w-4 h-4 mr-2" />
              Editar conector
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nome da conexão</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            {editDialog && (
              <ConnectorConfigForm
                connectorType={editDialog.connectorType}
                value={formConfig}
                onChange={setFormConfig}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={updateMut.isPending}>
              {updateMut.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Settings className="w-4 h-4 mr-1" />}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog — Remover conector */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover conector?</AlertDialogTitle>
            <AlertDialogDescription>
              O conector <strong>{deleteTarget?.name}</strong> será removido. As configurações de conexão serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
