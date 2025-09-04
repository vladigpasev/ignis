CREATE TABLE "fire_volunteers" (
  "id" serial PRIMARY KEY NOT NULL,
  "fire_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "status" varchar(16) NOT NULL DEFAULT 'requested',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fire_volunteers" ADD CONSTRAINT "fire_volunteers_fire_id_fires_id_fk"
  FOREIGN KEY ("fire_id") REFERENCES "public"."fires"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fire_volunteers" ADD CONSTRAINT "fire_volunteers_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "fire_volunteers_fire_user_unique" ON "fire_volunteers" USING btree ("fire_id","user_id");
--> statement-breakpoint
CREATE INDEX "fire_volunteers_fire_id_idx" ON "fire_volunteers" USING btree ("fire_id");
--> statement-breakpoint
CREATE INDEX "fire_volunteers_user_id_idx" ON "fire_volunteers" USING btree ("user_id");
--> statement-breakpoint

CREATE TABLE "fire_join_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "fire_id" integer NOT NULL,
  "token" varchar(128) NOT NULL,
  "created_by" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "fire_join_tokens" ADD CONSTRAINT "fire_join_tokens_fire_id_fires_id_fk"
  FOREIGN KEY ("fire_id") REFERENCES "public"."fires"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "fire_join_tokens" ADD CONSTRAINT "fire_join_tokens_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "fire_join_tokens_token_unique" ON "fire_join_tokens" USING btree ("token");
--> statement-breakpoint
CREATE INDEX "fire_join_tokens_fire_id_idx" ON "fire_join_tokens" USING btree ("fire_id");

