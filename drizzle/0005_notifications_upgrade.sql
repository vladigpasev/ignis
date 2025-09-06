-- Upgrade notification_subscriptions to be user-bound and support unsubscribe
ALTER TABLE "notification_subscriptions" ADD COLUMN IF NOT EXISTS "user_id" integer;
ALTER TABLE "notification_subscriptions" ADD COLUMN IF NOT EXISTS "active" integer DEFAULT 1 NOT NULL;
ALTER TABLE "notification_subscriptions" ADD COLUMN IF NOT EXISTS "unsubscribe_token" varchar(128);
ALTER TABLE "notification_subscriptions" ALTER COLUMN "source_firms" SET DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notification_subscriptions_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "notification_subscriptions" ADD CONSTRAINT "notification_subscriptions_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "notif_sub_user_idx" ON "notification_subscriptions" USING btree ("user_id");

