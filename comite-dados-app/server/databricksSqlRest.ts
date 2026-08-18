/**
 * Cliente REST compatível com a Databricks SQL Statement Execution API.
 *
 * Este transporte replica o fluxo usado pelo Auditoria-de-Governanca-de-Dados-
 * Databricks: descobre um SQL Warehouse, submete statements, aguarda o
 * resultado e converte data_array/schema em objetos. O token permanece somente
 * em memória e nunca é incluído em erros públicos.
 */

import { redactDatabricksError } from "./databricksCredentials";

export interface DatabricksRestConfig {
  host: string;
  token: string;
  catalog?: string;
  /** ID explícito do warehouse; se ausente, o cliente descobre via API. */
  warehouseId?: string;
  /** Mantido para compatibilidade com conectores que ainda salvam HTTP path. */
  httpPath?: string;
  queryTimeoutMs?: number;
  pollIntervalMs?: number;
}

type Warehouse = {
  id?: string;
  name?: string;
  state?: string;
};

type StatementResponse = {
  statement_id?: string;
  status?: {
    state?: string;
    error?: { message?: string };
  };
  result?: {
    data_array?: unknown[][];
    schema?: { columns?: Array<{ name?: string }> };
  };
  manifest?: {
    schema?: { columns?: Array<{ name?: string }> };
  };
};

export type DatabricksRow = Record<string, unknown>;

function normalizeHost(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function quoteIdentifier(value: string): string {
  return `\`${value.replace(/`/g, "``")}\``;
}

function warehouseIdFromHttpPath(httpPath?: string): string | undefined {
  const match = httpPath?.match(/\/warehouses\/([^/?#]+)/i);
  return match?.[1];
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

class DatabricksRestOperation {
  constructor(private readonly rows: DatabricksRow[]) {}

  async fetchAll(): Promise<DatabricksRow[]> {
    return this.rows;
  }

  async close(): Promise<void> {
    // A REST statement has no open server-side operation to close here.
  }
}

export class DatabricksRestSession {
  constructor(private readonly client: DatabricksSqlRestClient) {}

  async executeStatement(
    sql: string,
    options?: { runAsync?: boolean; queryTimeout?: number },
  ): Promise<DatabricksRestOperation> {
    const rows = await this.client.execute(sql, options?.queryTimeout);
    return new DatabricksRestOperation(rows);
  }

  async close(): Promise<void> {
    // Sessions are logical wrappers around REST statements.
  }
}

export class DatabricksSqlRestClient {
  private readonly baseUrl: string;
  private warehouse: Warehouse | null = null;

  constructor(private readonly config: DatabricksRestConfig) {
    this.baseUrl = normalizeHost(config.host);
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.config.token}`);
    headers.set("Content-Type", "application/json");

    try {
      const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const suffix = body ? `: ${body}` : "";
        throw new Error(`Databricks API HTTP ${response.status}${suffix}`);
      }
      return response;
    } catch (error) {
      const safe = redactDatabricksError(errorMessage(error), [this.config.token]);
      throw new Error(safe, { cause: error });
    }
  }

  async listWarehouses(): Promise<Warehouse[]> {
    const response = await this.request("/api/2.0/sql/warehouses");
    const payload = (await response.json()) as { warehouses?: Warehouse[] };
    return payload.warehouses ?? [];
  }

  async connect(): Promise<this> {
    const explicitId =
      this.config.warehouseId?.trim() ||
      warehouseIdFromHttpPath(this.config.httpPath) ||
      process.env.DATABRICKS_WAREHOUSE_ID?.trim();

    if (explicitId) {
      // O projeto de referência usa diretamente o ID informado e só consulta
      // /warehouses quando nenhum ID foi configurado.
      this.warehouse = { id: explicitId };
      return this;
    }

    const warehouses = await this.listWarehouses();
    if (warehouses.length === 0) {
      throw new Error("Nenhum SQL Warehouse foi encontrado neste workspace Databricks.");
    }

    const running = warehouses.find((warehouse) => warehouse.state?.toUpperCase() === "RUNNING");
    this.warehouse = running ?? warehouses[0];

    if (!this.warehouse.id) {
      throw new Error("A resposta do Databricks não contém um ID de SQL Warehouse válido.");
    }
    return this;
  }

  async openSession(_options?: { initialCatalog?: string }): Promise<DatabricksRestSession> {
    if (!this.warehouse?.id) {
      throw new Error("O cliente Databricks ainda não foi conectado.");
    }
    return new DatabricksRestSession(this);
  }

  get selectedWarehouse(): Warehouse | null {
    return this.warehouse;
  }

  async execute(sql: string, queryTimeoutSeconds?: number): Promise<DatabricksRow[]> {
    if (!this.warehouse?.id) {
      throw new Error("O cliente Databricks ainda não foi conectado.");
    }

    const timeoutSeconds = Math.max(
      1,
      Math.ceil(
        queryTimeoutSeconds ??
          (this.config.queryTimeoutMs ?? 30_000) / 1000,
      ),
    );
    const response = await this.request("/api/2.0/sql/statements", {
      method: "POST",
      body: JSON.stringify({
        statement: sql,
        warehouse_id: this.warehouse.id,
        ...(this.config.catalog ? { catalog: this.config.catalog } : {}),
        wait_timeout: `${timeoutSeconds}s`,
        on_wait_timeout: "CONTINUE",
      }),
    });

    let statement = (await response.json()) as StatementResponse;
    const maxPollAttempts = Math.max(
      1,
      Math.ceil((this.config.queryTimeoutMs ?? 60_000) / 2_000),
    );
    let attempts = 0;
    const pollInterval = this.config.pollIntervalMs ?? 2_000;

    while (statement.status?.state === "PENDING" || statement.status?.state === "RUNNING") {
      if (!statement.statement_id || attempts++ >= maxPollAttempts) {
        throw new Error("A consulta Databricks excedeu o tempo limite de polling.");
      }
      if (pollInterval > 0) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
      const pollResponse = await this.request(
        `/api/2.0/sql/statements/${encodeURIComponent(statement.statement_id)}`,
      );
      statement = (await pollResponse.json()) as StatementResponse;
    }

    const state = statement.status?.state?.toUpperCase();
    if (state === "FAILED" || state === "CANCELED") {
      throw new Error(statement.status?.error?.message ?? `Statement ${state}`);
    }

    const columns =
      statement.manifest?.schema?.columns ??
      statement.result?.schema?.columns ??
      [];
    const names = columns.map((column, index) => column.name ?? `column_${index}`);
    return (statement.result?.data_array ?? []).map((row) => {
      const result: DatabricksRow = {};
      names.forEach((name, index) => {
        result[name] = row[index] ?? null;
      });
      return result;
    });
  }

  async close(): Promise<void> {
    this.warehouse = null;
  }
}

export async function testDatabricksConnection(
  config: DatabricksRestConfig,
): Promise<{ ok: boolean; message: string; warehouseId?: string }> {
  const client = new DatabricksSqlRestClient(config);
  try {
    await client.connect();
    const warehouse = client.selectedWarehouse;
    const catalog = config.catalog?.trim() || "main";
    const session = await client.openSession({ initialCatalog: catalog });
    try {
      const operation = await session.executeStatement(`SHOW SCHEMAS IN ${quoteIdentifier(catalog)}`, {
        runAsync: false,
      });
      const schemas = await operation.fetchAll();
      await operation.close();
      if (schemas.length === 0) {
        return {
          ok: false,
          message: `Conectado ao warehouse, mas nenhum schema está acessível no catálogo: ${catalog}`,
          warehouseId: warehouse?.id,
        };
      }
      return {
        ok: true,
        message: `Conexão estabelecida com sucesso. Warehouse: ${warehouse?.name ?? warehouse?.id}`,
        warehouseId: warehouse?.id,
      };
    } finally {
      await session.close();
    }
  } catch (error) {
    const safe = redactDatabricksError(errorMessage(error), [config.token]);
    return { ok: false, message: safe };
  } finally {
    await client.close();
  }
}
