import { beforeEach, describe, expect, it, vi } from "vitest";
import { metadataCollector } from "./metadataCollector";

const mocks = vi.hoisted(() => ({
  SecretClient: vi.fn(),
  DefaultAzureCredential: vi.fn(),
}));

vi.mock("@azure/identity", () => ({
  DefaultAzureCredential: mocks.DefaultAzureCredential,
}));

vi.mock("@azure/keyvault-secrets", () => ({
  SecretClient: mocks.SecretClient,
}));

type StatementFixture = {
  columns: string[];
  rows: unknown[][];
};

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as Response;
}

function configureRest(statements: StatementFixture[], warehouses = [{ id: "warehouse-1", name: "Warehouse 1", state: "RUNNING" }]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/api/2.0/sql/warehouses")) {
      return jsonResponse({ warehouses });
    }

    if (url.includes("/api/2.0/sql/statements") && init?.method === "POST") {
      const fixture = statements.shift() ?? { columns: [], rows: [] };
      return jsonResponse({
        statement_id: `statement-${statements.length}`,
        status: { state: "SUCCEEDED" },
        manifest: { schema: { columns: fixture.columns.map((name) => ({ name })) } },
        result: { data_array: fixture.rows },
      });
    }

    throw new Error(`Endpoint REST inesperado no teste: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("crawler Databricks via Statement Execution API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", vi.fn());
    delete process.env.DATABRICKS_TOKEN;
    delete process.env.AZURE_KEY_VAULT_URL;
    delete process.env.AZURE_KEYVAULT_URL;
    delete process.env.DATABRICKS_WAREHOUSE_ID;
    mocks.DefaultAzureCredential.mockImplementation(() => ({}));
  });

  it("retorna CONFIG_MISSING quando não há token, Key Vault ou identidade Azure disponível", async () => {
    await expect(
      metadataCollector.crawlDatabricks({
        host: "adb.example.azuredatabricks.net",
        catalog: "main",
      }),
    ).rejects.toMatchObject({
      name: "DatabricksCrawlerError",
      code: "CONFIG_MISSING",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retorna CONNECTION_FAILED sem expor o token quando a listagem de warehouses falha", async () => {
    const token = "dapi-test-token-that-must-not-leak";
    const fetchMock = vi.fn().mockRejectedValue(new Error(`authentication failed for ${token}`));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      metadataCollector.crawlDatabricks({
        host: "adb.example.azuredatabricks.net",
        token,
        catalog: "main",
      }),
    ).rejects.toSatisfy((error: Error & { code?: string }) => {
      expect(error.name).toBe("DatabricksCrawlerError");
      expect(error.code).toBe("CONNECTION_FAILED");
      expect(error.message).not.toContain(token);
      return true;
    });
  });

  it("replica a resolução via Key Vault e envia o token somente no header da requisição", async () => {
    const token = "dapi-key-vault-token";
    const getSecret = vi.fn().mockResolvedValue({ value: token });
    mocks.SecretClient.mockImplementation((url: string, credential: unknown) => ({ getSecret, url, credential }));
    const fetchMock = configureRest([
      { columns: ["databaseName"], rows: [["sales"]] },
      { columns: ["database", "tableName", "isTemporary"], rows: [] },
    ]);

    const result = await metadataCollector.crawlDatabricks({
      host: "adb.example.azuredatabricks.net",
      useKeyVault: "true",
      keyVaultUrl: "https://vault.example.vault.azure.net",
      keyVaultSecretName: "Databricks-AccessToken",
      catalog: "main",
    });

    expect(result).toEqual({ tables: [], errors: [], connectorUsed: "real" });
    expect(mocks.SecretClient).toHaveBeenCalledWith("https://vault.example.vault.azure.net", expect.anything());
    expect(getSecret).toHaveBeenCalledWith("Databricks-AccessToken");
    const warehouseRequest = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/api/2.0/sql/warehouses"));
    expect((warehouseRequest?.[1]?.headers as Headers | undefined)?.get("Authorization")).toBe(`Bearer ${token}`);
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it("usa o fallback Azure AD quando a leitura do Key Vault falha", async () => {
    const token = "azure-ad-token";
    const getSecret = vi.fn().mockRejectedValue(new Error("Key Vault indisponível"));
    const getToken = vi.fn().mockResolvedValue({ token });
    mocks.SecretClient.mockImplementation(() => ({ getSecret }));
    mocks.DefaultAzureCredential.mockImplementation(() => ({ getToken }));
    configureRest([
      { columns: ["databaseName"], rows: [["sales"]] },
      { columns: ["database", "tableName", "isTemporary"], rows: [] },
    ]);

    const result = await metadataCollector.crawlDatabricks({
      host: "adb.example.azuredatabricks.net",
      useKeyVault: true,
      keyVaultUrl: "https://vault.example.vault.azure.net",
      catalog: "main",
    });

    expect(result.connectorUsed).toBe("real");
    expect(getToken).toHaveBeenCalledWith("2ff814a6-3304-4ab8-85cb-cd0e6f879c1d/.default");
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it("retorna uma coleta real válida mesmo quando o catálogo não possui ativos", async () => {
    const fetchMock = configureRest([
      { columns: ["databaseName"], rows: [["sales"]] },
      { columns: ["database", "tableName", "isTemporary"], rows: [] },
    ]);

    const result = await metadataCollector.crawlDatabricks({
      host: "https://adb.example.azuredatabricks.net/",
      token: "dapi-real-token",
      catalog: "main",
    });

    expect(result).toEqual({ tables: [], errors: [], connectorUsed: "real" });
    const warehouseRequest = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/api/2.0/sql/warehouses"));
    expect((warehouseRequest?.[1]?.headers as Headers | undefined)?.get("Authorization")).toBe("Bearer dapi-real-token");
  });

  it("retorna ativos e colunas reais quando as consultas do catálogo têm dados", async () => {
    configureRest([
      { columns: ["databaseName"], rows: [["sales"]] },
      { columns: ["database", "tableName", "isTemporary"], rows: [["sales", "orders", "false"]] },
      { columns: ["comment"], rows: [["Pedidos de clientes"]] },
      {
        columns: ["column_name", "data_type", "comment"],
        rows: [
          ["order_id", "bigint", "Identificador"],
          ["created_at", "timestamp", "Data de criação"],
        ],
      },
    ]);

    const result = await metadataCollector.crawlDatabricks({
      host: "adb.example.azuredatabricks.net",
      token: "dapi-real-token",
      catalog: "main",
    });

    expect(result.connectorUsed).toBe("real");
    expect(result.errors).toEqual([]);
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0]).toMatchObject({
      name: "sales.orders",
      source: "Databricks",
      catalog: "main",
      description: "Pedidos de clientes",
      columns: [
        { name: "order_id", type: "BIGINT", description: "Identificador" },
        { name: "created_at", type: "TIMESTAMP", description: "Data de criação" },
      ],
    });
  });
});
