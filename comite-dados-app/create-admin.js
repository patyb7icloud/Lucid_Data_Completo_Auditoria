import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Client } = pg;

async function upsertUser(client, { email, name, role }) {
  const hash = await bcrypt.hash('admin', 10);
  const { rows } = await client.query('SELECT id FROM users WHERE email = $1', [email]);
  if (rows.length > 0) {
    await client.query(
      "UPDATE users SET \"passwordHash\" = $1, role = $2, \"loginMethod\" = 'local', name = $3, \"updatedAt\" = NOW() WHERE email = $4",
      [hash, role, name, email]
    );
    console.log(`[user atualizado] ${email} | role: ${role} | ID: ${rows[0].id}`);
    return rows[0].id;
  } else {
    const openId = 'local_' + email.replace(/[^a-z0-9]/gi, '_') + '_' + Date.now();
    const { rows: res } = await client.query(
      "INSERT INTO users (\"openId\", name, email, \"passwordHash\", \"loginMethod\", role, \"createdAt\", \"updatedAt\", \"lastSignedIn\") VALUES ($1, $2, $3, $4, 'local', $5, NOW(), NOW(), NOW()) RETURNING id",
      [openId, name, email, hash, role]
    );
    console.log(`[user criado] ${email} | role: ${role} | ID: ${res[0].id}`);
    return res[0].id;
  }
}

async function upsertParticipant(client, { name, email, role, userId }) {
  const { rows } = await client.query('SELECT id FROM participants WHERE email = $1', [email]);
  if (rows.length > 0) {
    await client.query(
      'UPDATE participants SET name = $1, role = $2, "userId" = $3, status = $4, "updatedAt" = NOW() WHERE email = $5',
      [name, role, userId, 'ativo', email]
    );
    console.log(`[participant atualizado] ${email} | role: ${role} | ID: ${rows[0].id}`);
    return rows[0].id;
  } else {
    const { rows: res } = await client.query(
      'INSERT INTO participants (name, email, role, "userId", status, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, \'ativo\', NOW(), NOW()) RETURNING id',
      [name, email, role, userId]
    );
    console.log(`[participant criado] ${email} | role: ${role} | ID: ${res[0].id}`);
    return res[0].id;
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  // 1. Criar/atualizar usuários
  const adminId  = await upsertUser(client, { email: 'admin@local',   name: 'Admin',        role: 'admin'        });
  const ownerId  = await upsertUser(client, { email: 'owner@local',   name: 'Data Owner',   role: 'data_owner'   });
  const stewardId = await upsertUser(client, { email: 'steward@local', name: 'Data Steward', role: 'data_steward' });

  // 2. Criar/atualizar participantes vinculados aos usuários
  const ownerParticipantId  = await upsertParticipant(client, { name: 'Data Owner',   email: 'owner@local',   role: 'data_owner',   userId: adminId  }); // adminId ou ownerId? No original era adminId? Não, era ownerId.
  // Corrigindo:
  const opId = await upsertParticipant(client, { name: 'Data Owner',   email: 'owner@local',   role: 'data_owner',   userId: ownerId  });
  const spId = await upsertParticipant(client, { name: 'Data Steward', email: 'steward@local', role: 'data_steward', userId: stewardId });

  // 3. Verificar se existe algum ativo de dados; se não, criar um de teste
  const { rows: assets } = await client.query('SELECT id, name FROM data_assets LIMIT 5');
  if (assets.length === 0) {
    const { rows: res } = await client.query(
      'INSERT INTO data_assets (name, type, description, sensitivity, status, "ownerId", "stewardId", "createdAt", "updatedAt") VALUES (\'Ativo de Teste\', \'tabela\', \'Ativo criado para simulação de aprovações\', \'interno\', \'ativo\', $1, $2, NOW(), NOW()) RETURNING id',
      [opId, spId]
    );
    console.log(`[ativo criado] "Ativo de Teste" | ID: ${res[0].id} | ownerId: ${opId} | stewardId: ${spId}`);
  } else {
    // Associar o primeiro ativo existente ao owner e steward de teste
    const asset = assets[0];
    await client.query(
      'UPDATE data_assets SET "ownerId" = $1, "stewardId" = $2 WHERE id = $3',
      [opId, spId, asset.id]
    );
    console.log(`[ativo atualizado] "${asset.name}" (ID: ${asset.id}) -> ownerId: ${opId}, stewardId: ${spId}`);
    // Lista os ativos disponíveis
    console.log('\nAtivos disponíveis no catálogo:');
    assets.forEach(a => console.log(`  ID ${a.id}: ${a.name}`));
  }

  console.log('\n=== RESUMO ===');
  console.log('Todos os usuários têm senha: admin');
  console.log(`  admin@local   (ID ${adminId})   -> admin | pode criar solicitações`);
  console.log(`  owner@local   (ID ${ownerId})   -> data_owner | participante ID ${opId}`);
  console.log(`  steward@local (ID ${stewardId}) -> data_steward | participante ID ${spId}`);
  console.log('\nFluxo de teste:');
  console.log('  1. Login admin@local -> Catálogo -> Solicitar Acesso no ativo atualizado acima');
  console.log('  2. Login owner@local -> /aprovacoes -> Pendentes (Owner) -> Aprovar');
  console.log('  3. Login steward@local -> /aprovacoes -> Pendentes (Steward) -> Aprovar');

  await client.end();
}

main().catch(console.error);
