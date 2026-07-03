-- SLA de Dados: configurações e violações
CREATE TABLE IF NOT EXISTS sla_configs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(256) NOT NULL,
  description  TEXT,
  entityType   ENUM('asset','domain','global') NOT NULL DEFAULT 'global',
  entityId     INT NULL,
  -- Thresholds
  maxUpdateDays        INT     DEFAULT 30,
  minQualityScore      FLOAT   DEFAULT 70,
  maxAccessResponseDays INT    DEFAULT 5,
  -- Alertas
  alertEmails          TEXT,
  alertOnBreachOnly    TINYINT(1) DEFAULT 1,
  active               TINYINT(1) NOT NULL DEFAULT 1,
  createdById          INT NULL,
  createdAt   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sla_entity (entityType, entityId),
  INDEX idx_sla_active (active)
);

CREATE TABLE IF NOT EXISTS sla_violations (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  slaConfigId    INT NOT NULL,
  entityType     ENUM('asset','access_request') NOT NULL,
  entityId       INT NOT NULL,
  entityName     VARCHAR(256),
  violationType  ENUM('stale_data','low_quality','slow_access_response') NOT NULL,
  daysOverdue    INT DEFAULT 0,
  notificationSent TINYINT(1) DEFAULT 0,
  details        JSON,
  resolvedAt     TIMESTAMP NULL,
  detectedAt     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sla_config_id (slaConfigId),
  INDEX idx_violation_entity (entityType, entityId),
  INDEX idx_violation_detected (detectedAt),
  INDEX idx_violation_resolved (resolvedAt)
);

-- Seed: configuração global padrão
INSERT IGNORE INTO sla_configs (name, description, entityType, maxUpdateDays, minQualityScore, maxAccessResponseDays, active)
VALUES (
  'SLA Padrão Global',
  'Configuração padrão de SLA aplicada a todos os ativos sem SLA específico',
  'global', 30, 70, 5, 1
);
