import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationSubscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    if (!token || token.length < 8) {
      return new NextResponse('Invalid unsubscribe link', { status: 400 });
    }
    const [row] = await db
      .select()
      .from(notificationSubscriptions)
      .where(eq(notificationSubscriptions.unsubscribeToken, token))
      .limit(1);
    if (!row) return new NextResponse('Subscription not found or already removed.', { status: 404 });

    if (row.active !== 0) {
      await db
        .update(notificationSubscriptions)
        .set({ active: 0, updatedAt: new Date() })
        .where(eq(notificationSubscriptions.id, row.id));
    }

    const html = `<!doctype html>
<html lang="bg">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Абонаментът е прекратен</title>
    <style>
      body{font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; padding: 40px;}
      .box{max-width: 560px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 10px; padding: 24px;}
      h1{font-size: 20px; margin: 0 0 8px;}
      p{color:#4b5563;}
      a{color:#ef4444; text-decoration:none}
    </style>
  </head>
  <body>
    <div class="box">
      <h1>Успешно прекратихте абонамента</h1>
      <p>Няма да получавате повече известия за този абонамент.</p>
      <p><a href="/">Върни се в началото</a></p>
    </div>
  </body>
</html>`;
    return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (e: any) {
    return new NextResponse('Грешка при обработката на абонамента', { status: 500 });
  }
}
