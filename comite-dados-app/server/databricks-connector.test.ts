import { beforeEach, describe, expect, it, vi } from "vitest";
import { metadataCollector } from "./metadataCollector";

const mocks = vi.hoisted(() => ({
  DBSQLClient: vi.fn(),
  SecretClient: vi.fn(),
  DefaultAzureCredential: vi.fn(),
  connect: vi.fn(),
  openSession: vi.fn(),
  closeClient: vi.fn(),
  closeSession: vi.fn(),
  executeStatement: vi.fn(),
}));

vi.mock("@databricks/sql", () => ({
  DBSQLClient: mocks.DBSQLClient,
}));

vi.mock("@azure/identity", () => ({
  DefaultAzureCredential: mocks.DefaultAzureCredential,
}));

vi.mock("@azure/keyvault-secrets", () => ({
  SecretClient: mocks.SecretClient,
}));

function configureClient(queryResults: Array<unknown[]>) {
  let queryIndex = 0;
  mocks.connect.mockResolvedValue(undefined);
  mocks.closeClient.mockResolvedValue(undefined);
  mocks.closeSession.mockResolvedValue(undefined);
  mocks.executeStatement.mockImplementation(async () => ({
    fetchAll: vi.fn().mockResolvedValue(queryResults[queryIndex++] ?? []),
    close: vi.fn().mockResolvedValue(undefined),
  }));
  mocks.openSession.mockResolvedValue({
    executeStatement: mocks.executeStatement,
    close: mocks.closeSession,
  });
  mocks.DBSQLClient.mockImplementation(() => ({
    connect: mocks.connect,
    openSession: mocks.openSession,
    close: mocks.closeClient,
  }));
}

describe("crawler Databricks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    delete process.env.DATABRICKS_TOKEN;
    delete process.env.AZURE_KEY_VAULT_URL;
  });

  it("retorna CONFIG_MISSING quando não há token nem Key Vault configurado", async () => {
    await expect(
      metadataCollector.crawlDatabricks({
        host: "adb.example.azuredatabricks.net",
        httpPath: "/sql/1.0/warehouses/test",
        catalog: "main",
      }),
    ).rejects.toMatchObject({
      name: "DatabricksCrawlerError",
      code: "CONFIG_MISSING",
    });
    expect(mocks.DBSQLClient).not.toHaveBeenCalled();
  });

  it("retorna CONNECTION_FAILED sem expor o token quando o SQL Warehouse falha", async () => {
    const token = "dapi-test-token-that-must-not-leak";
    mocks.connect.mockRejectedValue(new Error(`authentication failed for ${token}`));
    mocks.DBSQLClient.mockImplementation(() => ({
      connect: mocks.connect,
      openSession: mocks.openSession,
      close: mocks.closeClient,
    }));

    await expect(
      metadataCollector.crawlDatabricks({
        host: "adb.example.azuredatabricks.net",
        httpPath: "/sql/1.0/warehouses/test",
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

  it("resolve o token via Azure Key Vault sem incluir o segredo no resultado", async () => {
    const getSecret = vi.fn().mockResolvedValue({ value: "dapi-key-vault-token" });
    mocks.SecretClient.mockImplementation((url: string, credential: unknown) => ({
      getSecret,
      url,
      credential,
    }));
    mocks.DefaultAzureCredential.mockImplementation(() => ({}));
    configureClient([[], []]);

    const result = await metadataCollector.crawlDatabricks({
      host: "adb.example.azuredatabricks.net",
      httpPath: "/sql/1.0/warehouses/test",
      useKeyVault: "true",
      keyVaultUrl: "https://vault.example.vault.azure.net",
      keyVaultSecretName: "Databricks-AccessToken",
      catalog: "main",
    });

    expect(result.connectorUsed).toBe("real");
    expect(mocks.SecretClient).toHaveBeenCalledWith(
      "https://vault.example.vault.azure.net",
      expect.anything(),
    );
    expect(getSecret).toHaveBeenCalledWith("Databricks-AccessToken");
    expect(mocks.connect).toHaveBeenCalledWith(expect.objectContaining({ token: "dapi-key-vault-token" }));
    expect(JSON.stringify(result)).not.toContain("dapi-key-vault-token");
  });

  it("retorna uma coleta real válida mesmo quando o catálogo não possui ativos", async () => {
    configureClient([
      [{ databaseName: "sales" }],
      [],
    ]);

    const result = await metadataCollector.crawlDatabricks({
      host: "https://adb.example.azuredatabricks.net/",
      httpPath: "/sql/1.0/warehouses/test",
      token: "dapi-real-token",
      catalog: "main",
    });

    expect(result).toEqual({ tables: [], errors: [], connectorUsed: "real" });
    expect(mocks.connect).toHaveBeenCalledWith({
      host: "adb.example.azuredatabricks.net",
      path: "/sql/1.0/warehouses/test",
      token: "dapi-real-token",
    });
  });

  it("retorna ativos e colunas reais quando a consulta do catálogo tem dados", async () => {
    configureClient([
      [{ databaseName: "sales" }],
      [{ tableName: "orders", isTemporary: false }],
      [{ comment: "Pedidos de clientes" }],
      [
        { column_name: "order_id", data_type: "bigint", comment: "Identificador" },
        { column_name: "created_at", data_type: "timestamp", comment: "Data de criação" },
      ],
    ]);

    const result = await metadataCollector.crawlDatabricks({
      host: "adb.example.azuredatabricks.net",
      httpPath: "/sql/1.0/warehouses/test",
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
