-- Create table volunteer_profiles
CREATE TABLE IF NOT EXISTS "volunteer_profiles" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "phone" varchar(32),
  "city" varchar(255),
  "lat" double precision,
  "lng" double precision,
  "bio" text,
  "motivation" text,
  "skills" jsonb,
  "transport" jsonb,
  "availability" varchar(64),
  "first_aid" integer,
  "agree_contact" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS "volunteer_profiles_user_unique" ON "volunteer_profiles" ("user_id");
CREATE INDEX IF NOT EXISTS "volunteer_profiles_user_idx" ON "volunteer_profiles" ("user_id");

