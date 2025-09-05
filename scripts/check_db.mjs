import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('No DATABASE_URL');
  process.exit(1);
}

const sql = neon(url);
const rows = await sql`select tablename from pg_tables where schemaname = 'public' order by tablename`;
console.log('Tables:', rows.map(r => r.tablename));

const existsZones = await sql`select to_regclass('public.zones') as reg`;
console.log('public.zones:', existsZones[0].reg);

