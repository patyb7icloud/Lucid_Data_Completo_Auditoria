-- Webhooks e API Keys
CREATE TABLE IF NOT EXISTS webhook_configs (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(256) NOT NULL,
  url             TEXT NOT NULL,
  secret          VARCHAR(256) NULL,
  events          JSON NOT NULL,
  active          TINYINT(1) NOT NULL DEFAULT 1,
  failureCount    INT DEFAULT 0,
  lastTriggeredAt TIMESTAMP NULL,
  lastStatusCode  INT NULL,
  createdById     INT NULL,
  createdAt  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_webhook_active (active)
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  webhookConfigId  INT NOT NULL,
  event            VARCHAR(128) NOT NULL,
  payload          JSON NOT NULL,
  statusCode       INT NULL,
  responseBody     TEXT,
  success          TINYINT(1) DEFAULT 0,
  attemptCount     INT DEFAULT 1,
  deliveredAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wd_webhook (webhookConfigId),
  INDEX idx_wd_event (event),
  INDEX idx_wd_delivered (deliveredAt)
);

CREATE TABLE IF NOT EXISTS sso_configs (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  organizationId   INT NOT NULL UNIQUE,
  provider         ENUM('saml','oidc') NOT NULL DEFAULT 'saml',
  entryPoint       TEXT,
  issuer           VARCHAR(512),
  certificate      TEXT,
  callbackUrl      TEXT,
  clientId         VARCHAR(512),
  clientSecret     TEXT,
  discoveryUrl     TEXT,
  active           TINYINT(1) NOT NULL DEFAULT 0,
  lastTestedAt     TIMESTAMP NULL,
  lastTestSuccess  TINYINT(1) NULL,
  createdAt  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_keys (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(256) NOT NULL,
  keyHash      VARCHAR(256) NOT NULL UNIQUE,
  keyPrefix    VARCHAR(8) NOT NULL,
  scopes       JSON NOT NULL,
  active       TINYINT(1) NOT NULL DEFAULT 1,
  lastUsedAt   TIMESTAMP NULL,
  expiresAt    TIMESTAMP NULL,
  createdById  INT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_api_key_hash (keyHash),
  INDEX idx_api_key_prefix (keyPrefix),
  INDEX idx_api_key_active (active)
);
