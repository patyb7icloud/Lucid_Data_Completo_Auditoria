CREATE TABLE `business_glossary` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `term` varchar(256) NOT NULL,
  `definition` text NOT NULL,
  `abbreviation` varchar(64),
  `domainId` int,
  `ownerId` int,
  `status` enum('rascunho','em_revisao','aprovado','obsoleto') DEFAULT 'rascunho',
  `category` varchar(128),
  `synonyms` text,
  `examples` text,
  `notes` text,
  `relatedTermIds` text,
  `approvedBy` varchar(256),
  `approvedAt` timestamp NULL DEFAULT NULL,
  `createdById` int,
  `createdByName` varchar(256),
  `createdAt` timestamp NOT NULL DEFAULT NOW(),
  `updatedAt` timestamp NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  FULLTEXT INDEX `ft_term_definition` (`term`, `definition`)
);

-- Dados iniciais de exemplo
INSERT INTO `business_glossary` (`term`, `definition`, `abbreviation`, `status`, `category`, `createdByName`)
VALUES
  ('Data Owner', 'Responsável pelo dado dentro do domínio de negócio. Define políticas de acesso, qualidade e uso. Responde pela conformidade regulatória do dado.', 'DO', 'aprovado', 'Papéis e Responsabilidades', 'Sistema'),
  ('Data Steward', 'Curador técnico do dado. Responsável pela documentação, qualidade operacional, catalogação e suporte aos consumidores do dado.', 'DS', 'aprovado', 'Papéis e Responsabilidades', 'Sistema'),
  ('Dado Pessoal', 'Toda informação relacionada a pessoa natural identificada ou identificável. Conforme LGPD Art. 5°, I.', 'PII', 'aprovado', 'LGPD / Privacidade', 'Sistema'),
  ('Base Legal', 'Fundamento jurídico que autoriza o tratamento de dados pessoais. Ex: consentimento, legítimo interesse, execução de contrato (LGPD Art. 7°).', NULL, 'aprovado', 'LGPD / Privacidade', 'Sistema'),
  ('Catálogo de Dados', 'Inventário centralizado e pesquisável de todos os ativos de dados da organização, incluindo metadados técnicos e de negócio.', NULL, 'aprovado', 'Governança de Dados', 'Sistema'),
  ('Linhagem de Dados', 'Rastreabilidade completa do ciclo de vida de um dado: origem, transformações aplicadas, sistemas que o consomem e destinos finais.', NULL, 'aprovado', 'Governança de Dados', 'Sistema'),
  ('Dado Mestre', 'Dados fundamentais do negócio compartilhados entre múltiplos sistemas. Ex: clientes, produtos, fornecedores, centros de custo.', 'MDM', 'aprovado', 'Tipos de Dados', 'Sistema'),
  ('SLA de Dados', 'Acordo de Nível de Serviço aplicado a dados. Define prazo de disponibilidade, frequência de atualização e qualidade mínima esperada.', 'SLA', 'aprovado', 'Qualidade de Dados', 'Sistema');
