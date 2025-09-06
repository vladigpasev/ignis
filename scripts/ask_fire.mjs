import 'dotenv/config';
import { db } from '../lib/db/index.js';
import { users } from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';
import { askFireAssistant } from '../lib/ai/fire-assistant.js';

const email = 'codex+test@ignis.local';
const name = 'Codex Tester';

async function ensureUser() {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (rows.length) return rows[0];
  const [created] = await db.insert(users).values({ email, name }).returning();
  return created;
}

const fireId = Number(process.argv[2] || '20');
const q = process.argv.slice(3).join(' ') || 'В коя зона е най-нужно още един доброволец и защо?';

const me = await ensureUser();
const res = await askFireAssistant({ fireId, userId: me.id, message: q });
console.log('\nAnswer:\n', res.answer);
