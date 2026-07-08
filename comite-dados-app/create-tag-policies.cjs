// Script: cria tabela tag_policies e insere políticas LGPD padrão (PostgreSQL)
const { Client } = require('pg');

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    // Verifica se o tipo enum existe antes de criar
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE tag_applies_to AS ENUM ('table', 'column', 'both');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tag_policies (
        id SERIAL PRIMARY KEY,
        "tagKey" VARCHAR(256) NOT NULL UNIQUE,
        "displayName" VARCHAR(256) NOT NULL,
        description TEXT,
        "allowedValues" TEXT NOT NULL DEFAULT '[]',
        "colorMap" TEXT DEFAULT '{}',
        "appliesTo" tag_applies_to NOT NULL DEFAULT 'both',
        category VARCHAR(128) DEFAULT 'compliance',
        "isRequired" SMALLINT DEFAULT 0,
        "autoSync" SMALLINT DEFAULT 0,
        "sensitivityMapping" TEXT DEFAULT '{}',
        "createdById" INT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('OK: tabela tag_policies criada (ou já existia)');

    const defaults = [
      {
        tagKey: 'DataSensitivity',
        displayName: 'Sensibilidade dos Dados',
        description: 'Classifica o nível de sensibilidade conforme LGPD',
        allowedValues: JSON.stringify(['Public', 'Internal', 'Confidential', 'PersonalData']),
        colorMap: JSON.stringify({ Public: '#22c55e', Internal: '#3b82f6', Confidential: '#f59e0b', PersonalData: '#ef4444' }),
        appliesTo: 'both',
        category: 'compliance',
        isRequired: 1,
        autoSync: 0,
        sensitivityMapping: JSON.stringify({ Public: 'publico', Internal: 'interno', Confidential: 'confidencial', PersonalData: 'restrito' }),
      },
      {
        tagKey: 'Regulation',
        displayName: 'Regulação Aplicável',
        description: 'Regulação de privacidade aplicável ao dado',
        allowedValues: JSON.stringify(['LGPD', 'GDPR', 'HIPAA', 'None']),
        colorMap: JSON.stringify({ LGPD: '#1B3A8C', GDPR: '#6366f1', HIPAA: '#8b5cf6', None: '#9ca3af' }),
        appliesTo: 'both',
        category: 'compliance',
        isRequired: 0,
        autoSync: 0,
        sensitivityMapping: '{}',
      },
      {
        tagKey: 'Department',
        displayName: 'Departamento Responsável',
        description: 'Departamento de negócio dono do dado',
        allowedValues: JSON.stringify(['Finance', 'HR', 'Marketing', 'Engineering', 'Operations', 'Legal', 'IT']),
        colorMap: '{}',
        appliesTo: 'table',
        category: 'ownership',
        isRequired: 0,
        autoSync: 0,
        sensitivityMapping: '{}',
      },
      {
        tagKey: 'CostCenter',
        displayName: 'Centro de Custo',
        description: 'Centro de custo para rastreamento de uso de recursos de dados',
        allowedValues: '[]',
        colorMap: '{}',
        appliesTo: 'table',
        category: 'cost',
        isRequired: 0,
        autoSync: 0,
        sensitivityMapping: '{}',
      },
      {
        tagKey: 'DataDomain',
        displayName: 'Domínio de Dados',
        description: 'Domínio de negócio ao qual o dado pertence',
        allowedValues: JSON.stringify(['Customer', 'Product', 'Finance', 'Supply', 'HR', 'Marketing', 'Operations']),
        colorMap: '{}',
        appliesTo: 'both',
        category: 'discovery',
        isRequired: 0,
        autoSync: 0,
        sensitivityMapping: '{}',
      },
    ];

    for (const d of defaults) {
      await client.query(
        `INSERT INTO tag_policies ("tagKey","displayName",description,"allowedValues","colorMap","appliesTo",category,"isRequired","autoSync","sensitivityMapping") 
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT ("tagKey") DO NOTHING`,
        [d.tagKey, d.displayName, d.description, d.allowedValues, d.colorMap, d.appliesTo, d.category, d.isRequired, d.autoSync, d.sensitivityMapping]
      );
    }
    console.log('OK: 5 politicas padrao LGPD inseridas (ON CONFLICT DO NOTHING)');

    const { rows } = await client.query('SELECT id, "tagKey", "displayName" FROM tag_policies ORDER BY id');
    console.log('Políticas na tabela:', rows);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
