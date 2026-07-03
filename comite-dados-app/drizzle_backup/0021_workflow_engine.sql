-- Migração 0021: Workflow Engine de Aprovações
-- Cria tabelas para definições de fluxo e instâncias de execução

-- ─── workflow_definitions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  orgId       INT NOT NULL,
  name        VARCHAR(256) NOT NULL,
  description TEXT,
  -- JSON array de steps: [{id, type, label, approvers[], parallelAll?, notifyEmails[]}]
  stepsJson   JSON NOT NULL,
  -- Quais objetos disparam este fluxo: 'asset', 'glossary_term', 'data_contract', 'lgpd_mapping'
  triggerEntityType VARCHAR(64) NOT NULL DEFAULT 'asset',
  -- Disparo automático vs manual
  autoTrigger BOOLEAN NOT NULL DEFAULT FALSE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX idx_wdef_org (orgId),
  INDEX idx_wdef_trigger (triggerEntityType)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── workflow_instances ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_instances (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  definitionId     INT NOT NULL,
  -- Entidade associada (asset, glossary_term, etc.)
  entityType       VARCHAR(64) NOT NULL,
  entityId         INT NOT NULL,
  -- Step atual (índice 0-based no stepsJson da definição)
  currentStep      INT NOT NULL DEFAULT 0,
  -- Status geral: pending | approved | rejected | cancelled
  status           ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  -- Quem iniciou o fluxo
  initiatorOpenId  VARCHAR(128) NOT NULL,
  -- Contexto adicional (ex: motivo da submissão)
  contextJson      JSON,
  startedAt        TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  completedAt      TIMESTAMP NULL,
  updatedAt        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX idx_winst_def (definitionId),
  INDEX idx_winst_entity (entityType, entityId),
  INDEX idx_winst_status (status),
  FOREIGN KEY (definitionId) REFERENCES workflow_definitions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── workflow_step_actions ───────────────────────────────────────────────────
-- Registra cada decisão de um aprovador num step específico
CREATE TABLE IF NOT EXISTS workflow_step_actions (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  instanceId       INT NOT NULL,
  stepIndex        INT NOT NULL,
  actorOpenId      VARCHAR(128) NOT NULL,
  actorName        VARCHAR(256),
  -- Decisão: approved | rejected | delegated | commented
  decision         ENUM('approved','rejected','delegated','commented') NOT NULL,
  comment          TEXT,
  createdAt        TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX idx_wsa_instance (instanceId),
  FOREIGN KEY (instanceId) REFERENCES workflow_instances(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
