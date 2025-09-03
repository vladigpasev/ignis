import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  // Vercel/Next Edge излага req.geo
  const g = (req as any).geo;
  let lat: number | null = null;
  let lng: number | null = null;
  let city: string | null = null;

  if (g?.latitude && g?.longitude) {
    lat = Number(g.latitude);
    lng = Number(g.longitude);
    city = g.city || null;
  } else {
    // Алтернативно: x-vercel-ip-latitude/longitude
    const headers = req.headers;
    const hLat = headers.get("x-vercel-ip-latitude");
    const hLng = headers.get("x-vercel-ip-longitude");
    if (hLat && hLng) {
      lat = Number(hLat);
      lng = Number(hLng);
    }
    city = headers.get("x-vercel-ip-city") || null;
  }

  return NextResponse.json({ ok: true, latitude: lat, longitude: lng, city });
}
