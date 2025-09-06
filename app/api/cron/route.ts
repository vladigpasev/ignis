import { NextResponse } from 'next/server';
import { runNotificationsJob } from '@/lib/notifications/job';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '';
  if (!process.env.CRON_SECRET || auth !== expected) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const url = new URL(req.url);
  const onlyIdParam = url.searchParams.get('subscriptionId') || url.searchParams.get('id');
  const limitPerSourceParam = url.searchParams.get('limitPerSource');
  const onlySubscriptionId = onlyIdParam ? Number(onlyIdParam) : undefined;
  const limitPerSource = limitPerSourceParam ? Number(limitPerSourceParam) : undefined;

  const result = await runNotificationsJob({
    onlySubscriptionId,
    limitPerSource,
  });
  return NextResponse.json(result);
}
