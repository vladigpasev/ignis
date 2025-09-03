CREATE TABLE "fires" (
  "id" serial PRIMARY KEY NOT NULL,
  "lat" double precision NOT NULL,
  "lng" double precision NOT NULL,
  "radius_m" integer NOT NULL,
  "status" varchar(16) DEFAULT 'active' NOT NULL,
  "created_by" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fires" ADD CONSTRAINT "fires_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "fires_created_at_idx" ON "fires" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "fires_coords_idx" ON "fires" USING btree ("lat","lng");

