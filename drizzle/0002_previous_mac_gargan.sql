CREATE TABLE "site" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"icon" varchar(50),
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "site_organization_id_slug_unique" UNIQUE("organization_id","slug")
);
--> statement-breakpoint
ALTER TABLE "site" ADD CONSTRAINT "site_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_sites_org" ON "site" USING btree ("organization_id");