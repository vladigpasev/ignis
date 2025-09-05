import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('No DATABASE_URL');
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/apply_sql.mjs drizzle/0003_fire_zones_and_chat.sql');
  process.exit(1);
}
const sqlText = fs.readFileSync(path.resolve(file), 'utf8');

const statements = sqlText
  .split(/;\s*\n/)
  .map((s) => s.replace(/^(?:\s*--.*\n)+/g, '').trim())
  .filter((s) => s.length > 0);

const sql = neon(url);
for (const stmt of statements) {
  try {
    await sql.query(stmt);
    console.log('OK:', stmt.slice(0, 80).replace(/\s+/g, ' ') + '...');
  } catch (e) {
    console.error('ERR:', stmt.slice(0, 80).replace(/\s+/g, ' ') + '...', e.message);
  }
}

console.log('Done.');
