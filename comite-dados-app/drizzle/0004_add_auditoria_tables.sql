CREATE TABLE "ai_cost_savings_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantCatalog" varchar(256) NOT NULL,
	"date" varchar(10) NOT NULL,
	"copilotHits" integer DEFAULT 0 NOT NULL,
	"selfHealingHits" integer DEFAULT 0 NOT NULL,
	"totalCostSavedUSD" double precision DEFAULT 0 NOT NULL,
	"totalLLMCallsMade" integer DEFAULT 0 NOT NULL,
	"totalLLMCallsAvoided" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_weekly_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantCatalog" varchar(256) NOT NULL,
	"weekStartDate" timestamp NOT NULL,
	"weekEndDate" timestamp NOT NULL,
	"totalQuestions" integer DEFAULT 0 NOT NULL,
	"totalCostUSD" double precision DEFAULT 0 NOT NULL,
	"cacheHitRate" double precision DEFAULT 0 NOT NULL,
	"totalSavedUSD" double precision DEFAULT 0 NOT NULL,
	"rateLimitBlocks" integer DEFAULT 0 NOT NULL,
	"topQuestionsJson" json,
	"anomaliesJson" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analysis_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"sessionId" integer NOT NULL,
	"analysisType" varchar(32) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"resultData" json,
	"recommendations" json,
	"gaps" json,
	"score" double precision,
	"executionMs" integer,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"databricksHost" varchar(512) NOT NULL,
	"targetCatalog" varchar(256) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"governanceScore" double precision,
	"totalCatalogs" integer,
	"totalSchemas" integer,
	"totalTables" integer,
	"docCoverage" double precision,
	"tagCoverage" double precision,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copilot_knowledge_base" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantCatalog" varchar(256) NOT NULL,
	"question" text NOT NULL,
	"questionNormalized" text NOT NULL,
	"sqlExecuted" text,
	"answer" text NOT NULL,
	"resultData" json,
	"intent" varchar(16) DEFAULT 'read',
	"questionType" varchar(16) DEFAULT 'operational' NOT NULL,
	"answerPromptTemplate" text,
	"askedByUserId" integer,
	"askedByEmail" varchar(320),
	"hitCount" integer DEFAULT 0 NOT NULL,
	"costSavedPerHitUSD" double precision DEFAULT 0.0097,
	"expiresAt" timestamp,
	"feedback" varchar(16),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "self_healing_knowledge_base" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantCatalog" varchar(256) NOT NULL,
	"schemaName" varchar(256) NOT NULL,
	"tableName" varchar(256) NOT NULL,
	"suggestions" json NOT NULL,
	"applicationStatus" varchar(32) DEFAULT 'pending_review' NOT NULL,
	"appliedByUserId" integer,
	"appliedAt" timestamp,
	"costSavedPerHitUSD" double precision DEFAULT 0.01425,
	"hitCount" integer DEFAULT 0 NOT NULL,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" varchar(16) DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
