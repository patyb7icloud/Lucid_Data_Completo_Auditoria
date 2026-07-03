-- Scoring (Impacto × Esforço) e Fase de Execução para intake_requests
-- Migração 0013

ALTER TABLE `intake_requests`
  -- Novos valores de status
  MODIFY COLUMN `status` ENUM(
    'rascunho','submetido','em_triagem',
    'aprovado_estrategico','aprovado_operacional',
    'retornado','rejeitado',
    'em_execucao','em_validacao','concluido'
  ) NOT NULL DEFAULT 'submetido',

  -- Scoring Eixo A × B
  ADD COLUMN `impactScore` INT NULL AFTER `returnReason`,
  ADD COLUMN `effortScore` INT NULL AFTER `impactScore`,
  ADD COLUMN `scoringNotes` TEXT NULL AFTER `effortScore`,

  -- Fase de Execução
  ADD COLUMN `executorId` INT NULL AFTER `scoringNotes`,
  ADD COLUMN `executorName` VARCHAR(256) NULL AFTER `executorId`,
  ADD COLUMN `executionStartedAt` TIMESTAMP NULL AFTER `executorName`,
  ADD COLUMN `executionNotes` TEXT NULL AFTER `executionStartedAt`,
  ADD COLUMN `deliveredAt` TIMESTAMP NULL AFTER `executionNotes`,
  ADD COLUMN `validatedAt` TIMESTAMP NULL AFTER `deliveredAt`,
  ADD COLUMN `validatedById` INT NULL AFTER `validatedAt`,
  ADD COLUMN `validatedByName` VARCHAR(256) NULL AFTER `validatedById`,
  ADD COLUMN `deliveryNotes` TEXT NULL AFTER `validatedByName`;
