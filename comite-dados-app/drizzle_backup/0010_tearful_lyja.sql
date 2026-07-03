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
ALTER TABLE `servicenow_tickets` MODIFY COLUMN `syncedAt` timestamp NULL DEFAULT NULL;