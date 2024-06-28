DROP TABLE "messages";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "following_idx" ON "links" USING btree ("fid");