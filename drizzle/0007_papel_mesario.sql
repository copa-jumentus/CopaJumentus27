ALTER TABLE "admin" ADD COLUMN "papel" text DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE "admin" ADD CONSTRAINT "admin_papel_valido" CHECK ("admin"."papel" in ('admin', 'mesario'));