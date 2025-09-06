import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function run() {
  // fire_ai_resources
  await sql`CREATE TABLE IF NOT EXISTS "fire_ai_resources" (
    "id" serial PRIMARY KEY NOT NULL,
    "fire_id" integer NOT NULL,
    "assistant_id" varchar(128) NOT NULL,
    "vector_store_id" varchar(128) NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`;

  // FKs and indexes for fire_ai_resources
  await sql`DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fire_ai_resources_fire_id_fires_id_fk'
    ) THEN
      ALTER TABLE "fire_ai_resources" ADD CONSTRAINT "fire_ai_resources_fire_id_fires_id_fk"
        FOREIGN KEY ("fire_id") REFERENCES "public"."fires"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "fire_ai_resources_fire_unique" ON "fire_ai_resources" USING btree ("fire_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "fire_ai_resources_assistant_idx" ON "fire_ai_resources" USING btree ("assistant_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "fire_ai_resources_vector_idx" ON "fire_ai_resources" USING btree ("vector_store_id")`;

  // fire_ai_threads
  await sql`CREATE TABLE IF NOT EXISTS "fire_ai_threads" (
    "id" serial PRIMARY KEY NOT NULL,
    "fire_id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "thread_id" varchar(128) NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`;

  await sql`DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fire_ai_threads_fire_id_fires_id_fk'
    ) THEN
      ALTER TABLE "fire_ai_threads" ADD CONSTRAINT "fire_ai_threads_fire_id_fires_id_fk"
        FOREIGN KEY ("fire_id") REFERENCES "public"."fires"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;`;
  await sql`DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fire_ai_threads_user_id_users_id_fk'
    ) THEN
      ALTER TABLE "fire_ai_threads" ADD CONSTRAINT "fire_ai_threads_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;`;

  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "fire_ai_threads_fire_user_unique" ON "fire_ai_threads" USING btree ("fire_id","user_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "fire_ai_threads_fire_idx" ON "fire_ai_threads" USING btree ("fire_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "fire_ai_threads_user_idx" ON "fire_ai_threads" USING btree ("user_id")`;
}

run().then(() => {
  console.log('Applied AI schema.');
}).catch((e) => {
  console.error('Failed:', e?.message || e);
  process.exit(1);
});

