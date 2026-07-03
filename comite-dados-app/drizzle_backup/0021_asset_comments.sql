-- Migration: 0021_asset_comments
-- Tabela de comentários colaborativos por ativo do catálogo

CREATE TABLE IF NOT EXISTS `asset_comments` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `assetId`    INT          NOT NULL,
  `userId`     INT          NOT NULL,
  `userName`   VARCHAR(256) NOT NULL,
  `content`    TEXT         NOT NULL,
  `parentId`   INT          NULL,
  `resolved`   TINYINT      NOT NULL DEFAULT 0,
  `createdAt`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_asset_comments_asset` (`assetId`),
  INDEX `idx_asset_comments_parent` (`parentId`),
  CONSTRAINT `fk_asset_comments_asset`
    FOREIGN KEY (`assetId`) REFERENCES `data_assets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_asset_comments_user`
    FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
