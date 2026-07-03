-- Migration 0019: Marketplace de Conectores
CREATE TABLE IF NOT EXISTS `connector_configs` (
  `id`               INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `connectorType`    VARCHAR(64) NOT NULL,
  `name`             VARCHAR(256) NOT NULL,
  `configJson`       JSON NOT NULL,
  `active`           BOOLEAN NOT NULL DEFAULT TRUE,
  `lastTestedAt`     TIMESTAMP NULL,
  `lastTestSuccess`  BOOLEAN NULL,
  `lastTestMessage`  TEXT NULL,
  `createdById`      INT NULL,
  `createdAt`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
