# Operações

## Health checks

- Endpoint HTTP público: /api/health
- Endpoint Prometheus: /api/prometheus
- OpenAPI: /api/v1/openapi.json

## Smoke test

Executar após gerar o build:

```bash
npm run build
npm run smoke
```

O smoke test sobe o servidor em modo produção, valida /api/health, valida a OpenAPI pública e confirma o graceful shutdown via SIGTERM.

## Backup do banco

Pré-requisitos:

- DATABASE_URL configurada
- mysqldump disponível no PATH ou em MYSQLDUMP_BIN

Execução:

```bash
npm run backup:db
```

### Automação via Crontab (Linux)

Para automatizar o backup diário em um servidor Linux:

1. Edite o crontab do usuário: `crontab -e`
2. Adicione a linha abaixo (exemplo para rodar todo dia às 03:00):

```bash
0 3 * * * cd /caminho/para/o/projeto && /usr/bin/node scripts/backup-db.mjs >> /var/log/comite-backup.log 2>&1
```

*Nota: Certifique-se de que as variáveis de ambiente (DATABASE_URL) estão disponíveis para o cron (pode ser necessário carregar um arquivo .env ou exportar antes do comando).*

Variáveis opcionais:

- BACKUP_DIR: diretório de saída dos dumps
- MYSQLDUMP_BIN: caminho explícito do binário mysqldump

## Restore básico

```bash
mysql -h <host> -P <porta> -u <usuario> -p <database> < arquivo.sql
```

## Rotina mínima recomendada

- Build + smoke a cada merge
- Backup diário do MySQL
- Teste de restore pelo menos uma vez por sprint
- Monitorar /api/health e /api/prometheus