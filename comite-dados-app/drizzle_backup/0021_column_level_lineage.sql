-- Migration 0021: Column-level lineage
-- Adiciona colunas sourceColumn e targetColumn à tabela data_lineage
-- para suportar rastreabilidade a nível de coluna (Gap 2 enterprise).

ALTER TABLE `data_lineage`
  ADD COLUMN IF NOT EXISTS `sourceColumn` varchar(256) NULL AFTER `type`,
  ADD COLUMN IF NOT EXISTS `targetColumn` varchar(256) NULL AFTER `sourceColumn`;
