import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`select id, lat, lng, radius_m, status from fires order by id desc limit 3`;
console.log(rows);
