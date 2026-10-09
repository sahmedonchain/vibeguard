CREATE TABLE "contract_permissions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"scan_id" uuid NOT NULL,
	"chain_id" integer NOT NULL,
	"address" varchar(42) NOT NULL,
	"capability" text NOT NULL,
	"signature" text NOT NULL,
	"selector" varchar(10) NOT NULL,
	"detected_via" text NOT NULL,
	"confidence" text NOT NULL,
	CONSTRAINT "contract_permissions_uq" UNIQUE("scan_id","selector")
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"address" varchar(42) NOT NULL,
	"has_code" boolean NOT NULL,
	"code_size" integer,
	"code_hash" varchar(66),
	"source_verified" boolean,
	"analyzed_block" bigint,
	"analysis" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contracts_chain_address_uq" UNIQUE("chain_id","address")
);
--> statement-breakpoint
CREATE TABLE "evidence_records" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"scan_id" uuid NOT NULL,
	"finding_id" bigint,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"data" jsonb,
	"address" varchar(42),
	"tx_hash" varchar(66),
	"block_number" bigint
);
--> statement-breakpoint
CREATE TABLE "indexed_blocks" (
	"chain_id" integer NOT NULL,
	"block_number" bigint NOT NULL,
	"block_hash" varchar(66) NOT NULL,
	"parent_hash" varchar(66) NOT NULL,
	"block_time" timestamp with time zone NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "indexed_blocks_chain_id_block_number_pk" PRIMARY KEY("chain_id","block_number")
);
--> statement-breakpoint
CREATE TABLE "indexer_checkpoints" (
	"chain_id" integer NOT NULL,
	"stream" text NOT NULL,
	"last_block" bigint NOT NULL,
	"last_block_hash" varchar(66) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "indexer_checkpoints_chain_id_stream_pk" PRIMARY KEY("chain_id","stream")
);
--> statement-breakpoint
CREATE TABLE "indexer_errors" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"stream" text NOT NULL,
	"message" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "methodology_versions" (
	"version" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"weights" jsonb NOT NULL,
	"thresholds" jsonb NOT NULL,
	"severity_points" jsonb NOT NULL,
	"rules" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "networks" (
	"chain_id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"explorer_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_counters" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limit_counters_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "risk_findings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"scan_id" uuid NOT NULL,
	"rule_id" text NOT NULL,
	"category" text NOT NULL,
	"status" text NOT NULL,
	"severity" text NOT NULL,
	"confidence" text NOT NULL,
	"title" text NOT NULL,
	"explanation" text NOT NULL,
	"follow_up" text,
	CONSTRAINT "risk_findings_scan_rule_uq" UNIQUE("scan_id","rule_id")
);
--> statement-breakpoint
CREATE TABLE "risk_scores" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"scan_id" uuid NOT NULL,
	"overall" numeric(5, 2),
	"level" text NOT NULL,
	"coverage" numeric(5, 4) NOT NULL,
	"provisional" boolean NOT NULL,
	"critical_override" boolean NOT NULL,
	"categories" jsonb NOT NULL,
	"methodology_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "risk_scores_scan_id_unique" UNIQUE("scan_id")
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"token_address" varchar(42) NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"analysis_block" bigint,
	"analysis_block_hash" varchar(66),
	"analysis_block_time" timestamp with time zone,
	"latest_indexed_block" bigint,
	"methodology_version" text,
	"error_code" text,
	"error_message" text,
	"context" jsonb,
	CONSTRAINT "scans_status_ck" CHECK ("scans"."status" in ('queued','running','completed','partial','failed','unsupported'))
);
--> statement-breakpoint
CREATE TABLE "token_transfers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"token_address" varchar(42) NOT NULL,
	"block_number" bigint NOT NULL,
	"block_hash" varchar(66) NOT NULL,
	"tx_hash" varchar(66) NOT NULL,
	"log_index" integer NOT NULL,
	"from_address" varchar(42) NOT NULL,
	"to_address" varchar(42) NOT NULL,
	"value" numeric(78, 0) NOT NULL,
	CONSTRAINT "token_transfers_event_uq" UNIQUE("chain_id","tx_hash","log_index")
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"address" varchar(42) NOT NULL,
	"name" text,
	"symbol" text,
	"decimals" smallint,
	"total_supply" numeric(78, 0),
	"discovery_source" text NOT NULL,
	"creation_block" bigint,
	"creation_tx_hash" varchar(66),
	"creator_address" varchar(42),
	"creation_source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tokens_chain_address_uq" UNIQUE("chain_id","address")
);
--> statement-breakpoint
ALTER TABLE "contract_permissions" ADD CONSTRAINT "contract_permissions_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_chain_id_networks_chain_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."networks"("chain_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_finding_id_risk_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."risk_findings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_findings" ADD CONSTRAINT "risk_findings_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_scores" ADD CONSTRAINT "risk_scores_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_scores" ADD CONSTRAINT "risk_scores_methodology_version_methodology_versions_version_fk" FOREIGN KEY ("methodology_version") REFERENCES "public"."methodology_versions"("version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_chain_id_networks_chain_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."networks"("chain_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_chain_id_networks_chain_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."networks"("chain_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contract_permissions_addr_idx" ON "contract_permissions" USING btree ("chain_id","address");--> statement-breakpoint
CREATE INDEX "evidence_finding_idx" ON "evidence_records" USING btree ("finding_id");--> statement-breakpoint
CREATE INDEX "indexer_errors_idx" ON "indexer_errors" USING btree ("chain_id","stream","created_at");--> statement-breakpoint
CREATE INDEX "scans_token_idx" ON "scans" USING btree ("chain_id","token_address","requested_at");--> statement-breakpoint
CREATE INDEX "scans_status_idx" ON "scans" USING btree ("status","requested_at");--> statement-breakpoint
CREATE INDEX "token_transfers_token_block_idx" ON "token_transfers" USING btree ("chain_id","token_address","block_number");--> statement-breakpoint
CREATE INDEX "token_transfers_from_idx" ON "token_transfers" USING btree ("chain_id","from_address");--> statement-breakpoint
CREATE INDEX "token_transfers_to_idx" ON "token_transfers" USING btree ("chain_id","to_address");