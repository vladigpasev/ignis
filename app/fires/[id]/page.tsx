import { notFound } from "next/navigation";
import {
  getFireById,
  volunteersForFire,
  myVolunteerStatus,
  claimVolunteer,
  approveVolunteer,
  generateJoinToken,
} from "@/app/actions/fires";
import FireDetailsClient from "./client";

export const runtime = "nodejs";
export const revalidate = 0;

export default async function FireDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fireId = Number(id);
  if (!Number.isFinite(fireId)) notFound();

  const fire = await getFireById(fireId);
  if (!fire) notFound();

  const { confirmed, requested } = await volunteersForFire(fireId);
  const viewerStatus = await myVolunteerStatus(fireId);

  const joinBaseUrl = process.env.APP_BASE_URL || "";

  return (
    <FireDetailsClient
      fire={{
        id: fire.id,
        lat: fire.lat,
        lng: fire.lng,
        radiusM: fire.radiusM,
        status: fire.status,
        createdAt: typeof fire.createdAt === "string" ? fire.createdAt : new Date(fire.createdAt).toISOString(),
      }}
      viewerStatus={viewerStatus}
      initialVolunteers={{
        confirmed: confirmed.map((r) => ({
          ...r,
          createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(r.createdAt as any).toISOString(),
          email: (r as any).email ?? "",
        })),
        requested: requested.map((r) => ({
          ...r,
          createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(r.createdAt as any).toISOString(),
          email: (r as any).email ?? "",
        })),
      }}
      claimAction={claimVolunteer}
      approveAction={approveVolunteer}
      generateTokenAction={generateJoinToken}
      joinBaseUrl={joinBaseUrl}
    />
  );
}
