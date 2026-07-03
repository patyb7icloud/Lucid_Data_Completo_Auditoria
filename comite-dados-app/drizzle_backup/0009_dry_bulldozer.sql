CREATE TABLE `ticket_alert_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`domainId` int NOT NULL,
	`criticalDays` int DEFAULT 3,
	`highDays` int DEFAULT 7,
	`enabled` tinyint DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ticket_alert_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `ticket_alert_configs_domainId_unique` UNIQUE(`domainId`)
);
