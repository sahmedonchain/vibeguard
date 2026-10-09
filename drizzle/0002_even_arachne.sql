CREATE TABLE "analysis_cache" (
	"chain_id" integer NOT NULL,
	"kind" text NOT NULL,
	"address" varchar(42) NOT NULL,
	"payload" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analysis_cache_chain_id_kind_address_pk" PRIMARY KEY("chain_id","kind","address")
);
--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "creation_to" varchar(42);--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "creation_selector" varchar(10);