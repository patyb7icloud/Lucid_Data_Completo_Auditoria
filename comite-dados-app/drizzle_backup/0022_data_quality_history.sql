CREATE TABLE IF NOT EXISTS `data_quality_history` (
  `id` int AUTO_INCREMENT NOT NULL,
  `assetId` int NOT NULL,
  `avgScore` float NOT NULL,
  `checksPassed` int DEFAULT 0,
  `checksTotal` int DEFAULT 0,
  `organizationId` int DEFAULT 1,
  `measuredAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `data_quality_history_id` PRIMARY KEY(`id`)
);