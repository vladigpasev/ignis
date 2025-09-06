-- Fires: add last_activity_at and deactivated_at
ALTER TABLE "fires" ADD COLUMN IF NOT EXISTS "last_activity_at" timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE "fires" ADD COLUMN IF NOT EXISTS "deactivated_at" timestamp with time zone;

-- Fire deactivation votes
CREATE TABLE IF NOT EXISTS "fire_deactivation_votes" (
  "id" serial PRIMARY KEY NOT NULL,
  "fire_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "fire_deactivation_votes" ADD CONSTRAINT IF NOT EXISTS "fire_deactivation_votes_fire_id_fires_id_fk"
  FOREIGN KEY ("fire_id") REFERENCES "public"."fires"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "fire_deactivation_votes" ADD CONSTRAINT IF NOT EXISTS "fire_deactivation_votes_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX IF NOT EXISTS "fire_deactivation_votes_unique" ON "fire_deactivation_votes" USING btree ("fire_id","user_id");
CREATE INDEX IF NOT EXISTS "fire_deactivation_votes_fire_idx" ON "fire_deactivation_votes" USING btree ("fire_id");
CREATE INDEX IF NOT EXISTS "fire_deactivation_votes_user_idx" ON "fire_deactivation_votes" USING btree ("user_id");
