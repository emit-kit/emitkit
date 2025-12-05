DROP INDEX "idx_integrations_channel";--> statement-breakpoint
ALTER TABLE "integration" ALTER COLUMN "channel_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "integration" ADD COLUMN "scope" text NOT NULL;--> statement-breakpoint
ALTER TABLE "integration" ADD COLUMN "folder_id" text;--> statement-breakpoint
ALTER TABLE "integration" ADD COLUMN "event_filters" json DEFAULT '{"eventTypes":["all"]}'::json NOT NULL;--> statement-breakpoint
ALTER TABLE "integration" ADD CONSTRAINT "integration_folder_id_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_integrations_org_enabled" ON "integration" USING btree ("organization_id","enabled") WHERE "integration"."enabled" = true;--> statement-breakpoint
CREATE INDEX "idx_integrations_folder_enabled" ON "integration" USING btree ("folder_id") WHERE "integration"."enabled" = true AND "integration"."scope" = 'folder';--> statement-breakpoint
CREATE INDEX "idx_integrations_channel_enabled" ON "integration" USING btree ("channel_id") WHERE "integration"."enabled" = true AND "integration"."scope" = 'channel';--> statement-breakpoint
ALTER TABLE "integration" DROP COLUMN "events";