-- Índice FULLTEXT para busca inteligente no catálogo de dados
-- Cobre nome e descrição dos ativos
ALTER TABLE `data_assets` ADD FULLTEXT INDEX `ft_assets_search` (`name`, `description`);
