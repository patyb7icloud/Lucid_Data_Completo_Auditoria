CREATE TABLE "tier_sync_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"domainId" integer NOT NULL,
	"domainName" varchar(256) NOT NULL,
	"tierLevel" integer NOT NULL,
	"action" varchar(64) NOT NULL,
	"databricksGroup" varchar(256),
	"catalog" varchar(256),
	"schema" varchar(256),
	"appliedCount" integer DEFAULT 0,
	"failedCount" integer DEFAULT 0,
	"skippedCount" integer DEFAULT 0,
	"results" jsonb,
	"performedBy" varchar(320),
	"syncedAt" timestamp DEFAULT now() NOT NULL
);
