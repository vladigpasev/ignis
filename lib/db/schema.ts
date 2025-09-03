import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  integer,
  index,
  uniqueIndex,
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

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));

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

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

