import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

declare global {
  // eslint-disable-next-line no-var
  var __drizzleDb__: ReturnType<typeof drizzle> | undefined;
}

export const db = globalThis.__drizzleDb__ ?? drizzle(DATABASE_URL, { schema });
if (process.env.NODE_ENV !== 'production') globalThis.__drizzleDb__ = db;

export type DB = typeof db;

