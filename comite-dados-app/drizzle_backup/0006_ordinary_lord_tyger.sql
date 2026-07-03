CREATE TABLE `meeting_attendance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`meetingId` int NOT NULL,
	`participantId` int,
	`participantName` varchar(256),
	`participantEmail` varchar(320),
	`joinedAt` timestamp NULL DEFAULT NULL,
	`leftAt` timestamp NULL DEFAULT NULL,
	`durationMinutes` int,
	`attended` boolean NOT NULL DEFAULT false,
	`source` enum('teams','manual') NOT NULL DEFAULT 'teams',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meeting_attendance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `meetings` ADD `teamsMeetingId` varchar(512);--> statement-breakpoint
ALTER TABLE `meetings` ADD `teamsJoinUrl` text;--> statement-breakpoint
ALTER TABLE `meetings` ADD `teamsAttendanceSyncedAt` timestamp NULL DEFAULT NULL;