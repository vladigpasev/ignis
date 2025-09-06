import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function run() {
  // Create subscriptions table
  await sql`CREATE TABLE IF NOT EXISTS "notification_subscriptions" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer,
    "email" varchar(255),
    "phone" varchar(32),
    "lat" double precision NOT NULL,
    "lng" double precision NOT NULL,
    "radius_km" integer DEFAULT 15 NOT NULL,
    "source_firms" integer DEFAULT 0 NOT NULL,
    "source_reports" integer DEFAULT 1 NOT NULL,
    "active" integer DEFAULT 1 NOT NULL,
    "unsubscribe_token" varchar(128),
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )`;

  // Add columns in existing DBs
  await sql`ALTER TABLE "notification_subscriptions" ADD COLUMN IF NOT EXISTS "user_id" integer`;
  await sql`ALTER TABLE "notification_subscriptions" ADD COLUMN IF NOT EXISTS "active" integer DEFAULT 1 NOT NULL`;
  await sql`ALTER TABLE "notification_subscriptions" ADD COLUMN IF NOT EXISTS "unsubscribe_token" varchar(128)`;
  await sql`ALTER TABLE "notification_subscriptions" ALTER COLUMN "source_firms" SET DEFAULT 0`;

  // FK for user
  await sql`DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'notification_subscriptions_user_id_users_id_fk'
    ) THEN
      ALTER TABLE "notification_subscriptions" ADD CONSTRAINT "notification_subscriptions_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
  END $$;`;

  // Indexes for subscriptions (ensure after columns exist)
  await sql`CREATE INDEX IF NOT EXISTS "notif_sub_user_idx" ON "notification_subscriptions" USING btree ("user_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "notif_sub_email_idx" ON "notification_subscriptions" USING btree ("email")`;
  await sql`CREATE INDEX IF NOT EXISTS "notif_sub_phone_idx" ON "notification_subscriptions" USING btree ("phone")`;
  await sql`CREATE INDEX IF NOT EXISTS "notif_sub_coord_idx" ON "notification_subscriptions" USING btree ("lat","lng")`;

  // Create deliveries table
  await sql`CREATE TABLE IF NOT EXISTS "notification_deliveries" (
    "id" serial PRIMARY KEY NOT NULL,
    "subscription_id" integer NOT NULL,
    "event_key" varchar(256) NOT NULL,
    "delivered_at" timestamp with time zone DEFAULT now() NOT NULL,
    "meta" jsonb
  )`;

  // FK for deliveries (add if not exists)
  await sql`DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'notification_deliveries_subscription_id_notification_subscriptions_id_fk'
    ) THEN
      ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_subscription_id_notification_subscriptions_id_fk"
        FOREIGN KEY ("subscription_id") REFERENCES "public"."notification_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
  END $$;`;

  // Indexes and unique constraint for deliveries
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "notif_delivery_sub_event_unique" ON "notification_deliveries" USING btree ("subscription_id","event_key")`;
  await sql`CREATE INDEX IF NOT EXISTS "notif_delivery_sub_idx" ON "notification_deliveries" USING btree ("subscription_id")`;
}

run().then(() => {
  console.log('Applied notifications schema.');
}).catch((e) => {
  console.error('Failed:', e?.message || e);
  process.exit(1);
});
