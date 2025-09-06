import 'dotenv/config';
import { syncFireKnowledge } from '../lib/ai/fire-assistant.js';

const fireId = Number(process.argv[2] || '20');
const res = await syncFireKnowledge(fireId);
console.log(res);
