import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const rows = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='fires' AND column_name IN ('last_activity_at','deactivated_at')`;
console.log(rows);
