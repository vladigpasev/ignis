import { db } from "@/lib/db";
import { fires, notificationDeliveries, notificationSubscriptions } from "@/lib/db/schema";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { haversineMeters } from "@/lib/geo";
import { buildReportEmail, buildReportSms, sendEmail, sendSms } from "@/lib/notify";
import { getAppBaseUrl } from "@/lib/env";

function degRadius(lat: number, radiusM: number) {
  const latDeg = radiusM / 111_320;
  const lngDeg = radiusM / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return { latDeg, lngDeg };
}

// FIRMS-based notifications have been removed. Only reported fires are used.

async function alreadyDelivered(subscriptionId: number, eventKey: string) {
  const rows = await db
    .select({ id: notificationDeliveries.id })
    .from(notificationDeliveries)
    .where(and(
      eq(notificationDeliveries.subscriptionId, subscriptionId),
      eq(notificationDeliveries.eventKey, eventKey)
    ))
    .limit(1);
  return rows.length > 0;
}

async function recordDelivery(subscriptionId: number, eventKey: string, meta: any) {
  try {
    await db.insert(notificationDeliveries).values({ subscriptionId, eventKey, meta });
  } catch {
    // unique violation is fine
  }
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

export async function runNotificationsJob({
  onlySubscriptionId,
  limitPerSource = Number.POSITIVE_INFINITY,
  baseUrl = getAppBaseUrl(),
}: {
  onlySubscriptionId?: number,
  limitPerSource?: number,
  baseUrl?: string,
}) {
  const subs = await (async () => {
    if (Number.isFinite(onlySubscriptionId as number)) {
      const [s] = await db.select().from(notificationSubscriptions).where(eq(notificationSubscriptions.id, Number(onlySubscriptionId))).limit(1);
      return s ? [s] : [];
    }
    // Only active subscriptions
    return await db.select().from(notificationSubscriptions).where(eq(notificationSubscriptions.active, 1));
  })();

  let totalCandidates = 0;
  let totalDelivered = 0;

  for (const sub of subs) {
    const radiusM = Math.max(200, Math.min(120_000, (sub.radiusKm || 15) * 1000));
    const { latDeg, lngDeg } = degRadius(sub.lat, radiusM);
    const bbox: [number, number, number, number] = [
      sub.lng - lngDeg,
      sub.lat - latDeg,
      sub.lng + lngDeg,
      sub.lat + latDeg,
    ];

    // Reports (confirmed)
    if ((sub.sourceReports ?? 1) === 1) {
      const rows = await db
        .select()
        .from(fires)
        .where(and(
          gte(fires.lat, bbox[1]),
          lte(fires.lat, bbox[3]),
          gte(fires.lng, bbox[0]),
          lte(fires.lng, bbox[2]),
          eq(fires.status, 'active'),
          // Only notify for fires created after the subscription was created
          gte(fires.createdAt, sub.createdAt as any)
        ))
        .orderBy(desc(fires.createdAt));
      let sent = 0;
      for (const f of rows) {
        const d = haversineMeters({ lat: sub.lat, lng: sub.lng }, { lat: f.lat, lng: f.lng });
        if (d > radiusM) continue;
        const eventKey = `report:${f.id}`;
        totalCandidates++;
        if (await alreadyDelivered(sub.id, eventKey)) continue;

        const unsubscribeUrl = sub.unsubscribeToken ? `${baseUrl}/u/${encodeURIComponent(sub.unsubscribeToken)}` : undefined;
        const { subject, html, text } = buildReportEmail({ lat: f.lat, lng: f.lng, radiusM: f.radiusM, fireId: f.id, baseUrl, unsubscribeUrl });
        const smsMsg = buildReportSms({ lat: f.lat, lng: f.lng, fireId: f.id, baseUrl, unsubscribeUrl });

        let delivered = false;
        if (sub.email) {
          const r = await sendEmail(sub.email, subject, html, text);
          delivered = delivered || r.ok;
        }
        if (sub.phone) {
          const r = await sendSms(sub.phone, smsMsg);
          delivered = delivered || r.ok;
          await sleep(500);
        }
        if (delivered) {
          await recordDelivery(sub.id, eventKey, { source: 'report', fireId: f.id, lat: f.lat, lng: f.lng });
          totalDelivered++;
          sent++;
          if (sent >= limitPerSource) break;
        }
      }
    }
  }

  return { ok: true, totalSubscriptions: subs.length, totalCandidates, totalDelivered };
}
