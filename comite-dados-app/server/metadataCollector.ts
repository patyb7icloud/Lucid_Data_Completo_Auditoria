import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { scanTableForPii } from "./piiScanner";
import { cache } from "./cache";

// Interface para os metadados coletados
interface DiscoveredTable {
  name: string;
  source: string;
  description: string;
  type: 'tabela' | 'api' | 'arquivo' | 'dashboard';
  catalog?: string;
  columns: Array<{
    name: string;
    type: string;
    description: string;
  }>;
}

// ─── Resultado de conexão de conector ────────────────────────────────────────
interface ConnectorResult {
  tables: DiscoveredTable[];
  errors: string[];
  connectorUsed: 'real' | 'simulation';
}

export class MetadataCollectorService {

  /**
   * SAP HANA — Coleta metadados via driver hdb (real) ou retorna simulação documentada.
   * Para ativar: instalar 'hdb' e configurar conector no banco com connectorType='sap_hana'.
   *   configJson: { host, port, user, password, schema }
   */
  async crawlSAPHana(cfg?: { host: string; port: number; user: string; password: string; schema?: string }): Promise<ConnectorResult> {
    console.log("[Collector] SAP HANA — iniciando varredura...");

    if (cfg?.host && cfg?.user && cfg?.password) {
      try {
        // Dynamic import — não falha se hdb não estiver instalado
        const hdb = await import('hdb').catch(() => null);
        if (!hdb) throw new Error("Driver 'hdb' não instalado. Execute: pnpm add hdb");

        const client = hdb.default.createClient({
          host: cfg.host, port: cfg.port ?? 30015,
          user: cfg.user, password: cfg.password,
        });

        await new Promise<void>((res, rej) => client.connect((err: any) => err ? rej(err) : res()));

        const schema = cfg.schema ?? 'SAPHANADB';
        const rows: any[] = await new Promise((res, rej) =>
          client.exec(
            `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE_NAME, COMMENTS
             FROM SYS.TABLE_COLUMNS
             WHERE SCHEMA_NAME = '${schema}'
             ORDER BY TABLE_NAME, POSITION`,
            (err: any, r: any) => err ? rej(err) : res(r)
          )
        );
        client.end();

        // Agrupar colunas por tabela
        const map = new Map<string, DiscoveredTable>();
        for (const r of rows) {
          if (!map.has(r.TABLE_NAME)) {
            map.set(r.TABLE_NAME, { name: r.TABLE_NAME, source: 'SAP HANA', description: '', type: 'tabela', columns: [] });
          }
          map.get(r.TABLE_NAME)!.columns.push({ name: r.COLUMN_NAME, type: r.DATA_TYPE_NAME, description: r.COMMENTS ?? '' });
        }
        console.log(`[Collector] SAP HANA REAL — ${map.size} tabelas descobertas.`);
        return { tables: Array.from(map.values()), errors: [], connectorUsed: 'real' };

      } catch (err: any) {
        console.warn(`[Collector] SAP HANA falhou (${err.message}). Usando simulação.`);
        return { tables: this._sapSimulation(), errors: [err.message], connectorUsed: 'simulation' };
      }
    }

    return { tables: this._sapSimulation(), errors: ['Conector SAP HANA não configurado'], connectorUsed: 'simulation' };
  }

  private _sapSimulation(): DiscoveredTable[] {
    return [
      {
        name: "MARA_GENERAL_MATERIAL", source: "SAP HANA",
        description: "Dados mestre de materiais e produtos.",
        type: "tabela",
        columns: [
          { name: "MATNR", type: "NVARCHAR(18)", description: "Número do Material" },
          { name: "ERSDA", type: "DATE", description: "Data de Criação" },
          { name: "MTART", type: "NVARCHAR(4)", description: "Tipo de Material" },
          { name: "MBRSH", type: "NVARCHAR(1)", description: "Setor industrial" },
        ]
      },
      {
        name: "KNA1_CUSTOMER_MASTER", source: "SAP HANA",
        description: "Cadastro mestre de clientes contendo PII (CPF, Nome, Endereço). Base legal: Execução de Contrato.",
        type: "tabela",
        columns: [
          { name: "KUNNR", type: "NVARCHAR(10)", description: "Número do Cliente" },
          { name: "NAME1", type: "NVARCHAR(35)", description: "Nome do Cliente" },
          { name: "STRAS", type: "NVARCHAR(35)", description: "Endereço" },
          { name: "STCD1", type: "NVARCHAR(16)", description: "CPF/CNPJ" },
          { name: "SMTP_ADDR", type: "NVARCHAR(241)", description: "E-mail" },
        ]
      },
    ];
  }

  /**
   * Snowflake — Coleta metadados via snowflake-sdk (real) ou simulação.
   * Para ativar: instalar 'snowflake-sdk' e configurar conector.
   *   configJson: { account, username, password, database, schema, warehouse }
   */
  async crawlSnowflake(cfg?: { account: string; username: string; password: string; database?: string; schema?: string; warehouse?: string }): Promise<ConnectorResult> {
    console.log("[Collector] Snowflake — iniciando varredura...");

    if (cfg?.account && cfg?.username && cfg?.password) {
      try {
        const snowflake = await import('snowflake-sdk').catch(() => null);
        if (!snowflake) throw new Error("Driver 'snowflake-sdk' não instalado. Execute: pnpm add snowflake-sdk");

        const connection = snowflake.default.createConnection({
          account: cfg.account, username: cfg.username, password: cfg.password,
          database: cfg.database, schema: cfg.schema, warehouse: cfg.warehouse,
        });

        await new Promise<void>((res, rej) =>
          connection.connect((err: any) => err ? rej(err) : res())
        );

        const database = cfg.database ?? '';
        const schema = cfg.schema ?? 'PUBLIC';

        const rows: any[] = await new Promise((res, rej) =>
          connection.execute({
            sqlText: `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COMMENT
                      FROM ${database}.INFORMATION_SCHEMA.COLUMNS
                      WHERE TABLE_SCHEMA = '${schema}'
                      ORDER BY TABLE_NAME, ORDINAL_POSITION`,
            complete: (err: any, stmt: any, r: any) => err ? rej(err) : res(r ?? []),
          })
        );
        connection.destroy(() => {});

        const map = new Map<string, DiscoveredTable>();
        for (const r of rows) {
          if (!map.has(r.TABLE_NAME)) {
            map.set(r.TABLE_NAME, { name: r.TABLE_NAME, source: 'Snowflake', description: '', type: 'tabela', columns: [] });
          }
          map.get(r.TABLE_NAME)!.columns.push({ name: r.COLUMN_NAME, type: r.DATA_TYPE, description: r.COMMENT ?? '' });
        }
        console.log(`[Collector] Snowflake REAL — ${map.size} tabelas descobertas.`);
        return { tables: Array.from(map.values()), errors: [], connectorUsed: 'real' };

      } catch (err: any) {
        console.warn(`[Collector] Snowflake falhou (${err.message}). Usando simulação.`);
        return { tables: this._snowflakeSimulation(), errors: [err.message], connectorUsed: 'simulation' };
      }
    }

    return { tables: this._snowflakeSimulation(), errors: ['Conector Snowflake não configurado'], connectorUsed: 'simulation' };
  }

  private _snowflakeSimulation(): DiscoveredTable[] {
    return [
      {
        name: "FACT_SALES_DAILY", source: "Snowflake",
        description: "Tabela de fatos de vendas diárias consolidadas.",
        type: "tabela",
        columns: [
          { name: "SALE_ID", type: "NUMBER", description: "ID Único da Venda" },
          { name: "AMOUNT", type: "FLOAT", description: "Valor Total" },
          { name: "REGION_ID", type: "NUMBER", description: "Código da Região" },
          { name: "CUSTOMER_CPF", type: "VARCHAR(14)", description: "CPF do Cliente" },
        ]
      },
    ];
  }

  /**
   * BigQuery — Coleta metadados via @google-cloud/bigquery.
   * Para ativar: pnpm add @google-cloud/bigquery
   *   configJson: { projectId, keyFilename (ou credentials JSON), dataset }
   */
  async crawlBigQuery(cfg?: { projectId: string; credentials?: object; keyFilename?: string; dataset?: string }): Promise<ConnectorResult> {
    console.log("[Collector] BigQuery — iniciando varredura...");

    if (cfg?.projectId) {
      try {
        const { BigQuery } = await import('@google-cloud/bigquery').catch(() => ({ BigQuery: null })) as any;
        if (!BigQuery) throw new Error("Driver '@google-cloud/bigquery' não instalado. Execute: pnpm add @google-cloud/bigquery");

        const bq = new BigQuery({ projectId: cfg.projectId, credentials: cfg.credentials, keyFilename: cfg.keyFilename });
        const dataset = cfg.dataset ?? '';
        const [tables] = await bq.dataset(dataset).getTables();
        const results: DiscoveredTable[] = [];

        for (const table of tables) {
          const [meta] = await table.getMetadata();
          const fields: any[] = meta.schema?.fields ?? [];
          results.push({
            name: `${dataset}.${table.id}`,
            source: 'BigQuery',
            description: meta.description ?? '',
            type: 'tabela',
            columns: fields.map((f: any) => ({
              name: f.name, type: f.type, description: f.description ?? '',
            })),
          });
        }
        console.log(`[Collector] BigQuery REAL — ${results.length} tabelas descobertas.`);
        return { tables: results, errors: [], connectorUsed: 'real' };

      } catch (err: any) {
        console.warn(`[Collector] BigQuery falhou (${err.message}).`);
        return { tables: [], errors: [err.message], connectorUsed: 'simulation' };
      }
    }

    return { tables: [], errors: ['Conector BigQuery não configurado'], connectorUsed: 'simulation' };
  }

  /**
   * Azure SQL / SQL Server — via mssql driver.
   * Para ativar: pnpm add mssql
   *   configJson: { server, database, user, password, options: { encrypt, trustServerCertificate } }
   */
  async crawlAzureSQL(cfg?: { server: string; database: string; user: string; password: string; options?: object }): Promise<ConnectorResult> {
    console.log("[Collector] Azure SQL — iniciando varredura...");

    if (cfg?.server && cfg?.database && cfg?.user) {
      try {
        const sql = await import('mssql').catch(() => null);
        if (!sql) throw new Error("Driver 'mssql' não instalado. Execute: pnpm add mssql");

        const pool = await sql.default.connect({
          server: cfg.server, database: cfg.database,
          user: cfg.user, password: cfg.password,
          options: { encrypt: true, trustServerCertificate: false, ...(cfg.options ?? {}) },
        });

        const result = await pool.request().query(`
          SELECT t.TABLE_NAME, c.COLUMN_NAME, c.DATA_TYPE, ep.value as DESCRIPTION
          FROM INFORMATION_SCHEMA.TABLES t
          JOIN INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
          LEFT JOIN sys.extended_properties ep ON ep.major_id = OBJECT_ID(t.TABLE_SCHEMA+'.'+t.TABLE_NAME)
            AND ep.minor_id = c.ORDINAL_POSITION AND ep.name = 'MS_Description'
          WHERE t.TABLE_TYPE = 'BASE TABLE'
          ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION
        `);
        await pool.close();

        const map = new Map<string, DiscoveredTable>();
        for (const r of result.recordset) {
          if (!map.has(r.TABLE_NAME)) {
            map.set(r.TABLE_NAME, { name: r.TABLE_NAME, source: 'Azure SQL', description: '', type: 'tabela', columns: [] });
          }
          map.get(r.TABLE_NAME)!.columns.push({ name: r.COLUMN_NAME, type: r.DATA_TYPE, description: r.DESCRIPTION ?? '' });
        }
        console.log(`[Collector] Azure SQL REAL — ${map.size} tabelas descobertas.`);
        return { tables: Array.from(map.values()), errors: [], connectorUsed: 'real' };

      } catch (err: any) {
        console.warn(`[Collector] Azure SQL falhou (${err.message}).`);
        return { tables: [], errors: [err.message], connectorUsed: 'simulation' };
      }
    }

    return { tables: [], errors: ['Conector Azure SQL não configurado'], connectorUsed: 'simulation' };
  }

  /**
   * PostgreSQL — Coleta metadados via driver pg.
   * Para ativar: pnpm add pg (já instalado)
   *   configJson: { host, port, user, password, database, schema }
   */
  async crawlPostgres(cfg?: { host: string; port?: number; user: string; password: string; database?: string; schema?: string }): Promise<ConnectorResult> {
    console.log("[Collector] PostgreSQL — iniciando varredura...");

    if (cfg?.host && cfg?.user) {
      try {
        const { Pool } = await import('pg').catch(() => ({ Pool: null })) as any;
        if (!Pool) throw new Error("Driver 'pg' não instalado. Execute: pnpm add pg");

        const pool = new Pool({
          host: cfg.host, port: cfg.port ?? 5432,
          user: cfg.user, password: cfg.password,
          database: cfg.database ?? 'postgres',
        });

        const schema = cfg.schema ?? 'public';
        const { rows } = await pool.query(`
          SELECT c.table_name, c.column_name, c.data_type,
                 pgd.description
          FROM information_schema.columns c
          LEFT JOIN pg_catalog.pg_statio_all_tables st
            ON st.schemaname = c.table_schema AND st.relname = c.table_name
          LEFT JOIN pg_catalog.pg_description pgd
            ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
          WHERE c.table_schema = $1
          ORDER BY c.table_name, c.ordinal_position
        `, [schema]);

        await pool.end();

        const map = new Map<string, DiscoveredTable>();
        for (const r of rows) {
          if (!map.has(r.table_name)) {
            map.set(r.table_name, { name: r.table_name, source: 'PostgreSQL', description: '', type: 'tabela', columns: [] });
          }
          map.get(r.table_name)!.columns.push({ name: r.column_name, type: r.data_type, description: r.description ?? '' });
        }
        console.log(`[Collector] PostgreSQL REAL — ${map.size} tabelas descobertas.`);
        return { tables: Array.from(map.values()), errors: [], connectorUsed: 'real' };

      } catch (err: any) {
        console.warn(`[Collector] PostgreSQL falhou (${err.message}).`);
        return { tables: [], errors: [err.message], connectorUsed: 'simulation' };
      }
    }

    return { tables: [], errors: ['Conector PostgreSQL não configurado'], connectorUsed: 'simulation' };
  }

  /**
   * Oracle Database — Coleta metadados via driver oracledb.
   * Para ativar: npm install oracledb (requer Oracle Instant Client no sistema)
   *   configJson: { host, port, user, password, serviceName, sid }
   */
  async crawlOracle(cfg?: { host: string; port?: number; user: string; password: string; serviceName?: string; sid?: string }): Promise<ConnectorResult> {
    console.log("[Collector] Oracle — iniciando varredura...");

    if (cfg?.host && cfg?.user) {
      try {
        const oracledb = await import('oracledb').catch(() => null) as any;
        if (!oracledb) throw new Error("Driver 'oracledb' não instalado. Execute: npm install oracledb");

        const connectString = cfg.serviceName
          ? `${cfg.host}:${cfg.port ?? 1521}/${cfg.serviceName}`
          : `${cfg.host}:${cfg.port ?? 1521}:${cfg.sid ?? 'ORCL'}`;

        const conn = await oracledb.getConnection({
          user: cfg.user, password: cfg.password, connectString,
        });

        // DBA_TAB_COLUMNS / ALL_TAB_COLUMNS — metadados de colunas visíveis ao usuário
        const result = await conn.execute(`
          SELECT t.table_name, c.column_name, c.data_type, cm.comments
          FROM all_tables t
          JOIN all_tab_columns c ON c.owner = t.owner AND c.table_name = t.table_name
          LEFT JOIN all_col_comments cm ON cm.owner = c.owner AND cm.table_name = c.table_name AND cm.column_name = c.column_name
          WHERE t.owner = UPPER(:owner)
          ORDER BY c.table_name, c.column_position
        `, { owner: cfg.user.toUpperCase() }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

        await conn.close();

        const map = new Map<string, DiscoveredTable>();
        for (const r of (result.rows as any[])) {
          const tName = r.TABLE_NAME;
          if (!map.has(tName)) {
            map.set(tName, { name: tName, source: 'Oracle', description: '', type: 'tabela', columns: [] });
          }
          map.get(tName)!.columns.push({ name: r.COLUMN_NAME, type: r.DATA_TYPE, description: r.COMMENTS ?? '' });
        }
        console.log(`[Collector] Oracle REAL — ${map.size} tabelas descobertas.`);
        return { tables: Array.from(map.values()), errors: [], connectorUsed: 'real' };

      } catch (err: any) {
        console.warn(`[Collector] Oracle falhou (${err.message}).`);
        return { tables: [], errors: [err.message], connectorUsed: 'simulation' };
      }
    }
    return { tables: [], errors: ['Conector Oracle não configurado'], connectorUsed: 'simulation' };
  }

  /**
   * Power BI — Coleta datasets e relatórios via API REST do Power BI.
   * Para ativar: configure POWERBI_CLIENT_ID, POWERBI_CLIENT_SECRET, POWERBI_TENANT_ID no .env
   *   configJson: { clientId, clientSecret, tenantId, workspaceId? }
   *
   * Referência: https://docs.microsoft.com/en-us/rest/api/power-bi/
   */
  async crawlPowerBI(cfg?: { clientId: string; clientSecret: string; tenantId: string; workspaceId?: string }): Promise<ConnectorResult> {
    console.log("[Collector] Power BI — iniciando varredura...");

    const clientId    = cfg?.clientId    ?? process.env.POWERBI_CLIENT_ID;
    const clientSecret = cfg?.clientSecret ?? process.env.POWERBI_CLIENT_SECRET;
    const tenantId    = cfg?.tenantId    ?? process.env.POWERBI_TENANT_ID;

    if (!clientId || !clientSecret || !tenantId) {
      return { tables: [], errors: ['Credenciais Power BI não configuradas'], connectorUsed: 'simulation' };
    }

    try {
      // 1. Obter access token via client_credentials (app-only)
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      const tokenBody = new URLSearchParams({
        client_id: clientId, client_secret: clientSecret,
        scope: 'https://analysis.windows.net/powerbi/api/.default',
        grant_type: 'client_credentials',
      });

      const { default: https } = await import('https');
      const tokenRes = await new Promise<any>((resolve, reject) => {
        const req = https.request(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, (res) => {
          let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
        });
        req.on('error', reject);
        req.write(tokenBody.toString());
        req.end();
      });

      if (!tokenRes.access_token) throw new Error(`OAuth2 falhou: ${JSON.stringify(tokenRes)}`);
      const token = tokenRes.access_token;

      // 2. Listar workspaces e datasets
      const apiBase = 'https://api.powerbi.com/v1.0/myorg';
      const workspaceId = cfg?.workspaceId;
      const datasetsUrl = workspaceId
        ? `${apiBase}/groups/${workspaceId}/datasets`
        : `${apiBase}/datasets`;

      const datasetsRes = await new Promise<any>((resolve, reject) => {
        https.get(datasetsUrl, { headers: { Authorization: `Bearer ${token}` } }, (res) => {
          let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
        }).on('error', reject);
      });

      const tables: DiscoveredTable[] = (datasetsRes.value ?? []).map((ds: any) => ({
        name: ds.name,
        source: 'Power BI',
        description: `Dataset Power BI (id: ${ds.id}) — ${ds.configuredBy ?? 'desconhecido'}`,
        type: 'dataset' as any,
        columns: [],
      }));

      // 3. Listar relatórios
      const reportsUrl = workspaceId
        ? `${apiBase}/groups/${workspaceId}/reports`
        : `${apiBase}/reports`;

      const reportsRes = await new Promise<any>((resolve, reject) => {
        https.get(reportsUrl, { headers: { Authorization: `Bearer ${token}` } }, (res) => {
          let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
        }).on('error', reject);
      });

      for (const rpt of (reportsRes.value ?? [])) {
        tables.push({
          name: rpt.name,
          source: 'Power BI',
          description: `Relatório Power BI — Dataset: ${rpt.datasetId ?? 'desconhecido'}`,
          type: 'relatorio' as any,
          columns: [],
        });
      }

      console.log(`[Collector] Power BI REAL — ${tables.length} ativos descobertos.`);
      return { tables, errors: [], connectorUsed: 'real' };

    } catch (err: any) {
      console.warn(`[Collector] Power BI falhou (${err.message}).`);
      return { tables: [], errors: [err.message], connectorUsed: 'simulation' };
    }
  }

  // ─── Databricks Unity Catalog ─────────────────────────────────────────────
  async crawlDatabricks(cfg?: { host?: string; token?: string; httpPath?: string; catalog?: string }): Promise<ConnectorResult> {
    const host = cfg?.host ?? process.env.DATABRICKS_HOST;
    const token = cfg?.token ?? process.env.DATABRICKS_TOKEN;
    const httpPath = cfg?.httpPath ?? (cfg as any)?.cluster ?? process.env.DATABRICKS_HTTP_PATH;
    const rawCatalog = cfg?.catalog ?? process.env.DATABRICKS_CATALOG ?? 'main';
    // Catalogs with dots (e.g. "psw_bricks_2.schema") are invalid — use only the first segment
    const catalog = rawCatalog.includes('.') ? rawCatalog.split('.')[0] : rawCatalog;
    if (catalog !== rawCatalog) {
      console.warn(`[Collector] Databricks: catalog env contém ponto — usando apenas "${catalog}" como catalog.`);
    }

    if (!host || !token || !httpPath) {
      console.warn('[Collector] Databricks: DATABRICKS_HOST, DATABRICKS_TOKEN e DATABRICKS_HTTP_PATH são obrigatórios. Simulando.');
      return {
        tables: [
          { name: 'silver.transactions', type: 'tabela', source: 'Databricks', description: 'Transações camada silver Delta Lake', columns: [{ name: 'id', type: 'BIGINT', description: '' }, { name: 'amount', type: 'DOUBLE', description: '' }, { name: 'ts', type: 'TIMESTAMP', description: '' }] },
          { name: 'gold.customer_360', type: 'tabela', source: 'Databricks', description: 'Visão 360° de clientes camada gold', columns: [{ name: 'customer_id', type: 'STRING', description: '' }, { name: 'lifetime_value', type: 'DOUBLE', description: '' }] },
        ],
        errors: [],
        connectorUsed: 'simulation',
      };
    }

    try {
      // Usa SQL Warehouse via @databricks/sql (evita necessidade de permissão Unity Catalog REST API)
      const { DBSQLClient } = await import('@databricks/sql');
      const client = new DBSQLClient();
      await client.connect({ host, path: httpPath, token });
      const session = await client.openSession();

      const runQuery = async (sql: string): Promise<Array<Record<string, unknown>>> => {
        const op = await session.executeStatement(sql, { runAsync: false });
        const result = await op.fetchAll();
        await op.close();
        return result as Array<Record<string, unknown>>;
      };

      // Lista schemas do catalog
      const schemasRows = await runQuery(`SHOW SCHEMAS IN \`${catalog}\``);
      const schemas = schemasRows.map((r: any) => r.databaseName ?? r.namespace ?? r.schemaName ?? Object.values(r)[0] as string).filter(Boolean) as string[];

      const tables: DiscoveredTable[] = [];
      for (const schema of schemas.slice(0, 15)) {
        if (schema === 'information_schema') continue;
        try {
          const tablesRows = await runQuery(`SHOW TABLES IN \`${catalog}\`.\`${schema}\``);
          for (const t of tablesRows) {
            const tableName = (t as any).tableName ?? (t as any).table_name ?? Object.values(t)[1] as string;
            const isTemp = (t as any).isTemporary ?? false;
            if (!tableName || isTemp) continue;

            let description = '';
            let columns: Array<{ name: string; type: string; description: string }> = [];
            try {
              // Descrição da tabela via information_schema.tables
              try {
                const tblInfoRows = await runQuery(
                  `SELECT comment FROM \`${catalog}\`.information_schema.tables WHERE table_schema='${schema}' AND table_name='${tableName}' LIMIT 1`
                );
                if (tblInfoRows.length > 0) description = ((tblInfoRows[0] as any).comment ?? '').trim();
              } catch { /* ignora — tabela pode não ter comentário */ }

              // Colunas com comentários via information_schema.columns (mais confiável que DESCRIBE)
              let colRows: Array<Record<string, unknown>> = [];
              try {
                colRows = await runQuery(
                  `SELECT column_name, data_type, comment FROM \`${catalog}\`.information_schema.columns WHERE table_schema='${schema}' AND table_name='${tableName}' ORDER BY ordinal_position`
                );
              } catch {
                // Fallback para DESCRIBE TABLE se information_schema não suportado
                const descRows = await runQuery(`DESCRIBE TABLE \`${catalog}\`.\`${schema}\`.\`${tableName}\``);
                colRows = descRows.map((r: any) => ({
                  column_name: r.col_name,
                  data_type: r.data_type,
                  comment: r.comment ?? '',
                }));
              }

              for (const col of colRows) {
                const colName = ((col as any).column_name ?? '').trim();
                const dataType = ((col as any).data_type ?? '').trim();
                const comment = ((col as any).comment ?? '').trim();
                if (!colName || colName.startsWith('#')) continue;
                columns.push({ name: colName, type: dataType.toUpperCase(), description: comment });
              }
            } catch { /* ignora erros de describe */ }

            tables.push({
              name: `${schema}.${tableName}`,
              type: 'tabela',
              source: 'Databricks',
              description,
              columns,
              catalog,
            });
          }
        } catch { /* schema inacessível — pula */ }
      }

      await session.close();
      await client.close();

      return { tables, errors: [], connectorUsed: 'real' };
    } catch (err: any) {
      console.warn(`[Collector] Databricks falhou (${err.message}).`);
      return { tables: [], errors: [err.message], connectorUsed: 'simulation' };
    }
  }

  // ─── Tableau REST API ──────────────────────────────────────────────────────
  async crawlTableau(cfg?: { serverUrl?: string; token?: string; tokenName?: string; siteId?: string }): Promise<ConnectorResult> {
    const serverUrl = cfg?.serverUrl ?? process.env.TABLEAU_SERVER_URL;
    const token = cfg?.token ?? process.env.TABLEAU_TOKEN;
    const tokenName = cfg?.tokenName ?? process.env.TABLEAU_TOKEN_NAME;
    const siteId = cfg?.siteId ?? process.env.TABLEAU_SITE_ID ?? '';

    if (!serverUrl || !token || !tokenName) {
      console.warn('[Collector] Tableau: credenciais ausentes. Simulando.');
      return {
        tables: [
          { name: 'Vendas por Região', type: 'dashboard', source: 'Tableau', description: 'Dashboard de vendas por região geográfica', columns: [{ name: 'região', type: 'STRING', description: '' }, { name: 'valor_vendas', type: 'FLOAT', description: '' }] },
          { name: 'KPI Operacional', type: 'dashboard', source: 'Tableau', description: 'Indicadores operacionais em tempo real', columns: [{ name: 'kpi_nome', type: 'STRING', description: '' }, { name: 'valor', type: 'FLOAT', description: '' }] },
        ],
        errors: [],
        connectorUsed: 'simulation',
      };
    }

    try {
      // Autenticar com Personal Access Token
      const authBody = JSON.stringify({
        credentials: { personalAccessTokenName: tokenName, personalAccessTokenSecret: token, site: { contentUrl: siteId } },
      });
      const authRes = await fetch(`${serverUrl}/api/3.21/auth/signin`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: authBody,
      });
      if (!authRes.ok) throw new Error(`Tableau auth: ${authRes.status}`);
      const authData = await authRes.json() as { credentials: { token: string; site: { id: string } } };
      const sessionToken = authData.credentials.token;
      const resolvedSiteId = authData.credentials.site.id;
      const headers = { 'X-Tableau-Auth': sessionToken, 'Accept': 'application/json' };

      // Listar workbooks
      const wbRes = await fetch(`${serverUrl}/api/3.21/sites/${resolvedSiteId}/workbooks?pageSize=50`, { headers });
      if (!wbRes.ok) throw new Error(`Tableau workbooks: ${wbRes.status}`);
      const wbData = await wbRes.json() as { workbooks: { workbook: Array<{ id: string; name: string; description?: string }> } };
      const workbooks = wbData.workbooks.workbook ?? [];

      const tables: DiscoveredTable[] = workbooks.map(wb => ({
        name: wb.name,
        type: 'dashboard' as any,
        source: 'Tableau',
        description: wb.description ?? '',
        columns: [],
      }));

      // Listar datasources
      const dsRes = await fetch(`${serverUrl}/api/3.21/sites/${resolvedSiteId}/datasources?pageSize=50`, { headers });
      if (dsRes.ok) {
        const dsData = await dsRes.json() as { datasources: { datasource: Array<{ name: string; contentUrl: string }> } };
        for (const ds of dsData.datasources.datasource ?? []) {
          tables.push({ name: ds.name, type: 'tabela', source: 'Tableau', description: `Datasource Tableau: ${ds.contentUrl}`, columns: [] });
        }
      }

      // Sign out
      await fetch(`${serverUrl}/api/3.21/auth/signout`, { method: 'POST', headers });

      return { tables, errors: [], connectorUsed: 'real' };
    } catch (err: any) {
      console.warn(`[Collector] Tableau falhou (${err.message}).`);
      return { tables: [], errors: [err.message], connectorUsed: 'simulation' };
    }
  }

  // ─── Kafka Schema Registry ─────────────────────────────────────────────────
  async crawlKafka(cfg?: { schemaRegistryUrl?: string; bootstrapServers?: string }): Promise<ConnectorResult> {
    const registryUrl = cfg?.schemaRegistryUrl ?? process.env.KAFKA_SCHEMA_REGISTRY_URL;

    if (!registryUrl) {
      console.warn('[Collector] Kafka: KAFKA_SCHEMA_REGISTRY_URL ausente. Simulando.');
      return {
        tables: [
          { name: 'topic.pedidos-criados', type: 'tabela', source: 'Kafka', description: 'Evento: pedido criado (Avro/Schema Registry)', columns: [{ name: 'pedido_id', type: 'STRING', description: '' }, { name: 'cliente_id', type: 'STRING', description: '' }, { name: 'valor_total', type: 'DOUBLE', description: '' }, { name: 'timestamp', type: 'LONG', description: '' }] },
          { name: 'topic.pagamentos-confirmados', type: 'tabela', source: 'Kafka', description: 'Evento: pagamento confirmado', columns: [{ name: 'pagamento_id', type: 'STRING', description: '' }, { name: 'pedido_id', type: 'STRING', description: '' }, { name: 'status', type: 'STRING', description: '' }] },
        ],
        errors: [],
        connectorUsed: 'simulation',
      };
    }

    try {
      // Listar subjects do Schema Registry (Confluent compatible)
      const subjectsRes = await fetch(`${registryUrl}/subjects`, { headers: { 'Accept': 'application/vnd.schemaregistry.v1+json' } });
      if (!subjectsRes.ok) throw new Error(`Schema Registry: ${subjectsRes.status}`);
      const subjects = await subjectsRes.json() as string[];

      const tables: DiscoveredTable[] = [];
      for (const subject of subjects.slice(0, 30)) {
        try {
          const schemaRes = await fetch(`${registryUrl}/subjects/${encodeURIComponent(subject)}/versions/latest`, {
            headers: { 'Accept': 'application/vnd.schemaregistry.v1+json' },
          });
          if (!schemaRes.ok) continue;
          const schemaData = await schemaRes.json() as { schema: string };
          const parsedSchema = JSON.parse(schemaData.schema);
          const columns = Array.isArray(parsedSchema.fields)
            ? parsedSchema.fields.map((f: any) => ({ name: f.name, type: String(Array.isArray(f.type) ? f.type[0] : f.type).toUpperCase() }))
            : [];
          tables.push({
            name: subject,
            type: 'tabela',
            source: 'Kafka',
            description: `Kafka topic schema: ${parsedSchema.doc ?? subject}`,
            columns,
          });
        } catch {
          tables.push({ name: subject, type: 'tabela', source: 'Kafka', description: `Kafka topic: ${subject}`, columns: [] });
        }
      }

      return { tables, errors: [], connectorUsed: 'real' };
    } catch (err: any) {
      console.warn(`[Collector] Kafka falhou (${err.message}).`);
      return { tables: [], errors: [err.message], connectorUsed: 'simulation' };
    }
  }

  // ─── Redshift (PostgreSQL-compatible) ─────────────────────────────────────
  async crawlRedshift(cfg?: { host?: string; port?: number; user?: string; password?: string; database?: string; connectionUrl?: string }): Promise<ConnectorResult> {
    const connectionUrl = cfg?.connectionUrl ?? process.env.REDSHIFT_URL;
    if (!connectionUrl && !(cfg?.host && cfg?.user && cfg?.database)) {
      console.warn('[Collector] Redshift: credenciais ausentes. Simulando.');
      return {
        tables: [
          { name: 'public.fct_sales', type: 'tabela', source: 'Redshift', description: 'Fato de vendas (DW Redshift)', columns: [{ name: 'sale_id', type: 'BIGINT', description: '' }, { name: 'product_key', type: 'INTEGER', description: '' }, { name: 'amount', type: 'DECIMAL', description: '' }] },
          { name: 'public.dim_customer', type: 'tabela', source: 'Redshift', description: 'Dimensão cliente (DW Redshift)', columns: [{ name: 'customer_key', type: 'INTEGER', description: '' }, { name: 'name', type: 'VARCHAR', description: '' }, { name: 'segment', type: 'VARCHAR', description: '' }] },
        ],
        errors: [],
        connectorUsed: 'simulation',
      };
    }

    try {
      const { Client } = await import('pg') as any;
      const connStr = connectionUrl ?? `postgresql://${cfg!.user}:${cfg!.password ?? ''}@${cfg!.host}:${cfg!.port ?? 5439}/${cfg!.database}`;
      const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
      await client.connect();

      const { rows: tableRows } = await (client.query)(
        `SELECT table_schema, table_name, table_type
         FROM information_schema.tables
         WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_internal')
         ORDER BY table_schema, table_name
         LIMIT 200`,
      );

      const tables: DiscoveredTable[] = [];
      for (const row of tableRows) {
        const { rows: colRows } = await (client.query)(
          `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position LIMIT 50`,
          [row.table_schema, row.table_name],
        );
        tables.push({
          name: `${row.table_schema}.${row.table_name}`,
          type: (row.table_type === 'VIEW' ? 'view' : 'tabela') as any,
          source: 'Redshift',
          description: '',
          columns: colRows.map((c: any) => ({ name: c.column_name, type: c.data_type.toUpperCase(), description: '' })),
        });
      }

      await client.end();
      return { tables, errors: [], connectorUsed: 'real' };
    } catch (err: any) {
      console.warn(`[Collector] Redshift falhou (${err.message}).`);
      return { tables: [], errors: [err.message], connectorUsed: 'simulation' };
    }
  }

  /**
   * IA-Powered Auto-Discovery: Classifica sensibilidade e melhora descrições
   */
  async enrichWithAI(table: DiscoveredTable): Promise<Partial<DiscoveredTable>> {
    console.log(`[Collector] Enriquecendo "${table.name}" com LLM...`);
    const prompt = `Analise a tabela de dados a seguir e sugira: 
    1. Uma classificação de sensibilidade (publico, interno, confidencial, restrito) baseada no nome da tabela e de suas colunas. 
    2. Uma descrição técnica melhorada em português.
    
    Tabela: ${table.name}
    Colunas: ${table.columns.map(c => c.name).join(', ')}
    
    Responda apenas em JSON puro seguindo este formato:
    { "sensitivity": "string", "description": "string" }`;

    try {
      const response = await invokeLLM({ messages: [{ role: "user", content: prompt }] });
      const text = typeof response.choices?.[0]?.message?.content === "string"
        ? response.choices[0].message.content
        : "";
      const cleanedResponse = text.replace(/```json|```/g, "").trim();
      return JSON.parse(cleanedResponse);
    } catch (e) {
      console.warn(`[Collector] Falha ao usar IA para ${table.name}:`, e);
      return { sensitivity: 'interno' } as any;
    }
  }

  /**
   * Carrega configurações de conectores do banco e executa todos os crawlers ativos.
   */
  async syncAll() {
    try {
      // 1. Buscar conectores ativos no banco
      const connectors = await db.getConnectorConfigs();
      const allResults: ConnectorResult[] = [];

      for (const connector of connectors) {
        if (!connector.active) continue;
        const cfg = typeof connector.configJson === 'string' ? JSON.parse(connector.configJson) : connector.configJson;
        const type = connector.connectorType?.toLowerCase() ?? '';

        let result: ConnectorResult;
        if (type.includes('sap')) result = await this.crawlSAPHana(cfg);
        else if (type.includes('snowflake')) result = await this.crawlSnowflake(cfg);
        else if (type.includes('bigquery')) result = await this.crawlBigQuery(cfg);
        else if (type.includes('azure_sql') || type.includes('mssql') || type.includes('sqlserver')) result = await this.crawlAzureSQL(cfg);
        else if (type.includes('redshift')) result = await this.crawlRedshift(cfg);
        else if (type.includes('postgres') || type.includes('postgresql')) result = await this.crawlPostgres(cfg);
        else if (type.includes('oracle')) result = await this.crawlOracle(cfg);
        else if (type.includes('powerbi') || type.includes('power_bi')) result = await this.crawlPowerBI(cfg);
        else if (type.includes('databricks')) result = await this.crawlDatabricks(cfg);
        else if (type.includes('tableau')) result = await this.crawlTableau(cfg);
        else if (type.includes('kafka')) result = await this.crawlKafka(cfg);
        else continue;

        allResults.push(result);

        // Atualizar status do conector
        await db.updateConnectorConfig(connector.id, {
          lastTestedAt: new Date(),
          lastTestSuccess: result.connectorUsed === 'real',
          lastTestMessage: result.errors.length > 0 ? result.errors[0] : 'OK',
        });
      }

      // 2. Se nenhum conector ativo, usar simulação padrão
      if (allResults.length === 0) {
        const sapResult = await this.crawlSAPHana();
        const sfResult = await this.crawlSnowflake();
        allResults.push(sapResult, sfResult);
      }

      const allTables = allResults.flatMap(r => r.tables);
      console.log(`[Collector] ${allTables.length} ativos descobertos. Sincronizando...`);


      for (const table of allTables) {
        const aiEnrichment = await this.enrichWithAI(table);
        const sensitivity = ((aiEnrichment as any).sensitivity as string) || 'interno';
        const description = aiEnrichment.description || table.description;

        const existingAssets = await db.getDataAssets();
        const asset = existingAssets.find(a => a.name === table.name);
        let assetId: number;

        if (!asset) {
          // Para Databricks, monta fullyQualifiedName = catalog.schema.table
          // Sanitiza catalog: remove tudo após o ponto (ex: "psw_bricks_2.schema" → "psw_bricks_2")
          const rawDatabricksCatalog = table.catalog || process.env.DATABRICKS_CATALOG || '';
          const effectiveDatabricksCatalog = rawDatabricksCatalog.includes('.')
            ? rawDatabricksCatalog.split('.')[0]
            : rawDatabricksCatalog;
          const fqn = table.source === 'Databricks' && effectiveDatabricksCatalog
            ? `${effectiveDatabricksCatalog}.${table.name}`
            : undefined;
          const result = await db.createDataAsset({
            name: table.name, sourceSystem: table.source,
            description, type: table.type, status: 'ativo', sensitivity: sensitivity as "publico" | "interno" | "confidencial" | "restrito" | null | undefined,
            ...(fqn ? { fullyQualifiedName: fqn } : {}),
          });
          assetId = (result as any)?.id;
          console.log(`[Collector] Novo ativo (IA: ${sensitivity}): ${table.name}`);

          await db.createAuditLog({
            action: "create", entity: "data_asset", entityId: assetId,
            details: {
              source: "IA_AutoDiscovery",
              aiSugeriu: { sensitivity, description },
              justificativaLabel: "Classificação automática via LLM (Privacy-Safe Metadata Analysis).",
            }
          });
        } else {
          assetId = asset.id;
          // Atualiza FQN mesmo em ativos existentes (garante que mudar o catalog corrija o FQN)
          const rawDatabricksCatalogUpd = table.catalog || process.env.DATABRICKS_CATALOG || '';
          const effectiveDatabricksCatalogUpd = rawDatabricksCatalogUpd.includes('.')
            ? rawDatabricksCatalogUpd.split('.')[0]
            : rawDatabricksCatalogUpd;
          const fqnUpd = table.source === 'Databricks' && effectiveDatabricksCatalogUpd
            ? `${effectiveDatabricksCatalogUpd}.${table.name}`
            : undefined;
          await db.updateDataAsset(assetId, {
            updatedAt: new Date(),
            ...(fqnUpd ? { fullyQualifiedName: fqnUpd } : {}),
          });
        }

        // 4. Sincronizar atributos com detecção automática de PII
        const existingAttrs = await db.getDataAttributes(assetId);
        for (const col of table.columns) {
          const attrExists = existingAttrs.find(a => a.name === col.name);
          const piiResult = scanTableForPii(col.name, col.type);

          if (!attrExists) {
            await db.createDataAttribute({
              assetId, name: col.name, dataType: col.type,
              description: col.description,
              isPii: piiResult.isPii,
            } as any);
          } else {
            const attrUpdates: Record<string, any> = {};
            // Preenche description vazia com o comentário recém-coletado do catálogo
            if (!attrExists.description && col.description) attrUpdates.description = col.description;
            // Atualiza tipo se foi refinado pelo catálogo
            if (col.type && col.type !== attrExists.dataType) attrUpdates.dataType = col.type;
            if (piiResult.isPii && !attrExists.isPii) attrUpdates.isPii = true;
            if (Object.keys(attrUpdates).length > 0) {
              await db.updateDataAttribute(attrExists.id, attrUpdates as any);
            }
          }
        }
      }

      await cache.flush("assets:"); // Invalida o cache para os ativos aparecerem imediatamente no catálogo
      return { success: true, count: allTables.length, connectorsUsed: allResults.map(r => r.connectorUsed) };
    } catch (error) {
      console.error("[Collector] Erro na sincronização:", error);
      throw error;
    }
  }

  /**
   * Varre tickets do ServiceNow e converte tickets aprovados em ativos.
   */
  async processApprovedServiceNowTickets() {
    console.log("[Collector] Verificando tickets aprovados no ServiceNow...");
    const tickets = await db.getServicenowTickets();
    
    // Filtra tickets que são novos datasets e estão concluídos
    const approvedDatasets = tickets.filter(t => 
      t.status === 'concluído' && 
      (t.title.toLowerCase().includes('novo dataset') || t.title.toLowerCase().includes('acesso'))
    );

    for (const ticket of approvedDatasets) {
      const existingAssets = await db.getDataAssets();
      if (!existingAssets.find(a => a.name === ticket.ticketNumber)) {
        await db.createDataAsset({
          name: `SN_${ticket.ticketNumber}`,
          description: `Ativo originado do Ticket ServiceNow: ${ticket.title}. ${ticket.description}`,
          sourceSystem: "ServiceNow Provisioning",
          type: "tabela",
          status: "ativo",
          sensitivity: "interno"
        });
        console.log(`[Collector] Ativo criado via ServiceNow: ${ticket.ticketNumber}`);
      }
    }
    await cache.flush("assets:"); // Invalida o cache para os ativos aparecerem imediatamente no catálogo
  }
}

export const metadataCollector = new MetadataCollectorService();
