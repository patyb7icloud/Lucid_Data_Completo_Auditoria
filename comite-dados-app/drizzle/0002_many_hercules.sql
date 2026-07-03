CREATE TYPE "public"."bi_connector_type" AS ENUM('powerbi', 'sap', 'databricks', 'tableau', 'looker', 'other');--> statement-breakpoint
CREATE TYPE "public"."compliance_framework" AS ENUM('lgpd', 'eu_ai_act', 'iso_42001', 'nist_ai_rmf');--> statement-breakpoint
CREATE TYPE "public"."drift_status" AS ENUM('ok', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."model_framework" AS ENUM('sklearn', 'pytorch', 'tensorflow', 'xgboost', 'lightgbm', 'huggingface', 'openai', 'other');--> statement-breakpoint
CREATE TYPE "public"."model_status" AS ENUM('development', 'staging', 'production', 'deprecated', 'archived');--> statement-breakpoint
CREATE TYPE "public"."model_type" AS ENUM('classification', 'regression', 'nlp', 'llm', 'computer_vision', 'clustering', 'other');--> statement-breakpoint
CREATE TYPE "public"."risk_category" AS ENUM('vies', 'privacidade', 'seguranca', 'explicabilidade', 'conformidade', 'operacional');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('baixo', 'medio', 'alto', 'critico');--> statement-breakpoint
CREATE TYPE "public"."risk_status" AS ENUM('aberto', 'em_mitigacao', 'mitigado', 'aceito');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('idle', 'running', 'success', 'error');--> statement-breakpoint
CREATE TABLE "ai_compliance_checks" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" integer,
	"model_name" varchar(256) NOT NULL,
	"framework" "compliance_framework" NOT NULL,
	"check_name" varchar(256) NOT NULL,
	"description" text,
	"passed" boolean DEFAULT false NOT NULL,
	"evidence" text,
	"notes" text,
	"checked_by_id" integer,
	"checked_at" timestamp DEFAULT now() NOT NULL,
	"next_review_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_risk_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" integer,
	"model_name" varchar(256) NOT NULL,
	"title" varchar(512) NOT NULL,
	"description" text,
	"category" "risk_category" NOT NULL,
	"level" "risk_level" DEFAULT 'medio' NOT NULL,
	"status" "risk_status" DEFAULT 'aberto' NOT NULL,
	"probability" smallint DEFAULT 3,
	"impact" smallint DEFAULT 3,
	"risk_score" integer,
	"xai_method" varchar(64),
	"xai_summary" text,
	"bias_metric" real,
	"bias_threshold" real,
	"mitigation_plan" text,
	"mitigation_due_at" timestamp,
	"mitigated_at" timestamp,
	"mitigated_by_id" integer,
	"owner_id" integer,
	"owner_name" varchar(256),
	"reviewer_id" integer,
	"reviewer_name" varchar(256),
	"created_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_risk_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" integer,
	"model_name" varchar(256) NOT NULL,
	"risk_score" integer NOT NULL,
	"open_count" integer DEFAULT 0,
	"critical_count" integer DEFAULT 0,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bi_connectors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"type" "bi_connector_type" NOT NULL,
	"description" text,
	"endpoint_url" text,
	"workspace_id" varchar(256),
	"dataset_id" varchar(256),
	"report_id" varchar(256),
	"auth_method" varchar(64) DEFAULT 'oauth2',
	"is_active" boolean DEFAULT true,
	"last_sync_at" timestamp,
	"last_sync_status" "sync_status" DEFAULT 'idle',
	"last_sync_error" text,
	"sync_count" integer DEFAULT 0,
	"config" jsonb DEFAULT '{}'::jsonb,
	"created_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bi_sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"connector_id" integer NOT NULL,
	"connector_name" varchar(256),
	"status" "sync_status" NOT NULL,
	"records_sent" integer DEFAULT 0,
	"duration_ms" integer,
	"payload" jsonb,
	"error_message" text,
	"triggered_by_id" integer,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ml_model_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" integer NOT NULL,
	"accuracy" real,
	"f1_score" real,
	"auc_score" real,
	"drift_score" real,
	"prediction_count" integer DEFAULT 0,
	"error_rate" real DEFAULT 0,
	"latency_p99_ms" integer,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ml_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"version" varchar(64) DEFAULT '1.0.0' NOT NULL,
	"description" text,
	"model_type" "model_type" DEFAULT 'classification' NOT NULL,
	"framework" "model_framework" DEFAULT 'sklearn' NOT NULL,
	"status" "model_status" DEFAULT 'development' NOT NULL,
	"domain_id" integer,
	"owner_id" integer,
	"owner_name" varchar(256),
	"accuracy_score" real,
	"f1_score" real,
	"auc_score" real,
	"precision_score" real,
	"recall_score" real,
	"drift_score" real DEFAULT 0,
	"drift_status" "drift_status" DEFAULT 'ok',
	"last_drift_check" timestamp,
	"artifact_uri" text,
	"experiment_id" varchar(256),
	"run_id" varchar(256),
	"git_commit" varchar(64),
	"tags" jsonb DEFAULT '[]'::jsonb,
	"input_schema" jsonb,
	"output_schema" jsonb,
	"deployed_at" timestamp,
	"deprecated_at" timestamp,
	"created_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ml_prediction_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" integer NOT NULL,
	"input_hash" varchar(64),
	"output_label" text,
	"confidence" real,
	"latency_ms" integer,
	"user_id" integer,
	"request_id" varchar(128),
	"flagged" boolean DEFAULT false,
	"flag_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
