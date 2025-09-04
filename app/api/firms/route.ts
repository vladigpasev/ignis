import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fires } from "@/lib/db/schema";
import { and, gte, lte, eq } from "drizzle-orm";
import { haversineMeters } from "@/lib/geo";

export type Hotspot = {
  id: string;
  lat: number;
  lng: number;
  source: string;
  satellite?: string;
  instrument?: string;
  brightness?: number;
  frp?: number;
  confidence?: number;        // normalized 0..100 where possible
  confidenceRaw?: string;     // original (e.g., "l/m/h" or numeric as string)
  daynight?: string;          // "D"|"N"
  acquiredAt?: string;        // ISO string in UTC (best effort from acq_date+acq_time)
  radiusM: number;
  // --- нови (за клъстеризация) ---
  count?: number;             // брой точки в кластер
  sources?: string[];         // уникални източници в клъстера
  firstSeenAt?: string;       // най-ранен acquiredAt в клъстера
  lastSeenAt?: string;        // най-късен acquiredAt в клъстера
  frpTotal?: number;          // Σ FRP за клъстера
};

// Force Node.js runtime to avoid Edge limitations for external fetch
export const runtime = "nodejs";

const DEFAULT_SOURCES = [
  "VIIRS_NOAA21_NRT",
  "VIIRS_NOAA20_NRT",
  "VIIRS_SNPP_NRT",
];

const MAX_DAYS = 3;
const DEFAULT_DAYS = 2;

// === CSV helpers ===
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).filter((l) => l.trim().length > 0);

  return rows.map((line) => {
    const cols = splitCsvLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] ?? "").trim();
    });
    return obj;
  });
}

function toNumber(x?: string) {
  if (!x) return undefined;
  const n = Number(x);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeConfidence(raw?: string) {
  if (!raw) return { num: undefined, raw: undefined } as const;
  const v = raw.trim().toLowerCase();
  const asNum = Number(v);
  if (Number.isFinite(asNum)) return { num: asNum, raw } as const;
  if (v === "l" || v === "low") return { num: 15, raw } as const;
  if (v === "n" || v === "nominal") return { num: 50, raw } as const;
  if (v === "h" || v === "high") return { num: 85, raw } as const;
  return { num: undefined, raw } as const;
}

function estimateRadiusM(frp?: number, brightness?: number) {
  const base = 200;
  const frpBoost = frp ? 18 * Math.sqrt(Math.max(0, frp)) : 0;
  const bBoost = brightness ? 0.6 * Math.max(0, brightness - 300) : 0;
  return Math.max(150, Math.min(1200, Math.round(base + frpBoost + bBoost)));
}

function toIsoFromDateTime(date?: string, time?: string) {
  if (!date) return undefined;
  const t = (time ?? "").padStart(4, "0");
  const hh = t.slice(0, 2);
  const mm = t.slice(2, 4);
  return `${date}T${hh || "00"}:${mm || "00"}:00Z`;
}

async function fetchWithTimeout(url: string, opts: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 12000, ...init } = opts;
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Accept": "text/csv",
        "User-Agent": "ignis-app/1.0 (+https://example.com)",
        ...(init.headers || {}),
      },
      signal: ac.signal,
      cache: "no-store",
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// === Клъстеризация по близост (жаден, FRP‑теглов центроид) ===
function clusterHotspots(
  points: Hotspot[],
  clusterRadiusM: number,
  centerLat: number
): Hotspot[] {
  if (points.length <= 1) return points.slice();

  const clusters: {
    lat: number;
    lng: number;
    sumW: number;
    sumLatW: number;
    sumLngW: number;
    items: Hotspot[];
  }[] = [];

  for (const p of points) {
    const w = 1 + (p.frp ?? 0); // FRP да влияе, но да не доминира изцяло
    let best = -1;
    let bestD = Infinity;

    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[i];
      const d = haversineMeters({ lat: c.lat, lng: c.lng }, { lat: p.lat, lng: p.lng });
      if (d <= clusterRadiusM && d < bestD) {
        best = i;
        bestD = d;
      }
    }

    if (best >= 0) {
      const c = clusters[best];
      c.items.push(p);
      c.sumW += w;
      c.sumLatW += p.lat * w;
      c.sumLngW += p.lng * w;
      c.lat = c.sumLatW / c.sumW;
      c.lng = c.sumLngW / c.sumW;
    } else {
      clusters.push({
        lat: p.lat,
        lng: p.lng,
        sumW: w,
        sumLatW: p.lat * w,
        sumLngW: p.lng * w,
        items: [p],
      });
    }
  }

  // Финализиране: изчисляваме радиус и обобщени атрибути
  const out: Hotspot[] = clusters.map((c, idx) => {
    const lat = c.lat;
    const lng = c.lng;

    let maxItemRadius = 0;
    let dMax = 0;
    let frpTotal = 0;
    let brightnessSum = 0;
    let brightnessCount = 0;
    let confSum = 0;
    let confCount = 0;
    const sourcesSet = new Set<string>();
    let firstSeen: string | undefined;
    let lastSeen: string | undefined;

    for (const it of c.items) {
      maxItemRadius = Math.max(maxItemRadius, it.radiusM || 0);
      const d = haversineMeters({ lat, lng }, { lat: it.lat, lng: it.lng });
      if (d > dMax) dMax = d;

      if (typeof it.frp === "number") frpTotal += it.frp;
      if (typeof it.brightness === "number") {
        brightnessSum += it.brightness;
        brightnessCount++;
      }
      if (typeof it.confidence === "number") {
        confSum += it.confidence;
        confCount++;
      }
      if (it.source) sourcesSet.add(it.source);

      const t = it.acquiredAt ? new Date(it.acquiredAt).getTime() : undefined;
      if (typeof t === "number" && Number.isFinite(t)) {
        if (!firstSeen || t < new Date(firstSeen).getTime()) firstSeen = it.acquiredAt!;
        if (!lastSeen || t > new Date(lastSeen).getTime()) lastSeen = it.acquiredAt!;
      }
    }

    const coverRadius = Math.max(maxItemRadius, Math.round(dMax + 180));
    const radiusM = Math.max(200, Math.min(2000, coverRadius));
    const brightnessAvg = brightnessCount ? brightnessSum / brightnessCount : undefined;
    const confidenceAvg = confCount ? confSum / confCount : undefined;

    // Стабилен, но кратък ID (епемерален е достатъчно)
    const id = `cluster:${lat.toFixed(4)},${lng.toFixed(4)}:${c.items.length}`;

    return {
      id,
      lat,
      lng,
      source: "FIRMS_CLUSTER",
      sources: Array.from(sourcesSet),
      satellite: undefined,
      instrument: undefined,
      brightness: brightnessAvg,
      frp: frpTotal || undefined,      // за удобство пазим Σ във frp
      frpTotal: frpTotal || undefined, // и явно поле Σ FRP
      confidence: confidenceAvg,
      confidenceRaw: undefined,
      daynight: undefined,
      acquiredAt: lastSeen,             // показваме най-късното като "основно" време
      firstSeenAt: firstSeen,
      lastSeenAt: lastSeen,
      radiusM,
      count: c.items.length,
    };
  });

  return out;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const bboxStr = url.searchParams.get("bbox"); // west,south,east,north

    const dedupRadiusM = Math.min(Math.max(Number(url.searchParams.get("dedupRadiusM")) || 500, 100), 2000);
    const minConfidence = Math.max(0, Math.min(100, Number(url.searchParams.get("minConfidence")) || 0));
    const daysParam = Number(url.searchParams.get("days"));
    const days = Math.max(1, Math.min(MAX_DAYS, Number.isFinite(daysParam) ? daysParam : DEFAULT_DAYS));

    // ново: радиус за клъстер
    const clusterRadiusM = Math.min(Math.max(Number(url.searchParams.get("clusterRadiusM")) || 650, 200), 2000);

    const sourcesParam = url.searchParams.get("sources");
    const sources = (sourcesParam
      ? sourcesParam.split(",").map((s) => s.trim()).filter(Boolean)
      : DEFAULT_SOURCES.slice()) as string[];

    const MAP_KEY =
      process.env.FIRMS_MAP_KEY ||
      process.env.FIRMS_API_KEY ||
      process.env.NASA_FIRMS_MAP_KEY;

    if (!MAP_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing FIRMS_MAP_KEY in environment." },
        { status: 500 }
      );
    }

    let area = "-180,-90,180,90";
    let centerLat = 0;

    if (bboxStr) {
      const parts = bboxStr.split(",").map((v) => Number(v.trim()));
      if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
        return NextResponse.json(
          { ok: false, error: "Invalid bbox parameter. Expected 'west,south,east,north'." },
          { status: 400 }
        );
      }
      const [w, s, e, n] = parts;
      area = `${w},${s},${e},${n}`;
      centerLat = (s + n) / 2;
    }

    // 1) Вземаме FIRMS CSV за всяка source
    const base = "https://firms.modaps.eosdis.nasa.gov/api/area/csv";
    const fetches = sources.map(async (source) => {
      const u = `${base}/${MAP_KEY}/${source}/${area}/${days}`;
      let lastErr: any = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const r = await fetchWithTimeout(u, { timeoutMs: 12000 });
          if (!r.ok) {
            const txt = await r.text().catch(() => "");
            throw new Error(`FIRMS ${source} ${r.status} ${r.statusText} ${txt?.slice(0, 220)}`);
          }
          const text = await r.text();
          const rows = parseCsv(text);

          const list: Hotspot[] = rows.map((row, idx) => {
            const lat = toNumber(row["latitude"]);
            const lng = toNumber(row["longitude"]);

            const brightness = toNumber(row["bright_ti4"] ?? row["brightness"] ?? row["brightness_ti4"]);
            const frp = toNumber(row["frp"]);
            const sat = row["satellite"] || row["sat"] || undefined;
            const instr = row["instrument"] || undefined;
            const { num: confNum, raw: confRaw } = normalizeConfidence(row["confidence"] || row["confidence_text"]);
            const daynight = row["daynight"] || row["day_night"] || undefined;
            const acquiredAt = toIsoFromDateTime(row["acq_date"], row["acq_time"]);

            const radiusM = estimateRadiusM(frp, brightness);
            const id = `${source}:${lat?.toFixed(4)},${lng?.toFixed(4)}:${row["acq_date"] ?? ""}:${row["acq_time"] ?? ""}:${idx}`;

            return {
              id,
              lat: lat ?? 0,
              lng: lng ?? 0,
              source,
              satellite: sat,
              instrument: instr,
              brightness: brightness,
              frp: frp,
              confidence: confNum,
              confidenceRaw: confRaw,
              daynight,
              acquiredAt,
              radiusM,
            };
          }).filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng));

          return list;
        } catch (e) {
          lastErr = e;
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      throw lastErr ?? new Error(`FIRMS fetch failed for ${source}`);
    });

    // 2) Толерираме частични грешки между източници
    const settled = await Promise.allSettled(fetches);
    const successes = settled.filter((s): s is PromiseFulfilledResult<Hotspot[]> => s.status === "fulfilled");
    const failures = settled.filter((s): s is PromiseRejectedResult => s.status === "rejected");
    if (successes.length === 0) {
      const reason = failures.map((f) => String(f.reason?.message || f.reason)).join(" | ") || "fetch failed";
      return NextResponse.json({ ok: false, error: reason }, { status: 502 });
    }
    let hotspots: Hotspot[] = successes.flatMap((s) => s.value);

    // 3) Филтър по confidence (ако е указан)
    if (minConfidence > 0) {
      hotspots = hotspots.filter((h) => (typeof h.confidence === "number" ? h.confidence >= minConfidence : true));
    }

    // 4) Премахваме FIRMS точки до активни докладвани пожари (dedup срещу БД)
    if (bboxStr) {
      const [w, s, e, n] = bboxStr.split(",").map((v) => Number(v.trim()));
      const radLatDeg = dedupRadiusM / 111_320;
      const radLngDeg = dedupRadiusM / (111_320 * Math.max(0.2, Math.cos((centerLat * Math.PI) / 180)));

      const rows = await db
        .select()
        .from(fires)
        .where(
          and(
            gte(fires.lat, s - radLatDeg),
            lte(fires.lat, n + radLatDeg),
            gte(fires.lng, w - radLngDeg),
            lte(fires.lng, e + radLngDeg),
            eq(fires.status, "active"),
          ),
        );

      hotspots = hotspots.filter((h) => {
        for (const f of rows) {
          const d = haversineMeters({ lat: h.lat, lng: h.lng }, { lat: f.lat, lng: f.lng });
          if (d <= dedupRadiusM) return false;
        }
        return true;
      });
    }

    // 5) Клъстеризация по близост → една група = един кръг с по-голям радиус
    if (hotspots.length > 1) {
      hotspots = clusterHotspots(hotspots, clusterRadiusM, centerLat);
    }

    // 6) Ограничение на резултати за безопасност
    if (hotspots.length > 1500) hotspots = hotspots.slice(0, 1500);

    return NextResponse.json({
      ok: true,
      hotspots,
      meta: { sources, days, dedupRadiusM, minConfidence, clusterRadiusM },
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
