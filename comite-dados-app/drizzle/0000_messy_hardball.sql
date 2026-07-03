CREATE TYPE "public"."access_base_legal" AS ENUM('legitimo_interesse', 'execucao_contrato');--> statement-breakpoint
CREATE TYPE "public"."access_flow_type" AS ENUM('acesso_dados', 'dados_restritos', 'terceiros', 'projeto_ia');--> statement-breakpoint
CREATE TYPE "public"."access_nivel" AS ENUM('leitura', 'leitura_escrita');--> statement-breakpoint
CREATE TYPE "public"."access_status" AS ENUM('pendente_owner', 'pendente_steward', 'aprovado', 'rejeitado_owner', 'rejeitado_steward');--> statement-breakpoint
CREATE TYPE "public"."access_status_owner" AS ENUM('pendente', 'aprovado', 'rejeitado');--> statement-breakpoint
CREATE TYPE "public"."access_status_steward" AS ENUM('pendente', 'aguardando', 'aprovado', 'rejeitado');--> statement-breakpoint
CREATE TYPE "public"."agenda_status" AS ENUM('pendente', 'em_andamento', 'concluido');--> statement-breakpoint
CREATE TYPE "public"."ai_chat_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('ativo', 'em_construcao', 'desativado');--> statement-breakpoint
CREATE TYPE "public"."asset_type" AS ENUM('tabela', 'api', 'arquivo', 'dashboard', 'outro');--> statement-breakpoint
CREATE TYPE "public"."attendance_source" AS ENUM('teams', 'manual');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'view', 'export', 'approve', 'reject', 'login', 'logout', 'access_request', 'role_change');--> statement-breakpoint
CREATE TYPE "public"."contains_pii" AS ENUM('sim', 'nao', 'nao_sei');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('rascunho', 'em_revisao', 'ativo', 'expirado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."criticality" AS ENUM('baixa', 'media', 'alta', 'critica');--> statement-breakpoint
CREATE TYPE "public"."data_sensitivity" AS ENUM('publico', 'interno', 'confidencial', 'restrito');--> statement-breakpoint
CREATE TYPE "public"."domain_status" AS ENUM('planejado', 'em_andamento', 'concluido', 'pausado');--> statement-breakpoint
CREATE TYPE "public"."dsar_status" AS ENUM('aberto', 'em_andamento', 'concluido', 'rejeitado');--> statement-breakpoint
CREATE TYPE "public"."dsar_type" AS ENUM('acesso', 'retificacao', 'exclusao', 'portabilidade', 'oposicao', 'revogacao_consentimento');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('pendente', 'enviado', 'falhou', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."email_type" AS ENUM('meeting_invite', 'meeting_reminder', 'meeting_cancelled', 'decision_registered', 'meeting_summary', 'invite_confirmed', 'invite_declined', 'domain_update', 'custom');--> statement-breakpoint
CREATE TYPE "public"."export_doc_type" AS ENUM('meeting_minutes_pdf', 'meeting_minutes_docx', 'organogram_pdf', 'metrics_report_pdf');--> statement-breakpoint
CREATE TYPE "public"."export_file_format" AS ENUM('pdf', 'docx');--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('novo', 'em_analise', 'concluido');--> statement-breakpoint
CREATE TYPE "public"."feedback_type" AS ENUM('sugestao', 'bug', 'elogio', 'outro');--> statement-breakpoint
CREATE TYPE "public"."glossary_status" AS ENUM('rascunho', 'em_revisao', 'aprovado', 'obsoleto');--> statement-breakpoint
CREATE TYPE "public"."intake_priority" AS ENUM('baixa', 'media', 'alta', 'critica');--> statement-breakpoint
CREATE TYPE "public"."intake_status" AS ENUM('rascunho', 'submetido', 'em_triagem', 'aprovado_estrategico', 'aprovado_operacional', 'retornado', 'rejeitado', 'em_execucao', 'em_validacao', 'concluido');--> statement-breakpoint
CREATE TYPE "public"."intake_type" AS ENUM('dado', 'projeto_ia', 'compliance', 'qualidade', 'acesso', 'outro');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pendente', 'confirmado', 'recusado', 'talvez');--> statement-breakpoint
CREATE TYPE "public"."lineage_type" AS ENUM('direto', 'transformado', 'agregado');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('agendada', 'realizada', 'cancelada', 'adiada');--> statement-breakpoint
CREATE TYPE "public"."meeting_type" AS ENUM('ordinaria', 'extraordinaria', 'piloto', 'workshop');--> statement-breakpoint
CREATE TYPE "public"."org_plan" AS ENUM('starter', 'professional', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."participant_role" AS ENUM('data_owner', 'data_steward', 'product_owner', 'project_manager', 'ai_owner', 'ai_steward', 'ai_ethics_officer', 'ml_engineer', 'model_manager', 'data_engineer', 'data_architect', 'facilitador', 'representante_negocio', 'outro');--> statement-breakpoint
CREATE TYPE "public"."participant_status" AS ENUM('ativo', 'inativo', 'a_designar');--> statement-breakpoint
CREATE TYPE "public"."pia_risk" AS ENUM('baixo', 'medio', 'alto', 'critico');--> statement-breakpoint
CREATE TYPE "public"."pia_status" AS ENUM('rascunho', 'em_revisao', 'aprovado', 'rejeitado');--> statement-breakpoint
CREATE TYPE "public"."pii_policy_status" AS ENUM('pendente_revisao', 'aprovado', 'rejeitado', 'sincronizado');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('baixa', 'media', 'alta', 'critica');--> statement-breakpoint
CREATE TYPE "public"."priority_tier" AS ENUM('P1', 'P2', 'P3', 'P4');--> statement-breakpoint
CREATE TYPE "public"."quality_rule_type" AS ENUM('completude', 'unicidade', 'validade', 'consistencia', 'regex');--> statement-breakpoint
CREATE TYPE "public"."quality_status" AS ENUM('sucesso', 'alerta', 'falha');--> statement-breakpoint
CREATE TYPE "public"."raci_value" AS ENUM('R', 'A', 'C', 'I', '-');--> statement-breakpoint
CREATE TYPE "public"."sensitivity" AS ENUM('publico', 'interno', 'confidencial', 'restrito');--> statement-breakpoint
CREATE TYPE "public"."sla_entity_type" AS ENUM('asset', 'domain', 'global');--> statement-breakpoint
CREATE TYPE "public"."sla_viol_entity" AS ENUM('asset', 'access_request');--> statement-breakpoint
CREATE TYPE "public"."sla_viol_type" AS ENUM('stale_data', 'low_quality', 'slow_access_response');--> statement-breakpoint
CREATE TYPE "public"."sso_provider" AS ENUM('saml', 'oidc');--> statement-breakpoint
CREATE TYPE "public"."tag_applies_to" AS ENUM('table', 'column', 'both');--> statement-breakpoint
CREATE TYPE "public"."tier_status" AS ENUM('pendente_revisao', 'aprovado', 'sincronizado', 'revogado');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin', 'data_steward', 'data_owner', 'data_analyst');--> statement-breakpoint
CREATE TYPE "public"."workflow_decision" AS ENUM('approved', 'rejected', 'delegated', 'commented');--> statement-breakpoint
CREATE TYPE "public"."workflow_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "access_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticketNumber" varchar(64) NOT NULL,
	"assetId" integer NOT NULL,
	"requesterId" integer,
	"requesterName" varchar(256),
	"requesterEmail" varchar(320),
	"nivelAcesso" "access_nivel" NOT NULL,
	"papelGrupo" varchar(256) NOT NULL,
	"baseLegal" "access_base_legal" NOT NULL,
	"finalidade" text NOT NULL,
	"prazoNecessidade" varchar(128),
	"checklistJson" text,
	"envolveTerceiros" boolean DEFAULT false,
	"statusOwner" "access_status_owner" DEFAULT 'pendente',
	"ownerApprovedAt" timestamp,
	"ownerComment" text,
	"ownerId" integer,
	"statusSteward" "access_status_steward" DEFAULT 'aguardando',
	"stewardApprovedAt" timestamp,
	"stewardComment" text,
	"stewardId" integer,
	"status" "access_status" DEFAULT 'pendente_owner',
	"flowType" "access_flow_type" DEFAULT 'acesso_dados',
	"priority" "priority" DEFAULT 'media',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agenda_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"meetingId" integer NOT NULL,
	"order" integer DEFAULT 1,
	"title" varchar(512) NOT NULL,
	"description" text,
	"duration" integer,
	"responsibleId" integer,
	"status" "agenda_status" DEFAULT 'pendente',
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chat_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"sessionId" varchar(128) NOT NULL,
	"userId" integer,
	"role" "ai_chat_role" NOT NULL,
	"content" text NOT NULL,
	"context" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"keyHash" varchar(256) NOT NULL,
	"keyPrefix" varchar(8) NOT NULL,
	"scopes" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"lastUsedAt" timestamp,
	"expiresAt" timestamp,
	"createdById" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_keyHash_unique" UNIQUE("keyHash")
);
--> statement-breakpoint
CREATE TABLE "asset_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"assetId" integer NOT NULL,
	"userId" integer NOT NULL,
	"userName" varchar(256) NOT NULL,
	"content" text NOT NULL,
	"parentId" integer,
	"resolved" smallint DEFAULT 0,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"userEmail" varchar(320),
	"userName" varchar(256),
	"action" "audit_action" NOT NULL,
	"entity" varchar(64) NOT NULL,
	"entityId" integer,
	"entityName" varchar(256),
	"details" jsonb,
	"ipAddress" varchar(45),
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_glossary" (
	"id" serial PRIMARY KEY NOT NULL,
	"term" varchar(256) NOT NULL,
	"definition" text NOT NULL,
	"abbreviation" varchar(64),
	"domainId" integer,
	"ownerId" integer,
	"status" "glossary_status" DEFAULT 'rascunho',
	"category" varchar(128),
	"synonyms" text,
	"examples" text,
	"notes" text,
	"relatedTermIds" text,
	"approvedBy" varchar(256),
	"approvedAt" timestamp,
	"createdById" integer,
	"createdByName" varchar(256),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connector_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"connectorType" varchar(64) NOT NULL,
	"name" varchar(256) NOT NULL,
	"configJson" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"lastTestedAt" timestamp,
	"lastTestSuccess" boolean,
	"lastTestMessage" text,
	"createdById" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"type" "asset_type" NOT NULL,
	"description" text,
	"region" varchar(64) DEFAULT 'Brasil',
	"domainId" integer,
	"ownerId" integer,
	"stewardId" integer,
	"sourceSystem" varchar(128),
	"sensitivity" "sensitivity" DEFAULT 'interno',
	"status" "asset_status" DEFAULT 'ativo',
	"qualityScore" real DEFAULT 0,
	"rowCount" integer DEFAULT 0,
	"lastSyncAt" timestamp,
	"businessArea" varchar(128),
	"criticality" "criticality" DEFAULT 'media',
	"businessValueScore" real DEFAULT 0,
	"organizationId" integer DEFAULT 1,
	"fullyQualifiedName" varchar(512),
	"piiPolicyStatus" "pii_policy_status",
	"piiPolicyReviewedBy" varchar(256),
	"piiPolicyReviewedAt" timestamp,
	"piiPolicySyncedAt" timestamp,
	"piiPolicyNotes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_attributes" (
	"id" serial PRIMARY KEY NOT NULL,
	"assetId" integer NOT NULL,
	"name" varchar(128) NOT NULL,
	"dataType" varchar(64),
	"description" text,
	"businessRules" text,
	"isPii" boolean DEFAULT false,
	"isKey" boolean DEFAULT false,
	"sampleValue" text,
	"isVerified" boolean DEFAULT false,
	"verifiedBy" varchar(256),
	"verifiedAt" timestamp,
	"aiSuggestion" text,
	"syncApproved" boolean DEFAULT false,
	"syncApprovedBy" varchar(256),
	"syncApprovedAt" timestamp,
	"lastSyncedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"assetId" integer NOT NULL,
	"producerTeam" varchar(256) NOT NULL,
	"consumerTeam" varchar(256) NOT NULL,
	"description" text,
	"slaLevel" text,
	"schemaJson" jsonb,
	"deliveryFrequency" varchar(128),
	"version" varchar(32) DEFAULT '1.0.0',
	"status" "contract_status" DEFAULT 'rascunho' NOT NULL,
	"signedAt" timestamp,
	"expiresAt" timestamp,
	"createdById" integer,
	"createdByName" varchar(256),
	"approvedById" integer,
	"approvedByName" varchar(256),
	"changeNotes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_lineage" (
	"id" serial PRIMARY KEY NOT NULL,
	"sourceAssetId" integer NOT NULL,
	"targetAssetId" integer NOT NULL,
	"transformationRule" text,
	"type" "lineage_type" DEFAULT 'direto',
	"sourceColumn" varchar(256),
	"targetColumn" varchar(256),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_quality_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"assetId" integer NOT NULL,
	"metricName" varchar(128) NOT NULL,
	"score" real NOT NULL,
	"threshold" real DEFAULT 95,
	"lastRunAt" timestamp DEFAULT now(),
	"status" "quality_status" NOT NULL,
	"details" text
);
--> statement-breakpoint
CREATE TABLE "data_quality_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"assetId" integer NOT NULL,
	"avgScore" real NOT NULL,
	"checksPassed" integer DEFAULT 0,
	"checksTotal" integer DEFAULT 0,
	"organizationId" integer DEFAULT 1,
	"measuredAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"responsible" varchar(256),
	"color" varchar(16) DEFAULT '#1B3A8C',
	"icon" varchar(64) DEFAULT 'Building2',
	"implementationProgress" real DEFAULT 0,
	"status" "domain_status" DEFAULT 'planejado',
	"tierLevel" integer,
	"tierStatus" "tier_status",
	"tierApprovedBy" varchar(320),
	"tierApprovedAt" timestamp,
	"tierSyncedAt" timestamp,
	"tierNotes" text,
	"tierDatabricksCatalog" varchar(256),
	"tierDatabricksSchema" varchar(256),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dsar_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"requestType" "dsar_type" NOT NULL,
	"status" "dsar_status" DEFAULT 'aberto' NOT NULL,
	"subjectName" varchar(256) NOT NULL,
	"subjectEmail" varchar(320) NOT NULL,
	"subjectDocument" varchar(64),
	"description" text,
	"internalNotes" text,
	"responseDetails" text,
	"assignedToId" integer,
	"assignedToName" varchar(256),
	"deadline" timestamp,
	"closedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "email_type" NOT NULL,
	"recipientId" integer,
	"recipientEmail" varchar(320) NOT NULL,
	"recipientName" varchar(256),
	"subject" varchar(512) NOT NULL,
	"htmlBody" text NOT NULL,
	"status" "email_status" DEFAULT 'pendente',
	"sentAt" timestamp,
	"errorMessage" text,
	"retryCount" integer DEFAULT 0,
	"meetingId" integer,
	"inviteId" integer,
	"metadata" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"documentType" "export_doc_type" NOT NULL,
	"documentTitle" varchar(512) NOT NULL,
	"fileUrl" text NOT NULL,
	"filename" varchar(256) NOT NULL,
	"fileFormat" "export_file_format" NOT NULL,
	"generatedBy" varchar(256),
	"generatedById" integer,
	"referenceId" integer,
	"referenceName" varchar(256),
	"fileSizeBytes" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedbacks" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" "feedback_type" NOT NULL,
	"message" text NOT NULL,
	"status" "feedback_status" DEFAULT 'novo' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "implementation_checklist" (
	"id" serial PRIMARY KEY NOT NULL,
	"domainId" integer NOT NULL,
	"phase" varchar(128) NOT NULL,
	"title" varchar(512) NOT NULL,
	"description" text,
	"completed" boolean DEFAULT false,
	"completedAt" timestamp,
	"completedBy" varchar(256),
	"order" integer DEFAULT 1,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intake_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"intakeCode" varchar(32),
	"title" varchar(256) NOT NULL,
	"description" text NOT NULL,
	"type" "intake_type" NOT NULL,
	"priority" "intake_priority" DEFAULT 'media' NOT NULL,
	"desiredDeadline" varchar(64),
	"submittedById" integer,
	"submitterName" varchar(256),
	"submitterEmail" varchar(320),
	"submitterDept" varchar(128),
	"problemStatement" text,
	"objective" text,
	"targetAudience" text,
	"usageFrequency" varchar(128),
	"financialImpact" text,
	"businessImpact" text,
	"technicalImpact" text,
	"sourceSystems" text,
	"mainEntities" text,
	"estimatedVolume" varchar(128),
	"updateFrequency" varchar(128),
	"historyNeeded" varchar(128),
	"containsPii" "contains_pii",
	"piiColumns" text,
	"expectedFields" text,
	"qualityCriteria" jsonb,
	"minDqScore" real,
	"dqFailAction" varchar(64),
	"successCriteria" jsonb,
	"postDeliveryMeasurement" text,
	"dataOwnerName" varchar(256),
	"dataStewardName" varchar(256),
	"privacyChampion" varchar(256),
	"dataSensitivity" "data_sensitivity",
	"accessGroups" text,
	"applicableRegulations" varchar(256),
	"retentionPeriod" varchar(128),
	"technicalDependencies" text,
	"identifiedRisks" text,
	"relatedDemands" varchar(256),
	"testEnvironmentAvailable" varchar(128),
	"networkInfraNeeded" varchar(128),
	"managerApproval" varchar(256),
	"domainId" integer,
	"assetId" integer,
	"status" "intake_status" DEFAULT 'submetido' NOT NULL,
	"reviewedById" integer,
	"reviewedByName" varchar(256),
	"reviewedAt" timestamp,
	"reviewNotes" text,
	"returnReason" text,
	"impactScore" integer,
	"effortScore" integer,
	"scoringNotes" text,
	"scoreFinancialImpact" smallint,
	"scoreBusinessUrgency" smallint,
	"scoreReach" smallint,
	"scoreStrategicAlignment" smallint,
	"scoreIntakeCompleteness" smallint,
	"scoreTechnicalFeasibility" smallint,
	"scoreReuse" smallint,
	"scoreDataOwnerDefined" smallint,
	"totalScore" integer,
	"priorityTier" "priority_tier",
	"triageChecklist" jsonb,
	"executorId" integer,
	"executorName" varchar(256),
	"executionStartedAt" timestamp,
	"executionNotes" text,
	"deliveredAt" timestamp,
	"validatedAt" timestamp,
	"validatedById" integer,
	"validatedByName" varchar(256),
	"deliveryNotes" text,
	"relatedMeetingId" integer,
	"agendaItemId" integer,
	"externalTicketId" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"meetingId" integer NOT NULL,
	"participantId" integer NOT NULL,
	"token" varchar(128) NOT NULL,
	"status" "invite_status" DEFAULT 'pendente',
	"sentAt" timestamp DEFAULT null,
	"respondedAt" timestamp DEFAULT null,
	"responseNote" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "meeting_attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"meetingId" integer NOT NULL,
	"participantId" integer,
	"participantName" varchar(256),
	"participantEmail" varchar(320),
	"joinedAt" timestamp,
	"leftAt" timestamp,
	"durationMinutes" integer,
	"attended" boolean DEFAULT false NOT NULL,
	"source" "attendance_source" DEFAULT 'teams' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(512) NOT NULL,
	"description" text,
	"scheduledAt" timestamp NOT NULL,
	"endAt" timestamp,
	"location" varchar(512),
	"meetingLink" text,
	"status" "meeting_status" DEFAULT 'agendada',
	"type" "meeting_type" DEFAULT 'ordinaria',
	"domainId" integer,
	"minutesContent" text,
	"decisionsContent" text,
	"actionsContent" text,
	"invitesSentAt" timestamp,
	"teamsMeetingId" varchar(512),
	"teamsJoinUrl" text,
	"teamsAttendanceSyncedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"participantId" integer NOT NULL,
	"meetingInvite" boolean DEFAULT true,
	"meetingReminder" boolean DEFAULT true,
	"meetingCancelled" boolean DEFAULT true,
	"decisionRegistered" boolean DEFAULT true,
	"meetingSummary" boolean DEFAULT true,
	"domainUpdate" boolean DEFAULT false,
	"reminderHoursBefore" integer DEFAULT 24,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_participantId_unique" UNIQUE("participantId")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"appName" varchar(128) DEFAULT 'Portal de Governança de Dados',
	"logoUrl" text,
	"faviconUrl" text,
	"primaryColor" varchar(16) DEFAULT '#1B3A8C',
	"secondaryColor" varchar(16) DEFAULT '#6DC23A',
	"customCss" text,
	"supportEmail" varchar(256),
	"supportUrl" text,
	"termsUrl" text,
	"privacyUrl" text,
	"plan" "org_plan" DEFAULT 'professional',
	"maxUsers" integer DEFAULT 50,
	"maxAssets" integer DEFAULT 500,
	"allowSso" boolean DEFAULT false,
	"ssoMetadataUrl" text,
	"defaultLocale" varchar(8) DEFAULT 'pt-BR',
	"timezone" varchar(64) DEFAULT 'America/Sao_Paulo',
	"active" boolean DEFAULT true,
	"trialEndsAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"email" varchar(320) NOT NULL,
	"jobTitle" varchar(256),
	"department" varchar(128),
	"phone" varchar(32),
	"domainId" integer,
	"role" "participant_role" NOT NULL,
	"status" "participant_status" DEFAULT 'ativo',
	"avatarUrl" text,
	"notes" text,
	"userId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"token" varchar(128) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"usedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "pia_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(256) NOT NULL,
	"assetId" integer,
	"assetName" varchar(256),
	"status" "pia_status" DEFAULT 'rascunho' NOT NULL,
	"riskLevel" "pia_risk",
	"dataCategories" jsonb,
	"purposes" text,
	"legalBasis" varchar(128),
	"retentionPeriod" varchar(128),
	"crossBorderTransfer" boolean DEFAULT false,
	"thirdPartySharing" boolean DEFAULT false,
	"automatedDecision" boolean DEFAULT false,
	"mitigationMeasures" text,
	"residualRisk" text,
	"dpoRecommendation" text,
	"createdById" integer,
	"createdByName" varchar(256),
	"reviewedById" integer,
	"reviewedByName" varchar(256),
	"approvedAt" timestamp,
	"reviewNotes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quality_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"assetId" integer NOT NULL,
	"ruleType" "quality_rule_type" NOT NULL,
	"columnName" varchar(128),
	"threshold" real DEFAULT 95,
	"params" text,
	"customPattern" text,
	"isActive" boolean DEFAULT true,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quality_score_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"assetId" integer NOT NULL,
	"score" integer NOT NULL,
	"recordedAt" timestamp DEFAULT now() NOT NULL,
	"organizationId" integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "raci_matrix" (
	"id" serial PRIMARY KEY NOT NULL,
	"activity" varchar(512) NOT NULL,
	"category" varchar(128),
	"domainId" integer,
	"dataOwner" "raci_value" DEFAULT '-',
	"dataSteward" "raci_value" DEFAULT '-',
	"productOwner" "raci_value" DEFAULT '-',
	"projectManager" "raci_value" DEFAULT '-',
	"aiOwner" "raci_value" DEFAULT '-',
	"aiSteward" "raci_value" DEFAULT '-',
	"aiEthicsOfficer" "raci_value" DEFAULT '-',
	"mlEngineer" "raci_value" DEFAULT '-',
	"modelManager" "raci_value" DEFAULT '-',
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"executorOpenId" varchar(64) NOT NULL,
	"executorName" varchar(256),
	"targetOpenId" varchar(64) NOT NULL,
	"targetName" varchar(256),
	"targetEmail" varchar(320),
	"previousRole" varchar(32),
	"newRole" varchar(32) NOT NULL,
	"reason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "servicenow_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticketNumber" varchar(64) NOT NULL,
	"title" varchar(512) NOT NULL,
	"description" text,
	"status" varchar(64),
	"priority" varchar(32),
	"assignedTo" varchar(256),
	"domainId" integer,
	"participantId" integer,
	"meetingId" integer,
	"externalUrl" text,
	"syncedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sla_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"entityType" "sla_entity_type" DEFAULT 'global' NOT NULL,
	"entityId" integer,
	"maxUpdateDays" integer DEFAULT 30,
	"minQualityScore" real DEFAULT 70,
	"maxAccessResponseDays" integer DEFAULT 5,
	"alertEmails" text,
	"alertOnBreachOnly" boolean DEFAULT true,
	"active" boolean DEFAULT true NOT NULL,
	"createdById" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sla_violations" (
	"id" serial PRIMARY KEY NOT NULL,
	"slaConfigId" integer NOT NULL,
	"entityType" "sla_viol_entity" NOT NULL,
	"entityId" integer NOT NULL,
	"entityName" varchar(256),
	"violationType" "sla_viol_type" NOT NULL,
	"daysOverdue" integer DEFAULT 0,
	"notificationSent" boolean DEFAULT false,
	"details" jsonb,
	"resolvedAt" timestamp,
	"detectedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sso_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"provider" "sso_provider" DEFAULT 'saml' NOT NULL,
	"entryPoint" text,
	"issuer" varchar(512),
	"certificate" text,
	"callbackUrl" text,
	"clientId" varchar(512),
	"clientSecret" text,
	"discoveryUrl" text,
	"active" boolean DEFAULT false NOT NULL,
	"lastTestedAt" timestamp,
	"lastTestSuccess" boolean,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sso_configs_organizationId_unique" UNIQUE("organizationId")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text,
	"description" text,
	"updatedAt" timestamp DEFAULT now(),
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "tag_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"tagKey" varchar(256) NOT NULL,
	"displayName" varchar(256) NOT NULL,
	"description" text,
	"allowedValues" text DEFAULT '[]' NOT NULL,
	"colorMap" text DEFAULT '{}',
	"appliesTo" "tag_applies_to" DEFAULT 'both' NOT NULL,
	"category" varchar(128) DEFAULT 'compliance',
	"isRequired" boolean DEFAULT false,
	"autoSync" boolean DEFAULT false,
	"sensitivityMapping" text DEFAULT '{}',
	"createdById" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tag_policies_tagKey_unique" UNIQUE("tagKey")
);
--> statement-breakpoint
CREATE TABLE "ticket_alert_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"domainId" integer NOT NULL,
	"criticalDays" integer DEFAULT 3,
	"highDays" integer DEFAULT 7,
	"enabled" smallint DEFAULT 1,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_alert_configs_domainId_unique" UNIQUE("domainId")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"passwordHash" varchar(256),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	"mustChangePassword" boolean DEFAULT false NOT NULL,
	"organizationId" integer DEFAULT 1,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "webhook_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"url" text NOT NULL,
	"secret" varchar(256),
	"events" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"failureCount" integer DEFAULT 0,
	"lastTriggeredAt" timestamp,
	"lastStatusCode" integer,
	"createdById" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"webhookConfigId" integer NOT NULL,
	"event" varchar(128) NOT NULL,
	"payload" jsonb NOT NULL,
	"statusCode" integer,
	"responseBody" text,
	"success" boolean DEFAULT false,
	"attemptCount" integer DEFAULT 1,
	"deliveredAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"orgId" integer NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"stepsJson" jsonb NOT NULL,
	"triggerEntityType" varchar(64) DEFAULT 'asset' NOT NULL,
	"autoTrigger" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"definitionId" integer NOT NULL,
	"entityType" varchar(64) NOT NULL,
	"entityId" integer NOT NULL,
	"currentStep" integer DEFAULT 0 NOT NULL,
	"status" "workflow_status" DEFAULT 'pending' NOT NULL,
	"initiatorOpenId" varchar(128) NOT NULL,
	"contextJson" jsonb,
	"startedAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_step_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"instanceId" integer NOT NULL,
	"stepIndex" integer NOT NULL,
	"actorOpenId" varchar(128) NOT NULL,
	"actorName" varchar(256),
	"decision" "workflow_decision" NOT NULL,
	"comment" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
