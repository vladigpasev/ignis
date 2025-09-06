import { db } from "@/lib/db";
import { fires, notificationDeliveries, notificationSubscriptions } from "@/lib/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { haversineMeters } from "@/lib/geo";
import { buildReportEmail, buildReportSms, sendEmail, sendSms } from "@/lib/notify";

const DEFAULT_BASE_URL = process.env.APP_BASE_URL || 'https://firelinks.org';

function degRadius(lat: number, radiusM: number) {
  const latDeg = radiusM / 111_320;
  const lngDeg = radiusM / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return { latDeg, lngDeg };
}

async function fetchFirms(bbox: [number, number, number, number], baseUrl = DEFAULT_BASE_URL) {
  const [w, s, e, n] = bbox;
  const url = `${baseUrl}/api/firms?bbox=${w},${s},${e},${n}&days=1&minConfidence=35&dedupRadiusM=600&clusterRadiusM=650`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`FIRMS fetch ${res.status} ${res.statusText} ${txt?.slice(0,180)}`);
  }
  const data = await res.json();
  return Array.isArray(data?.hotspots) ? data.hotspots : [];
}

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
  limitPerSource = 3,
  baseUrl = DEFAULT_BASE_URL,
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
    return await db.select().from(notificationSubscriptions);
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
          eq(fires.status, 'active')
        ));
      let sent = 0;
      for (const f of rows) {
        const d = haversineMeters({ lat: sub.lat, lng: sub.lng }, { lat: f.lat, lng: f.lng });
        if (d > radiusM) continue;
        const eventKey = `report:${f.id}`;
        totalCandidates++;
        if (await alreadyDelivered(sub.id, eventKey)) continue;

        const { subject, html, text } = buildReportEmail({ lat: f.lat, lng: f.lng, radiusM: f.radiusM, fireId: f.id, baseUrl });
        const smsMsg = buildReportSms({ lat: f.lat, lng: f.lng, fireId: f.id, baseUrl });

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

    // FIRMS (unconfirmed)
    if ((sub.sourceFirms ?? 1) === 1) {
      let sent = 0;
      try {
        const hotspots = await fetchFirms(bbox, baseUrl);
        for (const h of hotspots) {
          const d = haversineMeters({ lat: sub.lat, lng: sub.lng }, { lat: h.lat, lng: h.lng });
          if (d > radiusM) continue;
          // Stable dedupe key for FIRMS: quantized cell (no time bucket)
          const qLat = Math.round(h.lat * 50) / 50; // ~0.02° ≈ 2.2 km
          const qLng = Math.round(h.lng * 50) / 50;
          const ts = h.acquiredAt ? Date.parse(h.acquiredAt) : NaN;
          const bucket6h = Number.isFinite(ts) ? Math.floor(ts / (6 * 3600 * 1000)) : undefined;
          // Previously we used a 6h time bucket which could resend
          // multiple notifications for the same location across runs.
          // Now we drop the time bucket so each location notifies once.
          const eventKey = `firms:${qLat.toFixed(2)},${qLng.toFixed(2)}`;
          totalCandidates++;
          if (await alreadyDelivered(sub.id, eventKey)) continue;

          const { subject, html, text } = buildReportEmail({ lat: h.lat, lng: h.lng, radiusM: h.radiusM, baseUrl });
          const smsMsg = buildReportSms({ lat: h.lat, lng: h.lng, baseUrl });

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
            await recordDelivery(sub.id, eventKey, { source: 'firms', lat: h.lat, lng: h.lng });
            totalDelivered++;
            sent++;
            if (sent >= limitPerSource) break;
          }
        }
      } catch (e) {
        console.warn('[notifications job] FIRMS fetch failed', (e as any)?.message);
      }
    }
  }

  return { ok: true, totalSubscriptions: subs.length, totalCandidates, totalDelivered };
}
