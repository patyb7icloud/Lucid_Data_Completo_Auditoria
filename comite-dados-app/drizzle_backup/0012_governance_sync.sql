-- Colunas de aprovação de sync no Unity Catalog (steward aprova, admin envia)
ALTER TABLE `data_attributes`
  ADD COLUMN `syncApproved` boolean NOT NULL DEFAULT false,
  ADD COLUMN `syncApprovedBy` varchar(256),
  ADD COLUMN `syncApprovedAt` timestamp NULL,
  ADD COLUMN `lastSyncedAt` timestamp NULL;
