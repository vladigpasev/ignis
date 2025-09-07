import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function run() {
  // Create table if missing
  await sql`CREATE TABLE IF NOT EXISTS "volunteer_profiles" (
    "id" serial PRIMARY KEY,
    "user_id" integer NOT NULL,
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
  )`;

  // Add missing columns (for drifted DBs)
  await sql`ALTER TABLE "volunteer_profiles" ADD COLUMN IF NOT EXISTS "user_id" integer NOT NULL`;
  await sql`ALTER TABLE "volunteer_profiles" ADD COLUMN IF NOT EXISTS "phone" varchar(32)`;
  await sql`ALTER TABLE "volunteer_profiles" ADD COLUMN IF NOT EXISTS "city" varchar(255)`;
  await sql`ALTER TABLE "volunteer_profiles" ADD COLUMN IF NOT EXISTS "lat" double precision`;
  await sql`ALTER TABLE "volunteer_profiles" ADD COLUMN IF NOT EXISTS "lng" double precision`;
  await sql`ALTER TABLE "volunteer_profiles" ADD COLUMN IF NOT EXISTS "bio" text`;
  await sql`ALTER TABLE "volunteer_profiles" ADD COLUMN IF NOT EXISTS "motivation" text`;
  await sql`ALTER TABLE "volunteer_profiles" ADD COLUMN IF NOT EXISTS "skills" jsonb`;
  await sql`ALTER TABLE "volunteer_profiles" ADD COLUMN IF NOT EXISTS "transport" jsonb`;
  await sql`ALTER TABLE "volunteer_profiles" ADD COLUMN IF NOT EXISTS "availability" varchar(64)`;
  await sql`ALTER TABLE "volunteer_profiles" ADD COLUMN IF NOT EXISTS "first_aid" integer`;
  await sql`ALTER TABLE "volunteer_profiles" ADD COLUMN IF NOT EXISTS "agree_contact" integer`;
  await sql`ALTER TABLE "volunteer_profiles" ADD COLUMN IF NOT EXISTS "created_at" timestamptz NOT NULL DEFAULT now()`;
  await sql`ALTER TABLE "volunteer_profiles" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now()`;
  await sql`ALTER TABLE "volunteer_profiles" ADD COLUMN IF NOT EXISTS "completed_at" timestamptz`;

  // Foreign key to users (idempotent)
  await sql`DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'volunteer_profiles_user_id_users_id_fk'
    ) THEN
      ALTER TABLE "volunteer_profiles" ADD CONSTRAINT "volunteer_profiles_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;`;

  // Indexes
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "volunteer_profiles_user_unique" ON "volunteer_profiles" ("user_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "volunteer_profiles_user_idx" ON "volunteer_profiles" ("user_id")`;
}

run().then(() => {
  console.log('Applied volunteer_profiles schema.');
}).catch((e) => {
  console.error('Failed:', e?.message || e);
  process.exit(1);
});

