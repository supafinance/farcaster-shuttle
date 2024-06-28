CREATE TABLE IF NOT EXISTS "casts" (
	"id" serial PRIMARY KEY NOT NULL,
	"fid" numeric(12, 0) NOT NULL,
	"parent_fid" numeric(12, 0),
	"hash" varchar(256),
	"parent_hash" varchar(256),
	"parent_url" text,
	"text" text,
	"embeds" json,
	"mentions" json,
	"mentions_positions" json,
	"timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" integer PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "links" (
	"id" serial PRIMARY KEY NOT NULL,
	"fid" numeric(12, 0) NOT NULL,
	"target_fid" numeric(12, 0) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"display_timestamp" timestamp,
	"type" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"timestamp" timestamp NOT NULL,
	"deleted_at" timestamp,
	"pruned_at" timestamp,
	"revoked_at" timestamp,
	"fid" numeric(12, 0) NOT NULL,
	"type" integer NOT NULL,
	"hash_scheme" integer NOT NULL,
	"signature_scheme" integer NOT NULL,
	"hash" varchar(256),
	"signer" varchar(256),
	"body" json,
	"raw" varchar(256)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"timestamp" timestamp NOT NULL,
	"deleted_at" timestamp,
	"fid" numeric(12, 0) NOT NULL,
	"target_cast_fid" numeric(12, 0) NOT NULL,
	"type" smallint NOT NULL,
	"hash" varchar(256),
	"target_cast_hash" varchar(256),
	"target_url" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_data" (
	"fid" numeric(12, 0) PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"pfp" text,
	"pfp_updated_at" timestamp,
	"username" text,
	"username_updated_at" timestamp,
	"display_name" text,
	"display_name_updated_at" timestamp,
	"bio" text,
	"bio_updated_at" timestamp,
	"url" text,
	"url_updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"address" varchar(42) NOT NULL,
	"pubKey" varchar(130) NOT NULL,
	"fid" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"timestamp" timestamp NOT NULL,
	"deleted_at" timestamp,
	"fid" numeric(12, 0) NOT NULL,
	"signer_address" varchar(42) NOT NULL
);
