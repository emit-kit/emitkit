ALTER TABLE "channel" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
CREATE INDEX "idx_channels_deleted" ON "channel" USING btree ("deleted_at");