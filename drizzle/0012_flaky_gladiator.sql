CREATE TABLE "workflow" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"nodes" json DEFAULT '[]'::json NOT NULL,
	"edges" json DEFAULT '[]'::json NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_execution" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"status" text NOT NULL,
	"triggered_by" json NOT NULL,
	"logs" json DEFAULT '[]'::json NOT NULL,
	"error" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "workflow" ADD CONSTRAINT "workflow_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_execution" ADD CONSTRAINT "workflow_execution_workflow_id_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_workflows_org_enabled" ON "workflow" USING btree ("organization_id","enabled");--> statement-breakpoint
CREATE INDEX "idx_workflow_executions_workflow_status" ON "workflow_execution" USING btree ("workflow_id","status");