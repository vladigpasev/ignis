import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function run() {
  await sql`ALTER TABLE "fires" ADD COLUMN IF NOT EXISTS "last_activity_at" timestamp with time zone DEFAULT now() NOT NULL`;
  await sql`ALTER TABLE "fires" ADD COLUMN IF NOT EXISTS "deactivated_at" timestamp with time zone`;

  await sql`CREATE TABLE IF NOT EXISTS "fire_deactivation_votes" (
    "id" serial PRIMARY KEY NOT NULL,
    "fire_id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
  )`;
  // FKs
  await sql`DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fire_deactivation_votes_fire_id_fires_id_fk'
    ) THEN
      ALTER TABLE "fire_deactivation_votes" ADD CONSTRAINT "fire_deactivation_votes_fire_id_fires_id_fk"
        FOREIGN KEY ("fire_id") REFERENCES "public"."fires"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;`;
  await sql`DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fire_deactivation_votes_user_id_users_id_fk'
    ) THEN
      ALTER TABLE "fire_deactivation_votes" ADD CONSTRAINT "fire_deactivation_votes_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;`;
  // Indexes
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "fire_deactivation_votes_unique" ON "fire_deactivation_votes" USING btree ("fire_id","user_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "fire_deactivation_votes_fire_idx" ON "fire_deactivation_votes" USING btree ("fire_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "fire_deactivation_votes_user_idx" ON "fire_deactivation_votes" USING btree ("user_id")`;
}

run().then(() => {
  console.log('Applied inactive changes.');
}).catch((e) => {
  console.error('Failed:', e?.message || e);
  process.exit(1);
});

