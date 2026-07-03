import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

async function upsertUser(c, { email, name, role }) {
  const hash = await bcrypt.hash('admin', 10);
  const [rows] = await c.query('SELECT id FROM users WHERE email = ?', [email]);
  if (rows.length > 0) {
    await c.query(
      "UPDATE users SET passwordHash = ?, role = ?, loginMethod = 'local', name = ? WHERE email = ?",
      [hash, role, name, email]
    );
    console.log(`[user atualizado] ${email} | role: ${role} | ID: ${rows[0].id}`);
    return rows[0].id;
  } else {
    const openId = 'local_' + email.replace(/[^a-z0-9]/gi, '_') + '_' + Date.now();
    const [res] = await c.query(
      "INSERT INTO users (openId, name, email, passwordHash, loginMethod, role, createdAt, updatedAt, lastSignedIn) VALUES (?, ?, ?, ?, 'local', ?, NOW(), NOW(), NOW())",
      [openId, name, email, hash, role]
    );
    console.log(`[user criado] ${email} | role: ${role} | ID: ${res.insertId}`);
    return res.insertId;
  }
}

async function upsertParticipant(c, { name, email, role, userId }) {
  const [rows] = await c.query('SELECT id FROM participants WHERE email = ?', [email]);
  if (rows.length > 0) {
    await c.query(
      'UPDATE participants SET name = ?, role = ?, userId = ?, status = ? WHERE email = ?',
      [name, role, userId, 'ativo', email]
    );
    console.log(`[participant atualizado] ${email} | role: ${role} | ID: ${rows[0].id}`);
    return rows[0].id;
  } else {
    const [res] = await c.query(
      "INSERT INTO participants (name, email, role, userId, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, 'ativo', NOW(), NOW())",
      [name, email, role, userId]
    );
    console.log(`[participant criado] ${email} | role: ${role} | ID: ${res.insertId}`);
    return res.insertId;
  }
}

async function main() {
  const c = await mysql.createConnection('mysql://root@127.0.0.1:3306/comite_dados');

  // 1. Criar/atualizar usuários
  const adminId  = await upsertUser(c, { email: 'admin@local',   name: 'Admin',        role: 'admin'        });
  const ownerId  = await upsertUser(c, { email: 'owner@local',   name: 'Data Owner',   role: 'data_owner'   });
  const stewardId = await upsertUser(c, { email: 'steward@local', name: 'Data Steward', role: 'data_steward' });

  // 2. Criar/atualizar participantes vinculados aos usuários
  const ownerParticipantId  = await upsertParticipant(c, { name: 'Data Owner',   email: 'owner@local',   role: 'data_owner',   userId: ownerId  });
  const stewardParticipantId = await upsertParticipant(c, { name: 'Data Steward', email: 'steward@local', role: 'data_steward', userId: stewardId });

  // 3. Verificar se existe algum ativo de dados; se não, criar um de teste
  const [assets] = await c.query('SELECT id, name FROM data_assets LIMIT 5');
  if (assets.length === 0) {
    const [res] = await c.query(
      "INSERT INTO data_assets (name, type, description, sensitivity, status, ownerId, stewardId, createdAt, updatedAt) VALUES ('Ativo de Teste', 'tabela', 'Ativo criado para simulação de aprovações', 'interno', 'ativo', ?, ?, NOW(), NOW())",
      [ownerParticipantId, stewardParticipantId]
    );
    console.log(`[ativo criado] "Ativo de Teste" | ID: ${res.insertId} | ownerId: ${ownerParticipantId} | stewardId: ${stewardParticipantId}`);
  } else {
    // Associar o primeiro ativo existente ao owner e steward de teste
    const asset = assets[0];
    await c.query(
      'UPDATE data_assets SET ownerId = ?, stewardId = ? WHERE id = ?',
      [ownerParticipantId, stewardParticipantId, asset.id]
    );
    console.log(`[ativo atualizado] "${asset.name}" (ID: ${asset.id}) -> ownerId: ${ownerParticipantId}, stewardId: ${stewardParticipantId}`);
    // Lista os ativos disponíveis
    console.log('\nAtivos disponíveis no catálogo:');
    assets.forEach(a => console.log(`  ID ${a.id}: ${a.name}`));
  }

  console.log('\n=== RESUMO ===');
  console.log('Todos os usuários têm senha: admin');
  console.log(`  admin@local   (ID ${adminId})   -> admin | pode criar solicitações`);
  console.log(`  owner@local   (ID ${ownerId})   -> data_owner | participante ID ${ownerParticipantId}`);
  console.log(`  steward@local (ID ${stewardId}) -> data_steward | participante ID ${stewardParticipantId}`);
  console.log('\nFluxo de teste:');
  console.log('  1. Login admin@local -> Catálogo -> Solicitar Acesso no ativo atualizado acima');
  console.log('  2. Login owner@local -> /aprovacoes -> Pendentes (Owner) -> Aprovar');
  console.log('  3. Login steward@local -> /aprovacoes -> Pendentes (Steward) -> Aprovar');

  await c.end();
}

main().catch(console.error);


