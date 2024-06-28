CREATE TABLE IF NOT EXISTS "social_score" (
	"fid" numeric(12, 0) NOT NULL,
	"target_fid" numeric(12, 0) NOT NULL,
	"score" numeric(12, 1) NOT NULL,
	CONSTRAINT "social_score_fid_target_fid_pk" PRIMARY KEY("fid","target_fid")
);
--> statement-breakpoint
ALTER TABLE "user_data" ADD COLUMN "power_badge" boolean DEFAULT false NOT NULL;