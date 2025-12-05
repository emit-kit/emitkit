ALTER TABLE "site" RENAME TO "folder";--> statement-breakpoint
ALTER TABLE "channel" RENAME COLUMN "site_id" TO "folder_id";--> statement-breakpoint
ALTER TABLE "folder" DROP CONSTRAINT "site_organization_id_slug_unique";--> statement-breakpoint
ALTER TABLE "channel" DROP CONSTRAINT "channel_site_id_name_unique";--> statement-breakpoint
ALTER TABLE "folder" DROP CONSTRAINT "site_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "channel" DROP CONSTRAINT "channel_site_id_site_id_fk";
--> statement-breakpoint
DROP INDEX "idx_sites_org";--> statement-breakpoint
DROP INDEX "idx_sites_deleted";--> statement-breakpoint
DROP INDEX "idx_channels_site";--> statement-breakpoint
ALTER TABLE "folder" ADD COLUMN "url" varchar(500);--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel" ADD CONSTRAINT "channel_folder_id_folder_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_folders_org" ON "folder" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_folders_deleted" ON "folder" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_channels_folder" ON "channel" USING btree ("folder_id");--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_organization_id_slug_unique" UNIQUE("organization_id","slug");--> statement-breakpoint
ALTER TABLE "channel" ADD CONSTRAINT "channel_folder_id_name_unique" UNIQUE("folder_id","name");