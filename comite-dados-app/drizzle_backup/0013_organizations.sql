CREATE TABLE `organizations` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `name` varchar(256) NOT NULL,
  `slug` varchar(64) NOT NULL,
  `logoUrl` text,
  `primaryColor` varchar(16) DEFAULT '#1B3A8C',
  `secondaryColor` varchar(16) DEFAULT '#6DC23A',
  `plan` enum('starter','professional','enterprise') DEFAULT 'professional',
  `maxUsers` int DEFAULT 50,
  `maxAssets` int DEFAULT 500,
  `allowSso` boolean DEFAULT false,
  `ssoMetadataUrl` text,
  `defaultLocale` varchar(8) DEFAULT 'pt-BR',
  `timezone` varchar(64) DEFAULT 'America/Sao_Paulo',
  `active` boolean DEFAULT true,
  `trialEndsAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT NOW(),
  `updatedAt` timestamp NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE (`slug`)
);

-- Inserir organização padrão (Lucid Data Governance)
INSERT INTO `organizations` (`name`, `slug`, `primaryColor`, `secondaryColor`, `plan`, `maxUsers`, `maxAssets`, `defaultLocale`, `timezone`)
VALUES ('Lucid Data Governance', 'lucid-data', '#1B3A8C', '#6DC23A', 'enterprise', 500, 5000, 'pt-BR', 'America/Sao_Paulo');

-- Adicionar FK de organização na tabela de usuários (multi-tenancy)
-- Todos os usuários existentes passam a pertencer à organização padrão (ID 1)
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `organizationId` int DEFAULT 1;

-- Adicionar FK de organização na tabela de ativos (multi-tenancy)
ALTER TABLE `data_assets` ADD COLUMN IF NOT EXISTS `organizationId` int DEFAULT 1;

-- Adicionar nome completo do objeto na origem (ex: catalog.schema.table no Databricks Unity Catalog)
-- Usado para grant automático de permissões após aprovação de acesso
ALTER TABLE `data_assets` ADD COLUMN IF NOT EXISTS `fullyQualifiedName` varchar(512) NULL;
