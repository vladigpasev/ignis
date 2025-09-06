import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
try {
  const rows = await sql`select * from drizzle.__drizzle_migrations order by id`;
  console.log(rows);
} catch (e) {
  console.error('Failed to read migrations table:', e?.message || e);
}
