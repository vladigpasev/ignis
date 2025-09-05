"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ImageUploader from "@/components/uploads/image-uploader";
import { Users, ArrowRight, CheckCircle2 } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { circlePolygon } from "@/lib/geo";
import { useRouter } from "next/navigation";

type Zone = {
  id: number;
  title?: string | null;
  description?: string | null;
  geomType: "circle" | "polygon";
  centerLat?: number | null;
  centerLng?: number | null;
  radiusM?: number | null;
  polygon?: [number, number][];
  createdAt: string;
  members: number;
  isMember?: boolean;
  coverUrl?: string | null;
};

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const STYLE = "satellite-streets-v12";

/** Генерира статично Mapbox превю с очертанията на зоната */
function buildStaticMapPreview(z: Zone) {
  if (!TOKEN) return null;

  const path = (() => {
    if (z.geomType === "circle" && z.centerLat != null && z.centerLng != null && z.radiusM) {
      const poly = circlePolygon({ lat: z.centerLat, lng: z.centerLng }, z.radiusM, 60).geometry.coordinates[0];
      const pts = poly.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(";");
      return `path-3+dc2626-80(${pts})`;
    }
    const ring = (z.polygon || []).concat([(z.polygon || [])[0] || [0, 0]]);
    const pts = ring.map(([lng, lat]) => `${lng},${lat}`).join(";");
    return `path-3+dc2626-80(${pts})`;
  })();

  const overlay = encodeURIComponent(path);
  // @2x за по-остри изображения; padding=40 дава въздух около очертанията
  const size = "560x260@2x";
  return `https://api.mapbox.com/styles/v1/mapbox/${STYLE}/static/${overlay}/auto/${size}?padding=40&access_token=${TOKEN}`;
}

export default function ZoneList({
  fireId,
  canEdit,
  onChange,
}: {
  fireId: number;
  canEdit: boolean;
  onChange?: () => void;
}) {
  const router = useRouter();
  const [zones, setZones] = useState<Zone[]>([]);
  const [joining, setJoining] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);

  async function load() {
    const res = await fetch(`/api/fires/${fireId}/zones`, { cache: "no-store" }).then((r) => r.json());
    if (res?.ok) setZones(res.zones);
  }
  useEffect(() => {
    load();
  }, [fireId]);

  const sorted = useMemo(() => {
    const arr = [...zones];
    arr.sort((a, b) => {
      if (a.isMember && !b.isMember) return -1;
      if (!a.isMember && b.isMember) return 1;
      // по-новите и/или по-масовите да са по-напред
      const createdDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (createdDiff !== 0) return createdDiff;
      return (b.members ?? 0) - (a.members ?? 0);
    });
    return arr;
  }, [zones]);

  const join = async (zoneId: number) => {
    setJoining(zoneId);
    try {
      const res = await fetch(`/api/fires/${fireId}/zones/${zoneId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join" }),
      }).then((r) => r.json());
      if (!res?.ok) throw new Error(res?.error || "Грешка");
      onChange?.();
      load();
    } catch (e: any) {
      alert(e?.message || "Грешка");
    } finally {
      setJoining(null);
    }
  };

  const leave = async () => {
    setLeaving(true);
    try {
      const res = await fetch(`/api/fires/${fireId}/zones/0/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave" }),
      }).then((r) => r.json());
      if (!res?.ok) throw new Error(res?.error || "Грешка");
      onChange?.();
      load();
    } catch (e: any) {
      alert(e?.message || "Грешка");
    } finally {
      setLeaving(false);
    }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((z) => {
        const preview = z.coverUrl || buildStaticMapPreview(z) || null;

        return (
          <Card
            key={z.id}
            className={[
              "overflow-hidden transition-all duration-200 border",
              z.isMember ? "ring-2 ring-primary/70 border-primary/30 shadow-md" : "hover:shadow-md",
            ].join(" ")}
          >
            {preview ? (
              <div className="p-3 pb-0">
                <AspectRatio ratio={16 / 7}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt={z.title || `Зона #${z.id}`}
                    className="h-full w-full object-cover rounded-lg border"
                  />
                </AspectRatio>
              </div>
            ) : (
              <div className="mx-3 mt-3 h-[160px] rounded-lg border bg-gradient-to-br from-muted to-background" />
            )}

            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="truncate">{z.title || `Зона #${z.id}`}</span>
                <Badge variant={z.isMember ? "default" : "secondary"} className="whitespace-nowrap">
                  <Users className="h-3.5 w-3.5 mr-1" />
                  {z.members}
                </Badge>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              {z.description ? (
                <p className="text-sm text-muted-foreground line-clamp-2">{z.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Няма описание.</p>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {z.isMember ? (
                  <>
                    <Button
                      size="sm"
                      className="group"
                      onClick={() => router.push(`/fires/${fireId}/zones/${z.id}`)}
                    >
                      Още за зоната
                      <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-0.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={leave}
                      disabled={leaving}
                    >
                      {leaving ? "Излизане…" : "Излез от зона"}
                    </Button>
                    <Badge className="ml-auto" variant="outline">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      В зоната
                    </Badge>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => join(z.id)}
                    disabled={joining === z.id}
                    className="w-full sm:w-auto"
                  >
                    {joining === z.id ? "Присъединяване…" : "Влез в зоната"}
                  </Button>
                )}
              </div>

              {canEdit && (
                <div className="pt-3 mt-2 border-t">
                  <div className="text-xs text-muted-foreground mb-1">Галерия — качи снимка (ще стане cover)</div>
                  <ImageUploader
                    prefix={`fires/${fireId}/zones/${z.id}/gallery`}
                    onUploaded={async (f) => {
                      await fetch(`/api/fires/${fireId}/zones/${z.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ addGalleryImage: { url: f.url, key: f.key } }),
                      });
                      await load();
                      onChange?.();
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      {zones.length === 0 && (
        <div className="text-sm text-muted-foreground">Няма зони.</div>
      )}
    </div>
  );
}
