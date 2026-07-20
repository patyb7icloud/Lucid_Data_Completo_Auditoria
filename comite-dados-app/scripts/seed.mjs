/**
 * seed.mjs — Seed inicial da plataforma Comitê de Dados — Lucid Data Governance
 *
 * Popula o banco de dados com os dados estruturais do Comitê:
 *   • 7 domínios de dados da VC (idempotente — upsert por nome)
 *   • 17 participantes com papéis do Comitê (idempotente — upsert por e-mail)
 *   • 1 usuário administrador local (idempotente — upsert por e-mail)
 *
 * INSTRUÇÕES DE USO:
 *   1. Copie env.example.txt para .env e preencha DATABASE_URL
 *   2. Execute: node scripts/seed.mjs
 *      ou via Docker: docker compose exec app node scripts/seed.mjs
 *
 * SEGURANÇA:
 *   O admin criado usa senha temporária "Mudar@123!".
 *   Altere imediatamente após o primeiro login.
 *
 * IDEMPOTÊNCIA:
 *   Pode ser executado várias vezes sem duplicar registros.
 *   Domínios e participantes já existentes são atualizados, não recriados.
 */

import pg from "pg";
const { Client } = pg;
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ─── Carregar .env (se existir) ───────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");

try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
} catch {
  // .env não encontrado — usar variáveis do ambiente do sistema
}

// ─── Configuração ─────────────────────────────────────────────────────────────

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://comite_user:senha_segura@localhost:5432/comite_dados";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@lucid-data.com.br";
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || "Administrador do Sistema";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Mudar@123!";

// ─── Dados de seed ────────────────────────────────────────────────────────────

const DOMAINS = [
  {
    name: "Dados Comerciais",
    description:
      "Domínio responsável pelos dados de vendas, clientes, contratos e receita.",
    color: "#1B3A8C",
    icon: "ShoppingCart",
    responsible: null,
  },
  {
    name: "Dados de Produção",
    description:
      "Domínio responsável pelos dados de manufatura, qualidade e eficiência operacional.",
    color: "#6DC23A",
    icon: "Factory",
    responsible: null,
  },
  {
    name: "Dados Financeiros",
    description:
      "Domínio responsável pelos dados contábeis, orçamentários e de custos.",
    color: "#F59E0B",
    icon: "DollarSign",
    responsible: null,
  },
  {
    name: "Dados de RH",
    description:
      "Domínio responsável pelos dados de colaboradores, cargos, folha de pagamento e treinamentos.",
    color: "#8B5CF6",
    icon: "Users",
    responsible: null,
  },
  {
    name: "Dados de Logística",
    description:
      "Domínio responsável pelos dados de transporte, distribuição, estoque e supply chain.",
    color: "#EC4899",
    icon: "Truck",
    responsible: null,
  },
  {
    name: "Dados de Sustentabilidade",
    description:
      "Domínio responsável pelos dados de emissões, consumo de recursos e indicadores ESG.",
    color: "#10B981",
    icon: "Leaf",
    responsible: null,
  },
  {
    name: "Dados de TI e Infraestrutura",
    description:
      "Domínio responsável pelos dados de sistemas, ativos de TI, segurança e disponibilidade.",
    color: "#6B7280",
    icon: "Server",
    responsible: null,
  },
];

// Participantes: domainIndex (0-based) corresponde à posição em DOMAINS acima
const PARTICIPANTS = [
  {
    name: "Ana Paula Ferreira",
    email: "ana.ferreira@lucid-data.com",
    jobTitle: "Chief Data Officer",
    department: "Diretoria de Dados e IA",
    phone: "+55 11 3000-0001",
    domainIndex: 0, // Dados Comerciais
    role: "data_owner",
  },
  {
    name: "Carlos Eduardo Lima",
    email: "carlos.lima@lucid-data.com",
    jobTitle: "Gerente de Governança de Dados",
    department: "Tecnologia da Informação",
    phone: "+55 11 3000-0002",
    domainIndex: 6, // Dados de TI e Infraestrutura
    role: "data_steward",
  },
  {
    name: "Mariana Costa Souza",
    email: "mariana.souza@lucid-data.com",
    jobTitle: "Diretora Financeira",
    department: "Controladoria",
    phone: "+55 11 3000-0003",
    domainIndex: 2, // Dados Financeiros
    role: "data_owner",
  },
  {
    name: "Roberto Alves Neto",
    email: "roberto.neto@lucid-data.com",
    jobTitle: "Diretor de RH",
    department: "Recursos Humanos",
    phone: "+55 11 3000-0004",
    domainIndex: 3, // Dados de RH
    role: "data_owner",
  },
  {
    name: "Fernanda Oliveira",
    email: "fernanda.oliveira@lucid-data.com",
    jobTitle: "Diretora de Produção",
    department: "Operações Industriais",
    phone: "+55 11 3000-0005",
    domainIndex: 1, // Dados de Produção
    role: "data_owner",
  },
  {
    name: "Thiago Mendes",
    email: "thiago.mendes@lucid-data.com",
    jobTitle: "Analista Sênior de Dados Comerciais",
    department: "Comercial",
    phone: "+55 11 3000-0006",
    domainIndex: 0, // Dados Comerciais
    role: "data_steward",
  },
  {
    name: "Juliana Ramos",
    email: "juliana.ramos@lucid-data.com",
    jobTitle: "Analista de Dados Financeiros",
    department: "Controladoria",
    phone: "+55 11 3000-0007",
    domainIndex: 2, // Dados Financeiros
    role: "data_steward",
  },
  {
    name: "Paulo Henrique Santos",
    email: "paulo.santos@lucid-data.com",
    jobTitle: "Analista de Dados de RH",
    department: "Recursos Humanos",
    phone: "+55 11 3000-0008",
    domainIndex: 3, // Dados de RH
    role: "data_steward",
  },
  {
    name: "Camila Torres",
    email: "camila.torres@lucid-data.com",
    jobTitle: "Analista de Dados de Logística",
    department: "Logística",
    phone: "+55 11 3000-0009",
    domainIndex: 4, // Dados de Logística
    role: "data_steward",
  },
  {
    name: "Diego Barbosa",
    email: "diego.barbosa@lucid-data.com",
    jobTitle: "Analista de Dados de Produção",
    department: "Operações Industriais",
    phone: "+55 11 3000-0010",
    domainIndex: 1, // Dados de Produção
    role: "data_steward",
  },
  {
    name: "Luciana Pinto",
    email: "luciana.pinto@lucid-data.com",
    jobTitle: "Arquiteta de Dados",
    department: "Tecnologia da Informação",
    phone: "+55 11 3000-0011",
    domainIndex: 6, // Dados de TI e Infraestrutura
    role: "data_steward",
  },
  {
    name: "Rafael Cardoso",
    email: "rafael.cardoso@lucid-data.com",
    jobTitle: "Engenheiro de Dados Sênior",
    department: "Tecnologia da Informação",
    phone: "+55 11 3000-0012",
    domainIndex: 6, // Dados de TI e Infraestrutura
    role: "data_steward",
  },
  {
    name: "Patrícia Gomes",
    email: "patricia.gomes@lucid-data.com",
    jobTitle: "Especialista em Dados ESG",
    department: "Sustentabilidade",
    phone: "+55 11 3000-0013",
    domainIndex: 5, // Dados de Sustentabilidade
    role: "data_steward",
  },
  {
    name: "André Luiz Vieira",
    email: "andre.vieira@lucid-data.com",
    jobTitle: "Gerente Jurídico — LGPD",
    department: "Jurídico",
    phone: "+55 11 3000-0014",
    domainIndex: 0, // Dados Comerciais
    role: "representante_negocio",
  },
  {
    name: "Beatriz Nascimento",
    email: "beatriz.nascimento@lucid-data.com",
    jobTitle: "Auditora Sênior",
    department: "Auditoria Interna",
    phone: "+55 11 3000-0015",
    domainIndex: 2, // Dados Financeiros
    role: "representante_negocio",
  },
  {
    name: "Gustavo Faria",
    email: "gustavo.faria@lucid-data.com",
    jobTitle: "Gerente de Supply Chain",
    department: "Supply Chain",
    phone: "+55 11 3000-0016",
    domainIndex: 4, // Dados de Logística
    role: "representante_negocio",
  },
  {
    name: "Isabela Monteiro",
    email: "isabela.monteiro@lucid-data.com",
    jobTitle: "Gerente de Sustentabilidade",
    department: "Sustentabilidade",
    phone: "+55 11 3000-0017",
    domainIndex: 5, // Dados de Sustentabilidade
    role: "representante_negocio",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(symbol, msg) {
  console.log(`  ${symbol} ${msg}`);
}

/**
 * Upsert de domínio por nome.
 * Retorna o ID do domínio (existente ou recém-criado).
 */
async function upsertDomain(conn, domain) {
  const resultSel = await conn.query(
    'SELECT id FROM "domains" WHERE "name" = $1 LIMIT 1',
    [domain.name]
  );

  if (resultSel.rows.length > 0) {
    await conn.query(
      `UPDATE "domains"
         SET "description" = $1, "color" = $2, "icon" = $3,
             "responsible" = $4, "updatedAt" = NOW()
       WHERE "name" = $5`,
      [domain.description, domain.color, domain.icon, domain.responsible, domain.name]
    );
    log("↺", `Domínio atualizado  : "${domain.name}" (ID ${resultSel.rows[0].id})`);
    return resultSel.rows[0].id;
  }

  const resultIns = await conn.query(
    `INSERT INTO "domains"
       ("name", "description", "color", "icon", "responsible",
        "implementationProgress", "status", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 0, 'planejado', NOW(), NOW()) RETURNING id`,
    [domain.name, domain.description, domain.color, domain.icon, domain.responsible]
  );
  log("+", `Domínio criado      : "${domain.name}" (ID ${resultIns.rows[0].id})`);
  return resultIns.rows[0].id;
}

/**
 * Upsert de participante por e-mail.
 * Retorna o ID do participante (existente ou recém-criado).
 */
async function upsertParticipant(conn, participant, domainId) {
  const resultSel = await conn.query(
    'SELECT id FROM "participants" WHERE "email" = $1 LIMIT 1',
    [participant.email]
  );

  if (resultSel.rows.length > 0) {
    await conn.query(
      `UPDATE "participants"
         SET "name" = $1, "jobTitle" = $2, "department" = $3,
             "phone" = $4, "domainId" = $5, "role" = $6,
             "status" = 'ativo', "updatedAt" = NOW()
       WHERE "email" = $7`,
      [
        participant.name,
        participant.jobTitle,
        participant.department,
        participant.phone,
        domainId,
        participant.role,
        participant.email,
      ]
    );
    log("↺", `Participante atualizado : ${participant.name} <${participant.email}>`);
    return resultSel.rows[0].id;
  }

  const resultIns = await conn.query(
    `INSERT INTO "participants"
       ("name", "email", "jobTitle", "department", "phone",
        "domainId", "role", "status", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'ativo', NOW(), NOW()) RETURNING id`,
    [
      participant.name,
      participant.email,
      participant.jobTitle,
      participant.department,
      participant.phone,
      domainId,
      participant.role,
    ]
  );
  log("+", `Participante criado     : ${participant.name} <${participant.email}>`);
  return resultIns.rows[0].id;
}

/**
 * Upsert de usuário admin por e-mail.
 */
async function upsertAdmin(conn, { email, name, password }) {
  const passwordHash = await bcrypt.hash(password, 12);
  const resultSel = await conn.query(
    'SELECT id FROM "users" WHERE "email" = $1 LIMIT 1',
    [email]
  );

  if (resultSel.rows.length > 0) {
    await conn.query(
      `UPDATE "users"
         SET "name" = $1, "passwordHash" = $2, "role" = 'admin',
             "loginMethod" = 'local', "updatedAt" = NOW()
       WHERE "email" = $3`,
      [name, passwordHash, email]
    );
    log("↺", `Admin atualizado    : ${email} (ID ${resultSel.rows[0].id})`);
    return resultSel.rows[0].id;
  }

  const openId = `local_${email.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}`;
  const resultIns = await conn.query(
    `INSERT INTO "users"
       ("openId", "name", "email", "passwordHash", "loginMethod",
        "role", "mustChangePassword", "createdAt", "updatedAt", "lastSignedIn")
     VALUES ($1, $2, $3, $4, 'local', 'admin', true, NOW(), NOW(), NOW()) RETURNING id`,
    [openId, name, email, passwordHash]
  );
  log("+", `Admin criado        : ${email} (ID ${resultIns.rows[0].id}) — senha temporária definida`);
  return resultIns.rows[0].id;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     Seed — Comitê de Dados · Lucid Data Governance          ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();

  let conn;
  try {
    conn = new Client({ connectionString: DATABASE_URL });
    await conn.connect();
    console.log(`  ✓ Conectado ao banco: ${new URL(DATABASE_URL).hostname}`);
    console.log();
  } catch (err) {
    console.error("  ✗ Falha ao conectar ao banco de dados:");
    console.error("   ", err.message);
    console.error();
    console.error("  Verifique DATABASE_URL no arquivo .env ou nas variáveis de ambiente.");
    process.exit(1);
  }

  try {
    // ── 1. Domínios ────────────────────────────────────────────────
    console.log("── Domínios de dados (" + DOMAINS.length + ") ───────────────────────────────");
    const domainIds = [];
    for (const domain of DOMAINS) {
      const id = await upsertDomain(conn, domain);
      domainIds.push(id);
    }
    console.log();

    // ── 2. Participantes ───────────────────────────────────────────
    console.log("── Participantes (" + PARTICIPANTS.length + ") ──────────────────────────────────");
    for (const participant of PARTICIPANTS) {
      const domainId = domainIds[participant.domainIndex];
      await upsertParticipant(conn, participant, domainId);
    }
    console.log();

    // ── 3. Usuário administrador ───────────────────────────────────
    console.log("── Usuário administrador ────────────────────────────────────");
    await upsertAdmin(conn, {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      password: ADMIN_PASSWORD,
    });
    console.log();

    // ── Resumo ─────────────────────────────────────────────────────
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║  Seed concluído com sucesso!                               ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    console.log();
    console.log("  Acesso inicial:");
    console.log(`    E-mail : ${ADMIN_EMAIL}`);
    console.log(`    Senha  : ${ADMIN_PASSWORD}`);
    console.log();
    console.log("  ⚠  ALTERE A SENHA após o primeiro login!");
    console.log();
    console.log("  Variáveis para customizar o admin:");
    console.log("    SEED_ADMIN_EMAIL    (padrão: admin@lucid-data.com.br)");
    console.log("    SEED_ADMIN_NAME     (padrão: Administrador do Sistema)");
    console.log("    SEED_ADMIN_PASSWORD (padrão: Mudar@123!)");
    console.log();
  } catch (err) {
    console.error("  ✗ Erro durante o seed:");
    console.error("   ", err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
