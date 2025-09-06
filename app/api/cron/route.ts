import { NextResponse } from 'next/server';
import { GET as runNotifications } from '../webhooks/notifications/route';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '';
  if (!process.env.CRON_SECRET || auth !== expected) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Trigger the notifications job directly
  const fakeReq = new Request('http://localhost/api/webhooks/notifications');
  const res = await runNotifications(fakeReq);
  const json = await res.json();
  return NextResponse.json({ ok: true, ran: json });
}

