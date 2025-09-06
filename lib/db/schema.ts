import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  integer,
  index,
  uniqueIndex,
  doublePrecision,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { jsonb } from 'drizzle-orm/pg-core';

// ---------- NOTIFICATIONS (Subscriptions & Deliveries) ----------
export const notificationSubscriptions = pgTable(
  'notification_subscriptions',
  {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 32 }),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    radiusKm: integer('radius_km').notNull().default(15),
    sourceFirms: integer('source_firms').notNull().default(1), // 1=true, 0=false (bool-like)
    sourceReports: integer('source_reports').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: index('notif_sub_email_idx').on(t.email),
    phoneIdx: index('notif_sub_phone_idx').on(t.phone),
    coordIdx: index('notif_sub_coord_idx').on(t.lat, t.lng),
  })
);

export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: serial('id').primaryKey(),
    subscriptionId: integer('subscription_id').notNull().references(() => notificationSubscriptions.id, { onDelete: 'cascade' }),
    eventKey: varchar('event_key', { length: 256 }).notNull(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }).defaultNow().notNull(),
    meta: jsonb('meta'),
  },
  (t) => ({
    uniqueDelivery: uniqueIndex('notif_delivery_sub_event_unique').on(t.subscriptionId, t.eventKey),
    subIdx: index('notif_delivery_sub_idx').on(t.subscriptionId),
  })
);

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    name: text('name'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    emailUnique: uniqueIndex('users_email_unique').on(t.email),
    createdAtIdx: index('users_created_at_idx').on(t.createdAt),
  }),
);

export const sessions = pgTable(
  'sessions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionToken: text('session_token').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    tokenUnique: uniqueIndex('sessions_token_unique').on(t.sessionToken),
    userIdIdx: index('sessions_user_id_idx').on(t.userId),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  fires: many(fires), // свързваме fires->users по-долу
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// ---------- NEW: Fires ----------
export const fires = pgTable(
  'fires',
  {
    id: serial('id').primaryKey(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    radiusM: integer('radius_m').notNull(),
    status: varchar('status', { length: 16 }).notNull().default('active'),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow().notNull(),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
  },
  (t) => ({
    createdAtIdx: index('fires_created_at_idx').on(t.createdAt),
    coordsIdx: index('fires_coords_idx').on(t.lat, t.lng),
  })
);

export const firesRelations = relations(fires, ({ one }) => ({
  creator: one(users, {
    fields: [fires.createdBy],
    references: [users.id],
  }),
}));

export type Fire = {
  id: number;
  lat: number;
  lng: number;
  radiusM: number;
  status: string;
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  deactivatedAt: Date | null;
};

// ---------- NEW: Volunteers ----------
export const fireVolunteers = pgTable(
  'fire_volunteers',
  {
    id: serial('id').primaryKey(),
    fireId: integer('fire_id').notNull().references(() => fires.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 16 }).notNull().$type<'requested' | 'confirmed'>().default('requested'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqueFireUser: uniqueIndex('fire_volunteers_fire_user_unique').on(t.fireId, t.userId),
    fireIdIdx: index('fire_volunteers_fire_id_idx').on(t.fireId),
    userIdIdx: index('fire_volunteers_user_id_idx').on(t.userId),
  })
);

export const fireVolunteersRelations = relations(fireVolunteers, ({ one }) => ({
  fire: one(fires, { fields: [fireVolunteers.fireId], references: [fires.id] }),
  user: one(users, { fields: [fireVolunteers.userId], references: [users.id] }),
}));

export const fireJoinTokens = pgTable(
  'fire_join_tokens',
  {
    id: serial('id').primaryKey(),
    fireId: integer('fire_id').notNull().references(() => fires.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 128 }).notNull(),
    createdBy: integer('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => ({
    tokenUnique: uniqueIndex('fire_join_tokens_token_unique').on(t.token),
    fireIdIdx: index('fire_join_tokens_fire_id_idx').on(t.fireId),
  })
);

export type FireVolunteer = {
  id: number;
  fireId: number;
  userId: number;
  status: 'requested' | 'confirmed';
  createdAt: Date;
  updatedAt: Date;
};

export type FireJoinToken = {
  id: number;
  fireId: number;
  token: string;
  createdBy: number;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};

// ---------- ZONES ----------
export const zones = pgTable(
  'zones',
  {
    id: serial('id').primaryKey(),
    fireId: integer('fire_id').notNull().references(() => fires.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 120 }),
    description: text('description'),
    geomType: varchar('geom_type', { length: 10 }).notNull(), // 'circle' | 'polygon'
    centerLat: doublePrecision('center_lat'),
    centerLng: doublePrecision('center_lng'),
    radiusM: integer('radius_m'),
    polygon: jsonb('polygon'),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    fireIdx: index('zones_fire_id_idx').on(t.fireId),
  })
);

export const zoneMembers = pgTable(
  'zone_members',
  {
    id: serial('id').primaryKey(),
    zoneId: integer('zone_id').notNull().references(() => zones.id, { onDelete: 'cascade' }),
    fireId: integer('fire_id').notNull().references(() => fires.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    oneZonePerFirePerUser: uniqueIndex('zone_members_fire_user_unique').on(t.fireId, t.userId),
    zoneIdx: index('zone_members_zone_id_idx').on(t.zoneId),
    fireIdx: index('zone_members_fire_id_idx').on(t.fireId),
    userIdx: index('zone_members_user_id_idx').on(t.userId),
  })
);

export const zoneGalleryImages = pgTable(
  'zone_gallery_images',
  {
    id: serial('id').primaryKey(),
    zoneId: integer('zone_id').notNull().references(() => zones.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    s3Key: varchar('s3_key', { length: 256 }).notNull(),
    url: text('url').notNull(),
    width: integer('width'),
    height: integer('height'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    zoneIdx: index('zone_gallery_zone_idx').on(t.zoneId),
  })
);

export const zoneUpdates = pgTable(
  'zone_updates',
  {
    id: serial('id').primaryKey(),
    zoneId: integer('zone_id').notNull().references(() => zones.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    text: text('text'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    zoneIdx: index('zone_updates_zone_idx').on(t.zoneId),
  })
);

export const zoneUpdateImages = pgTable(
  'zone_update_images',
  {
    id: serial('id').primaryKey(),
    updateId: integer('update_id').notNull().references(() => zoneUpdates.id, { onDelete: 'cascade' }),
    s3Key: varchar('s3_key', { length: 256 }).notNull(),
    url: text('url').notNull(),
    width: integer('width'),
    height: integer('height'),
  },
  (t) => ({
    updIdx: index('zone_update_images_update_idx').on(t.updateId),
  })
);

// ---------- CHATS ----------
export const chatMessages = pgTable(
  'chat_messages',
  {
    id: serial('id').primaryKey(),
    fireId: integer('fire_id').notNull().references(() => fires.id, { onDelete: 'cascade' }),
    zoneId: integer('zone_id').references(() => zones.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    message: text('message').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    fireIdx: index('chat_fire_idx').on(t.fireId),
    zoneIdx: index('chat_zone_idx').on(t.zoneId),
    createdIdx: index('chat_created_idx').on(t.createdAt),
  })
);

export const chatBlocks = pgTable(
  'chat_blocks',
  {
    id: serial('id').primaryKey(),
    fireId: integer('fire_id').notNull().references(() => fires.id, { onDelete: 'cascade' }),
    blockedUserId: integer('blocked_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    blockedByUserId: integer('blocked_by_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqueBlock: uniqueIndex('chat_blocks_fire_blocked_unique').on(t.fireId, t.blockedUserId),
    fireIdx: index('chat_blocks_fire_idx').on(t.fireId),
  })
);

// ---------- QR token uses ----------
export const fireJoinTokenUses = pgTable(
  'fire_join_token_uses',
  {
    id: serial('id').primaryKey(),
    tokenId: integer('token_id').notNull().references(() => fireJoinTokens.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    usedAt: timestamp('used_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tokenIdx: index('fire_join_token_uses_token_idx').on(t.tokenId),
    userIdx: index('fire_join_token_uses_user_idx').on(t.userId),
  })
);

// ---------- Fire Deactivation Votes ----------
export const fireDeactivationVotes = pgTable(
  'fire_deactivation_votes',
  {
    id: serial('id').primaryKey(),
    fireId: integer('fire_id').notNull().references(() => fires.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqueVote: uniqueIndex('fire_deactivation_votes_unique').on(t.fireId, t.userId),
    fireIdx: index('fire_deactivation_votes_fire_idx').on(t.fireId),
    userIdx: index('fire_deactivation_votes_user_idx').on(t.userId),
  })
);
