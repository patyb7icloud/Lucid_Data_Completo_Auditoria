# Lucid Data Governance — Plataforma de Governança

Plataforma enterprise de governança de dados: catálogo, dicionário, linhagem, qualidade, LGPD/DSAR, glossário de negócios, contratos de dados, maturidade, auditoria e gestão de reuniões do comitê.

---

## Pré-requisitos

| Ferramenta | Versão mínima |
|---|---|
| Node.js | 22 |
| pnpm | 10 |
| PostgreSQL | 16 |
| Docker + Compose | 24 (opcional, para produção) |

---

## Quickstart — Desenvolvimento local

```bash
# 1. Clone e instale as dependências
pnpm install

# 2. Configure as variáveis de ambiente
cp env.example.txt .env
# Edite .env com suas credenciais (DATABASE_URL, JWT_SECRET no mínimo)

# 3. Crie o banco e aplique todas as migrações
node create-db.js
node run-migrations.js

# 4. Inicie o servidor de desenvolvimento (hot-reload)
pnpm dev
```

A aplicação estará disponível em `http://localhost:3000`.

---

## Primeiro login

Após criar o banco, crie o usuário administrador:

```bash
node create-admin.js
```

Acesse a aplicação com as credenciais exibidas e troque a senha no primeiro login.

---

## Produção — Docker Compose

```bash
# 1. Configure as variáveis de ambiente
cp env.example.txt .env
# Edite APP_DOMAIN, DATABASE_URL, JWT_SECRET e demais variáveis

# 2. Suba a stack completa (PostgreSQL + App + Caddy com SSL automático)
docker compose up -d --build

# 3. Execute as migrações na primeira execução
docker compose exec app node run-migrations.js

# 4. Crie o administrador inicial
docker compose exec app node create-admin.js
```

O Caddy obtém e renova certificados SSL automaticamente via Let's Encrypt.

---

## Variáveis de ambiente essenciais

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Conexão PostgreSQL: `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Chave secreta para tokens JWT (mínimo 32 chars) |
| `NODE_ENV` | `development` ou `production` |
| `APP_DOMAIN` | Domínio público (usado pelo Caddy para SSL) |
| `APP_PUBLIC_URL` | URL pública completa (links de e-mail, reset de senha) |
| `STORAGE_PROVIDER` | `local` \| `s3` \| `azure` (padrão: `local`) |
| `PORT` | Porta do servidor (padrão: `3000`) |

Para a lista completa, consulte [`env.example.txt`](env.example.txt).

Autenticação via **Microsoft Entra ID** é opcional — configure `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET` e `ENTRA_TENANT_ID` para habilitá-la.

---

## Scripts disponíveis

```bash
pnpm dev          # Servidor com hot-reload
pnpm build        # Build de produção (frontend + backend)
pnpm start        # Inicia o build de produção
pnpm check        # Typecheck TypeScript (sem emitir arquivos)
pnpm test         # Executa os testes unitários (Vitest)
pnpm run smoke    # Smoke test do build de produção
pnpm run backup:db # Backup completo do banco (pg_dump)
pnpm run seed     # Popula o banco com dados de demonstração
```

---

## Arquitetura

```
client/          React 19 + Vite 7 + Tailwind CSS 4
server/          Node.js + Express + tRPC 11 + Drizzle ORM
shared/          Tipos e constantes compartilhados
drizzle/         Migrações e schema do banco (PostgreSQL 16)
scripts/         Utilitários (backup, seed, smoke test)
docs/            Runbooks operacionais
```

### Endpoints notáveis

| Rota | Descrição |
|---|---|
| `GET /api/health` | Health check público (JSON) |
| `GET /api/prometheus` | Métricas no formato Prometheus |
| `GET /api/v1/openapi.json` | Especificação OpenAPI 3.0 da API pública |
| `/api/trpc/*` | API tRPC para o frontend |
| `POST /api/auth/login` | Autenticação local |
| `POST /api/auth/forgot-password` | Reset de senha por e-mail |

---

## Testes

```bash
pnpm test
```

Os testes cobrem: logout de sessão, exportação, logger estruturado, lógica do comitê e controle de acesso por papel.

Para rodar o smoke test (valida o build de produção completo incluindo graceful shutdown):

```bash
pnpm build && pnpm run smoke
```

---

## Backup e Restore

```bash
# Backup
pnpm run backup:db
# Arquivo gerado em ./backups/comite_dados-<timestamp>.sql

# Restore
psql -h <host> -p <porta> -U <usuario> -d <database> -f arquivo.sql
```

Consulte [`docs/OPERATIONS.md`](docs/OPERATIONS.md) para rotinas operacionais completas.

---

## Segurança

- Senhas armazenadas com **bcrypt** (SALT\_ROUNDS=12)
- Sessões via **JWT HttpOnly cookie** assinado com `jose`
- Rate limiting: 10 tentativas / 15 min por IP no login; 100 req/min na API pública
- Cabeçalhos de segurança via Caddy: `X-Frame-Options`, `X-Content-Type-Options`, `HSTS`, `Referrer-Policy`
- Usuário não-root no container Docker
- Logs estruturados em JSON com correlation ID por requisição

---

## Contribuição

1. Crie uma branch a partir de `main`
2. Abra um PR — o CI valida typecheck, testes e build automaticamente
3. Merges diretos em `main` estão desabilitados

---

## Licença

MIT
