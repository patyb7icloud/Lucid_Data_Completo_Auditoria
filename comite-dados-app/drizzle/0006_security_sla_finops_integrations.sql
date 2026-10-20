-- 0006_security_sla_finops_integrations.sql
-- Tenant scoping, auditable AI gates, SLA evaluation, LLM usage ledger,
-- evidence-based fairness review, and integration/deployment request state.
-- Idempotent where practical so existing installations created with drizzle-kit push can upgrade.

DO $$ BEGIN
  CREATE TYPE "ai_gate" AS ENUM ('G0', 'G1', 'G2', 'G3');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "ai_project_status" AS ENUM ('active', 'paused', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ai_projects" (
  "id" serial PRIMARY KEY NOT NULL,
  "organization_id" integer DEFAULT 1 NOT NULL,
  "name" varchar(256) NOT NULL,
  "description" text,
  "department" varchar(128),
  "gate" "ai_gate" DEFAULT 'G0' NOT NULL,
  "status" "ai_project_status" DEFAULT 'active' NOT NULL,
  "owner_id" integer,
  "created_by_id" integer,
  "risk_level" "risk_level" DEFAULT 'medio' NOT NULL,
  "compliance_score" integer DEFAULT 0,
  "project_type" varchar(64) DEFAULT 'IA' NOT NULL,
  "servicenow_ticket" varchar(128),
  "azure_devops_url" varchar(512),
  "terms_accepted" boolean DEFAULT false NOT NULL,
  "terms_accepted_by_id" integer,
  "terms_accepted_at" timestamp,
  "go_no_go_status" varchar(32) DEFAULT 'pending' NOT NULL,
  "decision_by_id" integer,
  "decision_at" timestamp,
  "decision_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_projects" ADD COLUMN IF NOT EXISTS "organization_id" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_projects" ADD COLUMN IF NOT EXISTS "created_by_id" integer;
--> statement-breakpoint
ALTER TABLE "ai_projects" ADD COLUMN IF NOT EXISTS "terms_accepted_by_id" integer;
--> statement-breakpoint
ALTER TABLE "ai_projects" ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "ai_projects" ADD COLUMN IF NOT EXISTS "decision_by_id" integer;
--> statement-breakpoint
ALTER TABLE "ai_projects" ADD COLUMN IF NOT EXISTS "decision_at" timestamp;
--> statement-breakpoint
ALTER TABLE "ai_projects" ADD COLUMN IF NOT EXISTS "decision_reason" text;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ai_project_checklists" (
  "id" serial PRIMARY KEY NOT NULL,
  "organization_id" integer DEFAULT 1 NOT NULL,
  "project_id" integer NOT NULL,
  "gate" "ai_gate" NOT NULL,
  "item_key" varchar(128),
  "item_text" text NOT NULL,
  "evidence_link" varchar(1024),
  "checked" boolean DEFAULT true NOT NULL,
  "checked_by_id" integer,
  "checked_at" timestamp DEFAULT now() NOT NULL,
  "checked_by" varchar(256)
);
--> statement-breakpoint
ALTER TABLE "ai_project_checklists" ADD COLUMN IF NOT EXISTS "organization_id" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_project_checklists" ADD COLUMN IF NOT EXISTS "item_key" varchar(128);
--> statement-breakpoint
ALTER TABLE "ai_project_checklists" ADD COLUMN IF NOT EXISTS "checked" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_project_checklists" ADD COLUMN IF NOT EXISTS "checked_by_id" integer;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ai_project_decisions" (
  "id" serial PRIMARY KEY NOT NULL,
  "organization_id" integer NOT NULL,
  "project_id" integer NOT NULL,
  "decision_type" varchar(32) NOT NULL,
  "decision" varchar(32) NOT NULL,
  "from_gate" "ai_gate",
  "to_gate" "ai_gate",
  "reason" text NOT NULL,
  "evidence" jsonb,
  "actor_id" integer NOT NULL,
  "actor_role" varchar(32) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_projects_org_gate_idx" ON "ai_projects" ("organization_id", "gate");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_project_decisions_org_project_idx" ON "ai_project_decisions" ("organization_id", "project_id", "created_at");
--> statement-breakpoint

ALTER TABLE "ai_risk_assessments" ADD COLUMN IF NOT EXISTS "organization_id" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_compliance_checks" ADD COLUMN IF NOT EXISTS "organization_id" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_compliance_checks" ADD COLUMN IF NOT EXISTS "status" varchar(32) DEFAULT 'not_assessed' NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_compliance_checks" ADD COLUMN IF NOT EXISTS "reviewer_id" integer;
--> statement-breakpoint
ALTER TABLE "ai_compliance_checks" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp;
--> statement-breakpoint
ALTER TABLE "ai_compliance_checks" ADD COLUMN IF NOT EXISTS "review_notes" text;
--> statement-breakpoint
ALTER TABLE "ai_compliance_checks" ADD COLUMN IF NOT EXISTS "rule_version" varchar(64);
--> statement-breakpoint
ALTER TABLE "ai_compliance_checks" ADD COLUMN IF NOT EXISTS "automated" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_compliance_checks" ADD COLUMN IF NOT EXISTS "evidence_verified" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_risk_history" ADD COLUMN IF NOT EXISTS "organization_id" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "ml_models" ADD COLUMN IF NOT EXISTS "organization_id" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "ml_model_metrics" ADD COLUMN IF NOT EXISTS "organization_id" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "ml_prediction_logs" ADD COLUMN IF NOT EXISTS "organization_id" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "ml_prediction_logs" ADD COLUMN IF NOT EXISTS "prompt_tokens" integer;
--> statement-breakpoint
ALTER TABLE "ml_prediction_logs" ADD COLUMN IF NOT EXISTS "completion_tokens" integer;
--> statement-breakpoint
ALTER TABLE "ml_prediction_logs" ADD COLUMN IF NOT EXISTS "cost_usd" real;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ml_models_org_status_idx" ON "ml_models" ("organization_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ml_model_metrics_org_model_time_idx" ON "ml_model_metrics" ("organization_id", "model_id", "recorded_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ml_prediction_logs_org_model_time_idx" ON "ml_prediction_logs" ("organization_id", "model_id", "created_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "llm_invocation_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "organization_id" integer,
  "user_id" integer,
  "operation" varchar(128) NOT NULL,
  "provider" varchar(64) NOT NULL,
  "model" varchar(256) NOT NULL,
  "request_id" varchar(128),
  "provider_request_id" varchar(256),
  "status" varchar(32) NOT NULL,
  "input_tokens" integer,
  "output_tokens" integer,
  "token_source" varchar(32) DEFAULT 'unknown' NOT NULL,
  "estimated_cost_usd" numeric(18,8),
  "billed_cost_usd" numeric(18,8),
  "currency" varchar(3) DEFAULT 'USD' NOT NULL,
  "cost_provenance" varchar(40) DEFAULT 'not_available' NOT NULL,
  "pricing_version" varchar(128),
  "latency_ms" integer,
  "error_class" varchar(128),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "llm_invocation_logs_org_created_idx" ON "llm_invocation_logs" ("organization_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "llm_invocation_logs_org_operation_idx" ON "llm_invocation_logs" ("organization_id", "operation", "created_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ai_fairness_assessments" (
  "id" serial PRIMARY KEY NOT NULL,
  "organization_id" integer NOT NULL,
  "model_id" integer,
  "model_name" varchar(256) NOT NULL,
  "model_version" varchar(64) NOT NULL,
  "dataset_name" varchar(256) NOT NULL,
  "dataset_version" varchar(128) NOT NULL,
  "protected_attribute" varchar(128) NOT NULL,
  "decision_threshold" real,
  "minimum_group_size" integer DEFAULT 20 NOT NULL,
  "groups" jsonb NOT NULL,
  "metrics" jsonb NOT NULL,
  "methodology" text NOT NULL,
  "status" varchar(32) DEFAULT 'pending_review' NOT NULL,
  "created_by_id" integer NOT NULL,
  "reviewed_by_id" integer,
  "reviewed_at" timestamp,
  "review_notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_fairness_org_model_created_idx" ON "ai_fairness_assessments" ("organization_id", "model_id", "created_at");
--> statement-breakpoint

ALTER TABLE "ai_chat_history" ADD COLUMN IF NOT EXISTS "organizationId" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "organizationId" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "access_requests" ADD COLUMN IF NOT EXISTS "organizationId" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "access_requests" ADD COLUMN IF NOT EXISTS "ownerApprovedByUserId" integer;
--> statement-breakpoint
ALTER TABLE "access_requests" ADD COLUMN IF NOT EXISTS "stewardApprovedByUserId" integer;
--> statement-breakpoint
ALTER TABLE "servicenow_tickets" ADD COLUMN IF NOT EXISTS "organizationId" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "connector_configs" ADD COLUMN IF NOT EXISTS "organizationId" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "organizationId" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint

ALTER TABLE "sla_configs" ADD COLUMN IF NOT EXISTS "organizationId" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "sla_configs" ADD COLUMN IF NOT EXISTS "webhookUrl" text;
--> statement-breakpoint
ALTER TABLE "sla_configs" ADD COLUMN IF NOT EXISTS "severity" text DEFAULT 'medium';
--> statement-breakpoint
ALTER TABLE "sla_violations" ADD COLUMN IF NOT EXISTS "organizationId" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "sla_violations" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE "sla_violations" ADD COLUMN IF NOT EXISTS "rootCause" text;
--> statement-breakpoint
UPDATE "sla_violations" SET "status" = 'active' WHERE "status" IS NULL;
--> statement-breakpoint
WITH ranked AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "slaConfigId", "entityType", "entityId", "violationType"
    ORDER BY "detectedAt" DESC, "id" DESC
  ) AS rn
  FROM "sla_violations"
  WHERE "status" = 'active'
)
UPDATE "sla_violations" AS v
SET "status" = 'resolved', "resolvedAt" = COALESCE(v."resolvedAt", now()),
    "rootCause" = COALESCE(v."rootCause", 'Duplicate active SLA violation closed during migration')
FROM ranked
WHERE v."id" = ranked."id" AND ranked.rn > 1;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sla_violation_active_dedupe_idx"
  ON "sla_violations" ("slaConfigId", "entityType", "entityId", "violationType")
  WHERE "status" = 'active';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sla_configs_org_scope_idx" ON "sla_configs" ("organizationId", "entityType", "entityId", "active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sla_violations_org_status_idx" ON "sla_violations" ("organizationId", "status", "detectedAt");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "sla_evaluation_runs" (
  "id" serial PRIMARY KEY NOT NULL,
  "organizationId" integer NOT NULL,
  "runId" varchar(64) NOT NULL UNIQUE,
  "source" varchar(32) NOT NULL,
  "status" varchar(32) NOT NULL,
  "startedAt" timestamp DEFAULT now() NOT NULL,
  "finishedAt" timestamp,
  "actorId" integer,
  "details" jsonb
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sla_evaluation_runs_org_started_idx" ON "sla_evaluation_runs" ("organizationId", "startedAt");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "external_project_syncs" (
  "id" serial PRIMARY KEY NOT NULL,
  "organization_id" integer NOT NULL,
  "project_id" integer NOT NULL,
  "provider" varchar(32) NOT NULL,
  "status" varchar(32) DEFAULT 'pending' NOT NULL,
  "remote_id" varchar(128),
  "remote_number" varchar(128),
  "remote_url" text,
  "idempotency_key" varchar(256) NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_attempt_at" timestamp,
  "last_success_at" timestamp,
  "error_message" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "external_project_syncs_org_project_provider_idx"
  ON "external_project_syncs" ("organization_id", "project_id", "provider");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "external_project_syncs_idempotency_idx" ON "external_project_syncs" ("idempotency_key");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "deployment_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "organization_id" integer NOT NULL,
  "model_id" integer NOT NULL,
  "action" varchar(16) DEFAULT 'deploy' NOT NULL,
  "target_environment" varchar(64) NOT NULL,
  "status" varchar(32) DEFAULT 'pending_approval' NOT NULL,
  "pipeline_id" integer,
  "azure_run_id" integer,
  "rollback_of_request_id" integer,
  "reason" text NOT NULL,
  "requested_by_id" integer NOT NULL,
  "approved_by_id" integer,
  "approval_reason" text,
  "requested_at" timestamp DEFAULT now() NOT NULL,
  "approved_at" timestamp,
  "started_at" timestamp,
  "completed_at" timestamp,
  "last_error" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deployment_requests_org_status_idx" ON "deployment_requests" ("organization_id", "status", "requested_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deployment_requests_org_model_idx" ON "deployment_requests" ("organization_id", "model_id", "requested_at");
--> statement-breakpoint

ALTER TABLE "business_glossary" ADD COLUMN IF NOT EXISTS "organizationId" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_glossary_org_status_term_idx" ON "business_glossary" ("organizationId", "status", "term");
--> statement-breakpoint
