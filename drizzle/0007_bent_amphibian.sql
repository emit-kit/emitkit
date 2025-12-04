ALTER TABLE "site" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
CREATE INDEX "idx_sites_deleted" ON "site" USING btree ("deleted_at");