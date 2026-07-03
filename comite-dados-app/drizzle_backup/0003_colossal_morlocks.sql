CREATE TABLE `email_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('meeting_invite','meeting_reminder','meeting_cancelled','decision_registered','meeting_summary','invite_confirmed','invite_declined','domain_update','custom') NOT NULL,
	`recipientId` int,
	`recipientEmail` varchar(320) NOT NULL,
	`recipientName` varchar(256),
	`subject` varchar(512) NOT NULL,
	`htmlBody` text NOT NULL,
	`status` enum('pendente','enviado','falhou','cancelado') DEFAULT 'pendente',
	`sentAt` timestamp NULL DEFAULT NULL,
	`errorMessage` text,
	`retryCount` int DEFAULT 0,
	`meetingId` int,
	`inviteId` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`participantId` int NOT NULL,
	`meetingInvite` boolean DEFAULT true,
	`meetingReminder` boolean DEFAULT true,
	`meetingCancelled` boolean DEFAULT true,
	`decisionRegistered` boolean DEFAULT true,
	`meetingSummary` boolean DEFAULT true,
	`domainUpdate` boolean DEFAULT false,
	`reminderHoursBefore` int DEFAULT 24,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_preferences_participantId_unique` UNIQUE(`participantId`)
);
