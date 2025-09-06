import 'dotenv/config';
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function main() {
  const asst = await client.beta.assistants.create({
    name: 'Test Assistant',
    model: process.env.OPENAI_MODEL || 'gpt-5-mini',
    instructions: 'Отговаряй сбито на български.'
  });
  const thread = await client.beta.threads.create();
  await client.beta.threads.messages.create(thread.id, { role: 'user', content: 'Здравей, колко е 2+2?' });
  let run = await client.beta.threads.runs.create(thread.id, { assistant_id: asst.id });
  for (let i = 0; i < 20; i++) {
    run = await client.beta.threads.runs.retrieve(thread.id, run.id);
    if (run.status === 'completed') break;
    if (['failed','cancelled','expired'].includes(run.status)) throw new Error('Run '+run.status);
    await new Promise(r => setTimeout(r, 700));
  }
  const msgs = await client.beta.threads.messages.list(thread.id, { order: 'desc', limit: 5 });
  let answer = '';
  for (const m of msgs.data) {
    if (m.role !== 'assistant') continue;
    for (const pc of m.content) if (pc.type === 'text') answer += pc.text.value;
  }
  console.log('Assistant says:', answer.trim());
}

main().catch(e => { console.error('Failed:', e?.message || e); process.exit(1); });
