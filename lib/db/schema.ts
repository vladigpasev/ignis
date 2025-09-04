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
