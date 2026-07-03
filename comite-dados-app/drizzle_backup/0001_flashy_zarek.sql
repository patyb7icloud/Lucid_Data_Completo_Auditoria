CREATE TABLE `agenda_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`meetingId` int NOT NULL,
	`order` int DEFAULT 1,
	`title` varchar(512) NOT NULL,
	`description` text,
	`duration` int,
	`responsibleId` int,
	`status` enum('pendente','em_andamento','concluido') DEFAULT 'pendente',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agenda_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_chat_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(128) NOT NULL,
	`userId` int,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`context` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_chat_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `domains` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`color` varchar(16) DEFAULT '#1B3A8C',
	`icon` varchar(64) DEFAULT 'Building2',
	`implementationProgress` float DEFAULT 0,
	`status` enum('planejado','em_andamento','concluido','pausado') DEFAULT 'planejado',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `domains_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `implementation_checklist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`domainId` int NOT NULL,
	`phase` varchar(128) NOT NULL,
	`title` varchar(512) NOT NULL,
	`description` text,
	`completed` boolean DEFAULT false,
	`completedAt` timestamp NULL DEFAULT NULL,
	`completedBy` varchar(256),
	`order` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `implementation_checklist_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`meetingId` int NOT NULL,
	`participantId` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`status` enum('pendente','confirmado','recusado','talvez') DEFAULT 'pendente',
	`sentAt` timestamp NULL DEFAULT NULL,
	`respondedAt` timestamp NULL DEFAULT NULL,
	`responseNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `invites_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(512) NOT NULL,
	`description` text,
	`scheduledAt` timestamp NOT NULL,
	`endAt` timestamp NULL DEFAULT NULL,
	`location` varchar(512),
	`meetingLink` text,
	`status` enum('agendada','realizada','cancelada','adiada') DEFAULT 'agendada',
	`type` enum('ordinaria','extraordinaria','piloto','workshop') DEFAULT 'ordinaria',
	`domainId` int,
	`minutesContent` text,
	`decisionsContent` text,
	`actionsContent` text,
	`invitesSentAt` timestamp NULL DEFAULT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meetings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `participants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`email` varchar(320) NOT NULL,
	`jobTitle` varchar(256),
	`department` varchar(128),
	`phone` varchar(32),
	`domainId` int,
	`role` enum('data_owner','data_steward','product_owner','project_manager','ai_owner','ai_steward','ai_ethics_officer','ml_engineer','model_manager','data_engineer','data_architect','facilitador','representante_negocio','outro') NOT NULL,
	`status` enum('ativo','inativo','a_designar') DEFAULT 'ativo',
	`avatarUrl` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `participants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `raci_matrix` (
	`id` int AUTO_INCREMENT NOT NULL,
	`activity` varchar(512) NOT NULL,
	`category` varchar(128),
	`domainId` int,
	`dataOwner` enum('R','A','C','I','-') DEFAULT '-',
	`dataSteward` enum('R','A','C','I','-') DEFAULT '-',
	`productOwner` enum('R','A','C','I','-') DEFAULT '-',
	`projectManager` enum('R','A','C','I','-') DEFAULT '-',
	`aiOwner` enum('R','A','C','I','-') DEFAULT '-',
	`aiSteward` enum('R','A','C','I','-') DEFAULT '-',
	`aiEthicsOfficer` enum('R','A','C','I','-') DEFAULT '-',
	`mlEngineer` enum('R','A','C','I','-') DEFAULT '-',
	`modelManager` enum('R','A','C','I','-') DEFAULT '-',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `raci_matrix_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `servicenow_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketNumber` varchar(64) NOT NULL,
	`title` varchar(512) NOT NULL,
	`description` text,
	`status` varchar(64),
	`priority` varchar(32),
	`assignedTo` varchar(256),
	`domainId` int,
	`participantId` int,
	`meetingId` int,
	`externalUrl` text,
	`syncedAt` timestamp NULL DEFAULT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `servicenow_tickets_id` PRIMARY KEY(`id`)
);
