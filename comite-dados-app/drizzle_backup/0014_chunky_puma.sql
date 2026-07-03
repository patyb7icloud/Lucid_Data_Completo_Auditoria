CREATE TABLE `access_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketNumber` varchar(64) NOT NULL,
	`assetId` int NOT NULL,
	`requesterId` int,
	`requesterName` varchar(256),
	`requesterEmail` varchar(320),
	`nivelAcesso` enum('leitura','leitura_escrita') NOT NULL,
	`papelGrupo` varchar(256) NOT NULL,
	`baseLegal` enum('legitimo_interesse','execucao_contrato') NOT NULL,
	`finalidade` text NOT NULL,
	`prazoNecessidade` varchar(128),
	`checklistJson` text,
	`envolveTerceiros` boolean DEFAULT false,
	`statusOwner` enum('pendente','aprovado','rejeitado') DEFAULT 'pendente',
	`ownerApprovedAt` timestamp NULL DEFAULT NULL,
	`ownerComment` text,
	`ownerId` int,
	`statusSteward` enum('pendente','aguardando','aprovado','rejeitado') DEFAULT 'aguardando',
	`stewardApprovedAt` timestamp NULL DEFAULT NULL,
	`stewardComment` text,
	`stewardId` int,
	`status` enum('pendente_owner','pendente_steward','aprovado','rejeitado_owner','rejeitado_steward') DEFAULT 'pendente_owner',
	`flowType` enum('acesso_dados','dados_restritos','terceiros','projeto_ia') DEFAULT 'acesso_dados',
	`priority` enum('baixa','media','alta') DEFAULT 'media',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `access_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`keyHash` varchar(256) NOT NULL,
	`keyPrefix` varchar(8) NOT NULL,
	`scopes` json NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`lastUsedAt` timestamp NULL DEFAULT NULL,
	`expiresAt` timestamp NULL DEFAULT NULL,
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_keys_keyHash_unique` UNIQUE(`keyHash`)
);
--> statement-breakpoint
CREATE TABLE `asset_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(256) NOT NULL,
	`content` text NOT NULL,
	`parentId` int,
	`resolved` tinyint DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `asset_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`userEmail` varchar(320),
	`userName` varchar(256),
	`action` enum('create','update','delete','view','export','approve','reject','login','logout','access_request','role_change') NOT NULL,
	`entity` varchar(64) NOT NULL,
	`entityId` int,
	`entityName` varchar(256),
	`details` json,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `business_glossary` (
	`id` int AUTO_INCREMENT NOT NULL,
	`term` varchar(256) NOT NULL,
	`definition` text NOT NULL,
	`abbreviation` varchar(64),
	`domainId` int,
	`ownerId` int,
	`status` enum('rascunho','em_revisao','aprovado','obsoleto') DEFAULT 'rascunho',
	`category` varchar(128),
	`synonyms` text,
	`examples` text,
	`notes` text,
	`relatedTermIds` text,
	`approvedBy` varchar(256),
	`approvedAt` timestamp NULL DEFAULT NULL,
	`createdById` int,
	`createdByName` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `business_glossary_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `connector_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`connectorType` varchar(64) NOT NULL,
	`name` varchar(256) NOT NULL,
	`configJson` json NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`lastTestedAt` timestamp NULL DEFAULT NULL,
	`lastTestSuccess` boolean,
	`lastTestMessage` text,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `connector_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `data_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`type` enum('tabela','api','arquivo','dashboard','outro') NOT NULL,
	`description` text,
	`region` varchar(64) DEFAULT 'Brasil',
	`domainId` int,
	`ownerId` int,
	`stewardId` int,
	`sourceSystem` varchar(128),
	`sensitivity` enum('publico','interno','confidencial','restrito') DEFAULT 'interno',
	`status` enum('ativo','em_construcao','desativado') DEFAULT 'ativo',
	`qualityScore` float DEFAULT 0,
	`rowCount` int DEFAULT 0,
	`lastSyncAt` timestamp NULL DEFAULT NULL,
	`businessArea` varchar(128),
	`criticality` enum('baixa','media','alta','critica') DEFAULT 'media',
	`businessValueScore` float DEFAULT 0,
	`organizationId` int DEFAULT 1,
	`fullyQualifiedName` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `data_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `data_attributes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`dataType` varchar(64),
	`description` text,
	`businessRules` text,
	`isPii` boolean DEFAULT false,
	`isKey` boolean DEFAULT false,
	`sampleValue` text,
	`isVerified` boolean DEFAULT false,
	`verifiedBy` varchar(256),
	`verifiedAt` timestamp NULL DEFAULT NULL,
	`aiSuggestion` text,
	`syncApproved` boolean DEFAULT false,
	`syncApprovedBy` varchar(256),
	`syncApprovedAt` timestamp NULL DEFAULT NULL,
	`lastSyncedAt` timestamp NULL DEFAULT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `data_attributes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `data_contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`assetId` int NOT NULL,
	`producerTeam` varchar(256) NOT NULL,
	`consumerTeam` varchar(256) NOT NULL,
	`description` text,
	`slaLevel` text,
	`schemaJson` json,
	`deliveryFrequency` varchar(128),
	`version` varchar(32) DEFAULT '1.0.0',
	`status` enum('rascunho','em_revisao','ativo','expirado','cancelado') NOT NULL DEFAULT 'rascunho',
	`signedAt` timestamp NULL DEFAULT NULL,
	`expiresAt` timestamp NULL DEFAULT NULL,
	`createdById` int,
	`createdByName` varchar(256),
	`approvedById` int,
	`approvedByName` varchar(256),
	`changeNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `data_contracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `data_lineage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceAssetId` int NOT NULL,
	`targetAssetId` int NOT NULL,
	`transformationRule` text,
	`type` enum('direto','transformado','agregado') DEFAULT 'direto',
	`sourceColumn` varchar(256),
	`targetColumn` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `data_lineage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `data_quality_checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`metricName` varchar(128) NOT NULL,
	`score` float NOT NULL,
	`threshold` float DEFAULT 95,
	`lastRunAt` timestamp DEFAULT (now()),
	`status` enum('sucesso','alerta','falha') NOT NULL,
	`details` text,
	CONSTRAINT `data_quality_checks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `data_quality_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`avgScore` float NOT NULL,
	`checksPassed` int DEFAULT 0,
	`checksTotal` int DEFAULT 0,
	`organizationId` int DEFAULT 1,
	`measuredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `data_quality_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dsar_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestType` enum('acesso','retificacao','exclusao','portabilidade','oposicao','revogacao_consentimento') NOT NULL,
	`status` enum('aberto','em_andamento','concluido','rejeitado') NOT NULL DEFAULT 'aberto',
	`subjectName` varchar(256) NOT NULL,
	`subjectEmail` varchar(320) NOT NULL,
	`subjectDocument` varchar(64),
	`description` text,
	`internalNotes` text,
	`responseDetails` text,
	`assignedToId` int,
	`assignedToName` varchar(256),
	`deadline` timestamp NULL DEFAULT NULL,
	`closedAt` timestamp NULL DEFAULT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dsar_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `intake_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeCode` varchar(32),
	`title` varchar(256) NOT NULL,
	`description` text NOT NULL,
	`type` enum('dado','projeto_ia','compliance','qualidade','acesso','outro') NOT NULL,
	`priority` enum('baixa','media','alta','critica') NOT NULL DEFAULT 'media',
	`desiredDeadline` varchar(64),
	`submittedById` int,
	`submitterName` varchar(256),
	`submitterEmail` varchar(320),
	`submitterDept` varchar(128),
	`problemStatement` text,
	`objective` text,
	`targetAudience` text,
	`usageFrequency` varchar(128),
	`financialImpact` text,
	`businessImpact` text,
	`technicalImpact` text,
	`sourceSystems` text,
	`mainEntities` text,
	`estimatedVolume` varchar(128),
	`updateFrequency` varchar(128),
	`historyNeeded` varchar(128),
	`containsPii` enum('sim','nao','nao_sei'),
	`piiColumns` text,
	`expectedFields` text,
	`qualityCriteria` json,
	`minDqScore` float,
	`dqFailAction` varchar(64),
	`successCriteria` json,
	`postDeliveryMeasurement` text,
	`dataOwnerName` varchar(256),
	`dataStewardName` varchar(256),
	`privacyChampion` varchar(256),
	`dataSensitivity` enum('publico','interno','confidencial','restrito'),
	`accessGroups` text,
	`applicableRegulations` varchar(256),
	`retentionPeriod` varchar(128),
	`technicalDependencies` text,
	`identifiedRisks` text,
	`relatedDemands` varchar(256),
	`testEnvironmentAvailable` varchar(128),
	`networkInfraNeeded` varchar(128),
	`managerApproval` varchar(256),
	`domainId` int,
	`assetId` int,
	`status` enum('rascunho','submetido','em_triagem','aprovado_estrategico','aprovado_operacional','retornado','rejeitado','em_execucao','em_validacao','concluido') NOT NULL DEFAULT 'submetido',
	`reviewedById` int,
	`reviewedByName` varchar(256),
	`reviewedAt` timestamp NULL DEFAULT NULL,
	`reviewNotes` text,
	`returnReason` text,
	`impactScore` int,
	`effortScore` int,
	`scoringNotes` text,
	`scoreFinancialImpact` tinyint,
	`scoreBusinessUrgency` tinyint,
	`scoreReach` tinyint,
	`scoreStrategicAlignment` tinyint,
	`scoreIntakeCompleteness` tinyint,
	`scoreTechnicalFeasibility` tinyint,
	`scoreReuse` tinyint,
	`scoreDataOwnerDefined` tinyint,
	`totalScore` int,
	`priorityTier` enum('P1','P2','P3','P4'),
	`triageChecklist` json,
	`executorId` int,
	`executorName` varchar(256),
	`executionStartedAt` timestamp NULL DEFAULT NULL,
	`executionNotes` text,
	`deliveredAt` timestamp NULL DEFAULT NULL,
	`validatedAt` timestamp NULL DEFAULT NULL,
	`validatedById` int,
	`validatedByName` varchar(256),
	`deliveryNotes` text,
	`relatedMeetingId` int,
	`agendaItemId` int,
	`externalTicketId` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `intake_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`slug` varchar(64) NOT NULL,
	`appName` varchar(128) DEFAULT 'Portal de Governança de Dados',
	`logoUrl` text,
	`faviconUrl` text,
	`primaryColor` varchar(16) DEFAULT '#1B3A8C',
	`secondaryColor` varchar(16) DEFAULT '#6DC23A',
	`customCss` text,
	`supportEmail` varchar(256),
	`supportUrl` text,
	`termsUrl` text,
	`privacyUrl` text,
	`plan` enum('starter','professional','enterprise') DEFAULT 'professional',
	`maxUsers` int DEFAULT 50,
	`maxAssets` int DEFAULT 500,
	`allowSso` boolean DEFAULT false,
	`ssoMetadataUrl` text,
	`defaultLocale` varchar(8) DEFAULT 'pt-BR',
	`timezone` varchar(64) DEFAULT 'America/Sao_Paulo',
	`active` boolean DEFAULT true,
	`trialEndsAt` timestamp NULL DEFAULT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `pia_assessments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(256) NOT NULL,
	`assetId` int,
	`assetName` varchar(256),
	`status` enum('rascunho','em_revisao','aprovado','rejeitado') NOT NULL DEFAULT 'rascunho',
	`riskLevel` enum('baixo','medio','alto','critico'),
	`dataCategories` json,
	`purposes` text,
	`legalBasis` varchar(128),
	`retentionPeriod` varchar(128),
	`crossBorderTransfer` boolean DEFAULT false,
	`thirdPartySharing` boolean DEFAULT false,
	`automatedDecision` boolean DEFAULT false,
	`mitigationMeasures` text,
	`residualRisk` text,
	`dpoRecommendation` text,
	`createdById` int,
	`createdByName` varchar(256),
	`reviewedById` int,
	`reviewedByName` varchar(256),
	`approvedAt` timestamp NULL DEFAULT NULL,
	`reviewNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pia_assessments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quality_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`ruleType` enum('completude','unicidade','validade','consistencia','regex') NOT NULL,
	`columnName` varchar(128),
	`threshold` float DEFAULT 95,
	`params` text,
	`customPattern` text,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quality_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quality_score_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`score` int NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	`organizationId` int DEFAULT 1,
	CONSTRAINT `quality_score_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sla_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`description` text,
	`entityType` enum('asset','domain','global') NOT NULL DEFAULT 'global',
	`entityId` int,
	`maxUpdateDays` int DEFAULT 30,
	`minQualityScore` float DEFAULT 70,
	`maxAccessResponseDays` int DEFAULT 5,
	`alertEmails` text,
	`alertOnBreachOnly` boolean DEFAULT true,
	`active` boolean NOT NULL DEFAULT true,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sla_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sla_violations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slaConfigId` int NOT NULL,
	`entityType` enum('asset','access_request') NOT NULL,
	`entityId` int NOT NULL,
	`entityName` varchar(256),
	`violationType` enum('stale_data','low_quality','slow_access_response') NOT NULL,
	`daysOverdue` int DEFAULT 0,
	`notificationSent` boolean DEFAULT false,
	`details` json,
	`resolvedAt` timestamp NULL DEFAULT NULL,
	`detectedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sla_violations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sso_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`provider` enum('saml','oidc') NOT NULL DEFAULT 'saml',
	`entryPoint` text,
	`issuer` varchar(512),
	`certificate` text,
	`callbackUrl` text,
	`clientId` varchar(512),
	`clientSecret` text,
	`discoveryUrl` text,
	`active` boolean NOT NULL DEFAULT false,
	`lastTestedAt` timestamp NULL DEFAULT NULL,
	`lastTestSuccess` boolean,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sso_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `sso_configs_organizationId_unique` UNIQUE(`organizationId`)
);
--> statement-breakpoint
CREATE TABLE `tag_policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tagKey` varchar(256) NOT NULL,
	`displayName` varchar(256) NOT NULL,
	`description` text,
	`allowedValues` text NOT NULL DEFAULT ('[]'),
	`colorMap` text DEFAULT ('{}'),
	`appliesTo` enum('table','column','both') NOT NULL DEFAULT 'both',
	`category` varchar(128) DEFAULT 'compliance',
	`isRequired` boolean DEFAULT false,
	`autoSync` boolean DEFAULT false,
	`sensitivityMapping` text DEFAULT ('{}'),
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tag_policies_id` PRIMARY KEY(`id`),
	CONSTRAINT `tag_policies_tagKey_unique` UNIQUE(`tagKey`)
);
--> statement-breakpoint
CREATE TABLE `webhook_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`url` text NOT NULL,
	`secret` varchar(256),
	`events` json NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`failureCount` int DEFAULT 0,
	`lastTriggeredAt` timestamp NULL DEFAULT NULL,
	`lastStatusCode` int,
	`createdById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webhook_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webhookConfigId` int NOT NULL,
	`event` varchar(128) NOT NULL,
	`payload` json NOT NULL,
	`statusCode` int,
	`responseBody` text,
	`success` boolean DEFAULT false,
	`attemptCount` int DEFAULT 1,
	`deliveredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_definitions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`description` text,
	`stepsJson` json NOT NULL,
	`triggerEntityType` varchar(64) NOT NULL DEFAULT 'asset',
	`autoTrigger` boolean NOT NULL DEFAULT false,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflow_definitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_instances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`definitionId` int NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int NOT NULL,
	`currentStep` int NOT NULL DEFAULT 0,
	`status` enum('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
	`initiatorOpenId` varchar(128) NOT NULL,
	`contextJson` json,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp NULL DEFAULT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflow_instances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_step_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`instanceId` int NOT NULL,
	`stepIndex` int NOT NULL,
	`actorOpenId` varchar(128) NOT NULL,
	`actorName` varchar(256),
	`decision` enum('approved','rejected','delegated','commented') NOT NULL,
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workflow_step_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `email_notifications` MODIFY COLUMN `sentAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `implementation_checklist` MODIFY COLUMN `completedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `invites` MODIFY COLUMN `sentAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `invites` MODIFY COLUMN `respondedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `meeting_attendance` MODIFY COLUMN `joinedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `meeting_attendance` MODIFY COLUMN `leftAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `meetings` MODIFY COLUMN `endAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `meetings` MODIFY COLUMN `invitesSentAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `meetings` MODIFY COLUMN `teamsAttendanceSyncedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `password_reset_tokens` MODIFY COLUMN `usedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `role_audit_log` MODIFY COLUMN `previousRole` varchar(32);--> statement-breakpoint
ALTER TABLE `role_audit_log` MODIFY COLUMN `newRole` varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE `servicenow_tickets` MODIFY COLUMN `syncedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','data_steward','data_owner','data_analyst') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `participants` ADD `userId` int;--> statement-breakpoint
ALTER TABLE `role_audit_log` ADD `reason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `mustChangePassword` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `organizationId` int DEFAULT 1;