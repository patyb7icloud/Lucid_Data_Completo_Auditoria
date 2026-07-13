-- Migration 0005: HUB AI & Data (Nexa Playbook) — Gates G0-G4, Lifecycle, Business Case, Artefatos
-- Criado em: 2026-07-10

-- ─── Novos Enums ──────────────────────────────────────────────────────────────
CREATE TYPE "gate_name" AS ENUM ('G0', 'G1', 'G2', 'G3', 'G4');
--> statement-breakpoint
CREATE TYPE "gate_decision" AS ENUM ('go', 'no_go', 'pendente');
--> statement-breakpoint
CREATE TYPE "artifact_type" AS ENUM (
  'ficha_hipotese', 'business_case', 'risk_assessment',
  'checklist_arquitetura', 'checklist_compliance', 'status_report',
  'uat_doc', 'gmud', 'handover', 'knowledge_transfer', 'outro'
);
--> statement-breakpoint
CREATE TYPE "lifecycle_phase" AS ENUM (
  'descoberta_problema', 'descoberta_hipoteses', 'avaliacao_hipotese',
  'poc', 'desenvolvimento_testes', 'uat', 'habilitacao_operacional',
  'hypercare', 'lancamento_operacional', 'sustentacao'
);
--> statement-breakpoint

-- ─── Tabela: intake_gates_history ─────────────────────────────────────────────
CREATE TABLE "intake_gates_history" (
  "id"               serial PRIMARY KEY NOT NULL,
  "intake_id"        integer NOT NULL,
  "gate_name"        "gate_name" NOT NULL,
  "decision"         "gate_decision" NOT NULL DEFAULT 'pendente',
  "criteria_met"     jsonb,
  "approved_by_id"   integer,
  "approved_by_name" varchar(256),
  "decided_at"       timestamp,
  "comments"         text,
  "created_at"       timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ─── Tabela: intake_lifecycle ─────────────────────────────────────────────────
CREATE TABLE "intake_lifecycle" (
  "id"                       serial PRIMARY KEY NOT NULL,
  "intake_id"                integer NOT NULL UNIQUE,
  "phase"                    "lifecycle_phase" NOT NULL DEFAULT 'descoberta_problema',
  "phase_history"            jsonb DEFAULT '[]',
  "hypercare_started_at"     timestamp,
  "hypercare_exit_criteria"  jsonb,
  "updated_at"               timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ─── Tabela: intake_business_case ────────────────────────────────────────────
CREATE TABLE "intake_business_case" (
  "id"                    serial PRIMARY KEY NOT NULL,
  "intake_id"             integer NOT NULL UNIQUE,
  "reduces_fte"           boolean DEFAULT false,
  "reduces_fte_value"     real,
  "avoids_infra_costs"    boolean DEFAULT false,
  "avoids_infra_value"    real,
  "avoids_penalties"      boolean DEFAULT false,
  "avoids_penalties_value" real,
  "avoids_future_costs"   boolean DEFAULT false,
  "avoids_future_value"   real,
  "increases_efficiency"  boolean DEFAULT false,
  "efficiency_value"      real,
  "intangible_benefits"   text,
  "capex_total"           real,
  "opex_monthly"          real,
  "opex_annual"           real,
  "estimated_roi_months"  integer,
  "components_cost"       jsonb DEFAULT '[]',
  "score_data_readiness"  smallint,
  "score_tech_readiness"  smallint,
  "score_maintenance"     smallint,
  "score_org_readiness"   smallint,
  "score_timeline"        smallint,
  "score_strategic_value" smallint,
  "score_value_impact"    smallint,
  "score_reusability"     smallint,
  "score_risk_probability" smallint,
  "score_security"        smallint,
  "score_risk_impact"     smallint,
  "created_by_id"         integer,
  "created_at"            timestamp DEFAULT now() NOT NULL,
  "updated_at"            timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ─── Tabela: intake_artifacts ─────────────────────────────────────────────────
CREATE TABLE "intake_artifacts" (
  "id"               serial PRIMARY KEY NOT NULL,
  "intake_id"        integer NOT NULL,
  "artifact_type"    "artifact_type" NOT NULL,
  "title"            varchar(512) NOT NULL,
  "file_url"         text,
  "file_name"        varchar(512),
  "file_size_bytes"  integer,
  "mime_type"        varchar(128),
  "version"          integer DEFAULT 1 NOT NULL,
  "notes"            text,
  "uploaded_by_id"   integer,
  "uploaded_by_name" varchar(256),
  "uploaded_at"      timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- ─── Índices para performance ─────────────────────────────────────────────────
CREATE INDEX "idx_gates_history_intake" ON "intake_gates_history" ("intake_id");
--> statement-breakpoint
CREATE INDEX "idx_artifacts_intake" ON "intake_artifacts" ("intake_id");
--> statement-breakpoint
CREATE INDEX "idx_artifacts_type" ON "intake_artifacts" ("artifact_type");
