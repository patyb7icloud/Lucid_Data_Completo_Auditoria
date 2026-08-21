import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    console.log("Creating quality_dimensions table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS quality_dimensions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(128) NOT NULL UNIQUE,
        description TEXT,
        color VARCHAR(32) DEFAULT '#1B3A8C',
        weight REAL DEFAULT 1,
        "isActive" BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    console.log("Dropping old quality_rules table to recreate...");
    await client.query(`DROP TABLE IF EXISTS quality_rules CASCADE;`);

    console.log("Creating new quality_rules table...");
    await client.query(`
      CREATE TABLE quality_rules (
        id SERIAL PRIMARY KEY,
        "dimensionId" INTEGER NOT NULL REFERENCES quality_dimensions(id),
        "assetId" INTEGER,
        "domainId" INTEGER,
        "isGlobal" BOOLEAN DEFAULT false,
        "expressionJson" JSONB,
        threshold REAL DEFAULT 95,
        "isActive" BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    console.log("Inserting default dimensions...");
    await client.query(`
      INSERT INTO quality_dimensions (name, description, color) VALUES
      ('Completude', 'Atributos preenchidos e não nulos', '#1B3A8C'),
      ('Unicidade', 'Sem duplicatas de chave/nome', '#6DC23A'),
      ('Validade', 'Formatos e tipos de dados', '#0ea5e9'),
      ('Consistência', 'Regras de negócio', '#f59e0b'),
      ('Classificação PII', 'Mapeamento de sensibilidade', '#ef4444')
      ON CONFLICT (name) DO NOTHING;
    `);

    console.log("Migration finished successfully.");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await client.end();
  }
}

run();
