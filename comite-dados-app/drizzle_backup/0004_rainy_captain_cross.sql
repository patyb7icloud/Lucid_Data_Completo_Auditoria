CREATE TABLE `export_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentType` enum('meeting_minutes_pdf','meeting_minutes_docx','organogram_pdf','metrics_report_pdf') NOT NULL,
	`documentTitle` varchar(512) NOT NULL,
	`fileUrl` text NOT NULL,
	`filename` varchar(256) NOT NULL,
	`fileFormat` enum('pdf','docx') NOT NULL,
	`generatedBy` varchar(256),
	`generatedByOpenId` varchar(64),
	`referenceId` int,
	`referenceName` varchar(256),
	`fileSizeBytes` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `export_history_id` PRIMARY KEY(`id`)
);
