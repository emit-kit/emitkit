CREATE TYPE "public"."retention_tier" AS ENUM('basic', 'premium', 'unlimited');--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "retention_tier" "retention_tier" DEFAULT 'basic' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" DROP COLUMN "retention_days";