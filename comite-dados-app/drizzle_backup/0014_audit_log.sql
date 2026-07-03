CREATE TABLE `audit_log` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
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
  `createdAt` timestamp NOT NULL DEFAULT NOW(),
  INDEX `idx_audit_userId` (`userId`),
  INDEX `idx_audit_entity` (`entity`, `entityId`),
  INDEX `idx_audit_action` (`action`),
  INDEX `idx_audit_createdAt` (`createdAt`)
);
