-- This migration should be run AFTER the data migration script
-- that populates site_id for all existing channels

-- Add NOT NULL constraint to site_id
ALTER TABLE "channel" ALTER COLUMN "site_id" SET NOT NULL;--> statement-breakpoint
-- Add foreign key constraint
ALTER TABLE "channel" ADD CONSTRAINT "channel_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Add unique constraint on (site_id, name)
ALTER TABLE "channel" ADD CONSTRAINT "channel_site_id_name_unique" UNIQUE("site_id","name");
