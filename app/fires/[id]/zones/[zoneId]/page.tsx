// app/fires/[id]/zones/[zoneId]/page.tsx
import { notFound } from "next/navigation";
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

  const base = process.env.APP_BASE_URL || "";
  const res = await fetch(`${base}/api/fires/${fireId}/zones/${zId}`, { cache: "no-store" });
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

