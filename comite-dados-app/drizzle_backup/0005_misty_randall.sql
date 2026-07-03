CREATE TABLE `role_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`executorOpenId` varchar(64) NOT NULL,
	`executorName` varchar(256),
	`targetOpenId` varchar(64) NOT NULL,
	`targetName` varchar(256),
	`targetEmail` varchar(320),
	`previousRole` enum('user','admin') NOT NULL,
	`newRole` enum('user','admin') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `role_audit_log_id` PRIMARY KEY(`id`)
);
