import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const tables = ['zones','zone_members','zone_updates','zone_update_images','chat_messages','chat_blocks','fire_join_token_uses'];
for (const t of tables) {
  const rows = await sql`select to_regclass(${`public.${t}`}) as exists`;
  console.log(t, rows[0].exists);
}
