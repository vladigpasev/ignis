import 'dotenv/config';
import { drizzle } from 'drizzle-orm/neon-http';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const db = drizzle(process.env.DATABASE_URL);
const result = await db.execute('select 1');
console.log(result);

