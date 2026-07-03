ALTER TABLE `invites` MODIFY COLUMN `sentAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `invites` MODIFY COLUMN `respondedAt` timestamp NULL DEFAULT NULL;