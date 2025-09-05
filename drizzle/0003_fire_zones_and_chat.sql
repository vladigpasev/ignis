-- ZONES
CREATE TABLE "zones" (
  "id" serial PRIMARY KEY NOT NULL,
  "fire_id" integer NOT NULL,
  "title" varchar(120),
  "description" text,
  "geom_type" varchar(10) NOT NULL,
  "center_lat" double precision,
  "center_lng" double precision,
  "radius_m" integer,
  "polygon" jsonb,
  "created_by" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "zones" ADD CONSTRAINT "zones_fire_id_fires_id_fk"
  FOREIGN KEY ("fire_id") REFERENCES "public"."fires"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "zones" ADD CONSTRAINT "zones_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;
CREATE INDEX "zones_fire_id_idx" ON "zones" USING btree ("fire_id");

CREATE TABLE "zone_members" (
  "id" serial PRIMARY KEY NOT NULL,
  "zone_id" integer NOT NULL,
  "fire_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "zone_members" ADD CONSTRAINT "zone_members_zone_id_zones_id_fk"
  FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "zone_members" ADD CONSTRAINT "zone_members_fire_id_fires_id_fk"
  FOREIGN KEY ("fire_id") REFERENCES "public"."fires"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "zone_members" ADD CONSTRAINT "zone_members_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "zone_members_fire_user_unique" ON "zone_members" USING btree ("fire_id","user_id");
CREATE INDEX "zone_members_zone_id_idx" ON "zone_members" USING btree ("zone_id");
CREATE INDEX "zone_members_fire_id_idx" ON "zone_members" USING btree ("fire_id");
CREATE INDEX "zone_members_user_id_idx" ON "zone_members" USING btree ("user_id");

CREATE TABLE "zone_gallery_images" (
  "id" serial PRIMARY KEY NOT NULL,
  "zone_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "s3_key" varchar(256) NOT NULL,
  "url" text NOT NULL,
  "width" integer,
  "height" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "zone_gallery_images" ADD CONSTRAINT "zone_gallery_images_zone_id_zones_id_fk"
  FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "zone_gallery_images" ADD CONSTRAINT "zone_gallery_images_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;
CREATE INDEX "zone_gallery_zone_idx" ON "zone_gallery_images" USING btree ("zone_id");

CREATE TABLE "zone_updates" (
  "id" serial PRIMARY KEY NOT NULL,
  "zone_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "text" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "zone_updates" ADD CONSTRAINT "zone_updates_zone_id_zones_id_fk"
  FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "zone_updates" ADD CONSTRAINT "zone_updates_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;
CREATE INDEX "zone_updates_zone_idx" ON "zone_updates" USING btree ("zone_id");

CREATE TABLE "zone_update_images" (
  "id" serial PRIMARY KEY NOT NULL,
  "update_id" integer NOT NULL,
  "s3_key" varchar(256) NOT NULL,
  "url" text NOT NULL,
  "width" integer,
  "height" integer
);
ALTER TABLE "zone_update_images" ADD CONSTRAINT "zone_update_images_update_id_zone_updates_id_fk"
  FOREIGN KEY ("update_id") REFERENCES "public"."zone_updates"("id")
  ON DELETE cascade ON UPDATE no action;
CREATE INDEX "zone_update_images_update_idx" ON "zone_update_images" USING btree ("update_id");

-- CHATS
CREATE TABLE "chat_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "fire_id" integer NOT NULL,
  "zone_id" integer,
  "user_id" integer NOT NULL,
  "message" text NOT NULL DEFAULT '',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_fire_id_fires_id_fk"
  FOREIGN KEY ("fire_id") REFERENCES "public"."fires"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_zone_id_zones_id_fk"
  FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;
CREATE INDEX "chat_fire_idx" ON "chat_messages" USING btree ("fire_id");
CREATE INDEX "chat_zone_idx" ON "chat_messages" USING btree ("zone_id");
CREATE INDEX "chat_created_idx" ON "chat_messages" USING btree ("created_at");

CREATE TABLE "chat_blocks" (
  "id" serial PRIMARY KEY NOT NULL,
  "fire_id" integer NOT NULL,
  "blocked_user_id" integer NOT NULL,
  "blocked_by_user_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "chat_blocks" ADD CONSTRAINT "chat_blocks_fire_id_fires_id_fk"
  FOREIGN KEY ("fire_id") REFERENCES "public"."fires"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "chat_blocks" ADD CONSTRAINT "chat_blocks_blocked_user_id_users_id_fk"
  FOREIGN KEY ("blocked_user_id") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "chat_blocks" ADD CONSTRAINT "chat_blocks_blocked_by_user_id_users_id_fk"
  FOREIGN KEY ("blocked_by_user_id") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "chat_blocks_fire_blocked_unique" ON "chat_blocks" USING btree ("fire_id","blocked_user_id");
CREATE INDEX "chat_blocks_fire_idx" ON "chat_blocks" USING btree ("fire_id");

-- QR uses
CREATE TABLE "fire_join_token_uses" (
  "id" serial PRIMARY KEY NOT NULL,
  "token_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "used_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "fire_join_token_uses" ADD CONSTRAINT "fire_join_token_uses_token_id_fire_join_tokens_id_fk"
  FOREIGN KEY ("token_id") REFERENCES "public"."fire_join_tokens"("id")
  ON DELETE cascade ON UPDATE no action;
ALTER TABLE "fire_join_token_uses" ADD CONSTRAINT "fire_join_token_uses_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;
CREATE INDEX "fire_join_token_uses_token_idx" ON "fire_join_token_uses" USING btree ("token_id");
CREATE INDEX "fire_join_token_uses_user_idx" ON "fire_join_token_uses" USING btree ("user_id");

