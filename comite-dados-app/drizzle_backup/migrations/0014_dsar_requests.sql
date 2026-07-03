-- Migration: DSAR — Data Subject Access Requests
CREATE TABLE IF NOT EXISTS `dsar_requests` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `requestType` enum('acesso','retificacao','exclusao','portabilidade','oposicao','revogacao_consentimento') NOT NULL,
  `status` enum('aberto','em_andamento','concluido','rejeitado') NOT NULL DEFAULT 'aberto',
  `subjectName` varchar(256) NOT NULL,
  `subjectEmail` varchar(320) NOT NULL,
  `subjectDocument` varchar(64),
  `description` text,
  `internalNotes` text,
  `responseDetails` text,
  `assignedToId` int,
  `assignedToName` varchar(256),
  `deadline` timestamp,
  `closedAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_dsar_status` (`status`),
  INDEX `idx_dsar_email` (`subjectEmail`),
  INDEX `idx_dsar_deadline` (`deadline`)
);
