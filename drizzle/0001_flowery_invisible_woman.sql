CREATE TABLE "site" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"icon" varchar(50),
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "site" ADD CONSTRAINT "site_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_sites_org" ON "site" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "site" ADD CONSTRAINT "site_organization_id_slug_unique" UNIQUE("organization_id","slug");--> statement-breakpoint
-- Drop old unique constraint
ALTER TABLE "channel" DROP CONSTRAINT "channel_organization_id_name_unique";--> statement-breakpoint
-- Add site_id column as nullable (will be populated by data migration)
ALTER TABLE "channel" ADD COLUMN "site_id" text;--> statement-breakpoint
-- Create index on site_id
CREATE INDEX "idx_channels_site" ON "channel" USING btree ("site_id");