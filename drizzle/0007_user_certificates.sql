-- User certificates (one per user per month)
CREATE TABLE IF NOT EXISTS "user_certificates" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "period" varchar(7) NOT NULL, -- YYYY-MM
  "title" varchar(200),
  "summary" text,
  "traits" jsonb,
  "metrics" jsonb,
  "data" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "user_cert_user_idx" ON "user_certificates" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "user_cert_unique_period" ON "user_certificates" ("user_id", "period");

