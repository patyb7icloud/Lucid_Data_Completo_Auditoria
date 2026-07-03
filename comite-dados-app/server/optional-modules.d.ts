// Ambient module declarations for optional/dynamic dependencies.
// These packages are imported dynamically (await import(...)) inside try/catch
// blocks for graceful degradation when not installed. The declarations silence
// TS2307 "Cannot find module" errors without requiring the packages at runtime.

declare module "hdb" {
  const client: any;
  export = client;
}

declare module "snowflake-sdk" {
  const snowflake: any;
  export = snowflake;
}

declare module "@google-cloud/bigquery" {
  export class BigQuery {
    createQueryJob(options: any): Promise<any[]>;
    query(options: any): Promise<any[]>;
  }
}

declare module "mssql" {
  const mssql: any;
  export = mssql;
}

declare module "oracledb" {
  const oracledb: any;
  export = oracledb;
}
