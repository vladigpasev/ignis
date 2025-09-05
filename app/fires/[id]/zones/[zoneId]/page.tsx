// app/fires/[id]/zones/[zoneId]/page.tsx
import { notFound } from "next/navigation";
import { headers, cookies } from "next/headers";
import ZoneDetailsClient from "./client";
import { myVolunteerStatus } from "@/app/actions/fires";

export const runtime = "nodejs";
export const revalidate = 0;

export default async function ZonePage({
  params,
}: {
  params: Promise<{ id: string; zoneId: string }>;
}) {
  const { id, zoneId } = await params;
  const fireId = Number(id);
  const zId = Number(zoneId);
  if (!Number.isFinite(fireId) || !Number.isFinite(zId)) notFound();

  // Build absolute URL from request headers and forward cookies
  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("host") || "localhost:3000";
  const base = `${proto}://${host}`;
  const ck = await cookies();
  const cookieHeader = ck
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");

  const res = await fetch(`${base}/api/fires/${fireId}/zones/${zId}`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
  const j = await res.json().catch(() => null);
  if (!j?.ok) notFound();

  const viewerStatus = await myVolunteerStatus(fireId);

  return (
    <ZoneDetailsClient
      fireId={fireId}
      zoneId={zId}
      data={j}
      canEdit={viewerStatus === "confirmed"}
    />
  );
}
