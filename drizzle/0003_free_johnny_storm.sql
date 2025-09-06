CREATE TABLE "chat_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"fire_id" integer NOT NULL,
	"blocked_user_id" integer NOT NULL,
	"blocked_by_user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"fire_id" integer NOT NULL,
	"zone_id" integer,
	"user_id" integer NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "fire_deactivation_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"fire_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fire_join_token_uses" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL
);
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
CREATE TABLE "fire_volunteers" (
	"id" serial PRIMARY KEY NOT NULL,
	"fire_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"status" varchar(16) DEFAULT 'requested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"event_key" varchar(256) NOT NULL,
	"delivered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "notification_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255),
	"phone" varchar(32),
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"radius_km" integer DEFAULT 15 NOT NULL,
	"source_firms" integer DEFAULT 1 NOT NULL,
	"source_reports" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "zone_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"zone_id" integer NOT NULL,
	"fire_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zone_update_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"update_id" integer NOT NULL,
	"s3_key" varchar(256) NOT NULL,
	"url" text NOT NULL,
	"width" integer,
	"height" integer
);
--> statement-breakpoint
CREATE TABLE "zone_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"zone_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "fires" ADD COLUMN "last_activity_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "fires" ADD COLUMN "deactivated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chat_blocks" ADD CONSTRAINT "chat_blocks_fire_id_fires_id_fk" FOREIGN KEY ("fire_id") REFERENCES "public"."fires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_blocks" ADD CONSTRAINT "chat_blocks_blocked_user_id_users_id_fk" FOREIGN KEY ("blocked_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_blocks" ADD CONSTRAINT "chat_blocks_blocked_by_user_id_users_id_fk" FOREIGN KEY ("blocked_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_fire_id_fires_id_fk" FOREIGN KEY ("fire_id") REFERENCES "public"."fires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fire_deactivation_votes" ADD CONSTRAINT "fire_deactivation_votes_fire_id_fires_id_fk" FOREIGN KEY ("fire_id") REFERENCES "public"."fires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fire_deactivation_votes" ADD CONSTRAINT "fire_deactivation_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fire_join_token_uses" ADD CONSTRAINT "fire_join_token_uses_token_id_fire_join_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."fire_join_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fire_join_token_uses" ADD CONSTRAINT "fire_join_token_uses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fire_join_tokens" ADD CONSTRAINT "fire_join_tokens_fire_id_fires_id_fk" FOREIGN KEY ("fire_id") REFERENCES "public"."fires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fire_join_tokens" ADD CONSTRAINT "fire_join_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fire_volunteers" ADD CONSTRAINT "fire_volunteers_fire_id_fires_id_fk" FOREIGN KEY ("fire_id") REFERENCES "public"."fires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fire_volunteers" ADD CONSTRAINT "fire_volunteers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_subscription_id_notification_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."notification_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_gallery_images" ADD CONSTRAINT "zone_gallery_images_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_gallery_images" ADD CONSTRAINT "zone_gallery_images_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_members" ADD CONSTRAINT "zone_members_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_members" ADD CONSTRAINT "zone_members_fire_id_fires_id_fk" FOREIGN KEY ("fire_id") REFERENCES "public"."fires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_members" ADD CONSTRAINT "zone_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_update_images" ADD CONSTRAINT "zone_update_images_update_id_zone_updates_id_fk" FOREIGN KEY ("update_id") REFERENCES "public"."zone_updates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_updates" ADD CONSTRAINT "zone_updates_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_updates" ADD CONSTRAINT "zone_updates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zones" ADD CONSTRAINT "zones_fire_id_fires_id_fk" FOREIGN KEY ("fire_id") REFERENCES "public"."fires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zones" ADD CONSTRAINT "zones_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_blocks_fire_blocked_unique" ON "chat_blocks" USING btree ("fire_id","blocked_user_id");--> statement-breakpoint
CREATE INDEX "chat_blocks_fire_idx" ON "chat_blocks" USING btree ("fire_id");--> statement-breakpoint
CREATE INDEX "chat_fire_idx" ON "chat_messages" USING btree ("fire_id");--> statement-breakpoint
CREATE INDEX "chat_zone_idx" ON "chat_messages" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "chat_created_idx" ON "chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "fire_deactivation_votes_unique" ON "fire_deactivation_votes" USING btree ("fire_id","user_id");--> statement-breakpoint
CREATE INDEX "fire_deactivation_votes_fire_idx" ON "fire_deactivation_votes" USING btree ("fire_id");--> statement-breakpoint
CREATE INDEX "fire_deactivation_votes_user_idx" ON "fire_deactivation_votes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fire_join_token_uses_token_idx" ON "fire_join_token_uses" USING btree ("token_id");--> statement-breakpoint
CREATE INDEX "fire_join_token_uses_user_idx" ON "fire_join_token_uses" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fire_join_tokens_token_unique" ON "fire_join_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "fire_join_tokens_fire_id_idx" ON "fire_join_tokens" USING btree ("fire_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fire_volunteers_fire_user_unique" ON "fire_volunteers" USING btree ("fire_id","user_id");--> statement-breakpoint
CREATE INDEX "fire_volunteers_fire_id_idx" ON "fire_volunteers" USING btree ("fire_id");--> statement-breakpoint
CREATE INDEX "fire_volunteers_user_id_idx" ON "fire_volunteers" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notif_delivery_sub_event_unique" ON "notification_deliveries" USING btree ("subscription_id","event_key");--> statement-breakpoint
CREATE INDEX "notif_delivery_sub_idx" ON "notification_deliveries" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "notif_sub_email_idx" ON "notification_subscriptions" USING btree ("email");--> statement-breakpoint
CREATE INDEX "notif_sub_phone_idx" ON "notification_subscriptions" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "notif_sub_coord_idx" ON "notification_subscriptions" USING btree ("lat","lng");--> statement-breakpoint
CREATE INDEX "zone_gallery_zone_idx" ON "zone_gallery_images" USING btree ("zone_id");--> statement-breakpoint
CREATE UNIQUE INDEX "zone_members_fire_user_unique" ON "zone_members" USING btree ("fire_id","user_id");--> statement-breakpoint
CREATE INDEX "zone_members_zone_id_idx" ON "zone_members" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "zone_members_fire_id_idx" ON "zone_members" USING btree ("fire_id");--> statement-breakpoint
CREATE INDEX "zone_members_user_id_idx" ON "zone_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "zone_update_images_update_idx" ON "zone_update_images" USING btree ("update_id");--> statement-breakpoint
CREATE INDEX "zone_updates_zone_idx" ON "zone_updates" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "zones_fire_id_idx" ON "zones" USING btree ("fire_id");