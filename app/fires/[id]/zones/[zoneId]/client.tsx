// app/fires/[id]/zones/[zoneId]/client.tsx
"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Users, ArrowLeft, Image as ImageIcon } from "lucide-react";
import { circlePolygon } from "@/lib/geo";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const STYLE = "satellite-streets-v12";

function buildStaticMapPreview(z: any) {
  if (!TOKEN) return null;
  const path = (() => {
    if (z.geomType === "circle" && z.centerLat != null && z.centerLng != null && z.radiusM) {
      const poly = circlePolygon({ lat: z.centerLat, lng: z.centerLng }, z.radiusM, 60).geometry.coordinates[0];
      const pts = poly.map(([lng, lat]: [number, number]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(";");
      return `path-3+dc2626-80(${pts})`;
    }
    const ring = (z.polygon || []).concat([(z.polygon || [])[0] || [0, 0]]);
    const pts = ring.map(([lng, lat]: [number, number]) => `${lng},${lat}`).join(";");
    return `path-3+dc2626-80(${pts})`;
  })();

  const overlay = encodeURIComponent(path);
  const size = "1200x500@2x";
  return `https://api.mapbox.com/styles/v1/mapbox/${STYLE}/static/${overlay}/auto/${size}?padding=60&access_token=${TOKEN}`;
}

export default function ZoneDetailsClient({
  fireId,
  zoneId,
  data,
  canEdit,
}: {
  fireId: number;
  zoneId: number;
  data: {
    ok: true;
    zone: any;
    members: { userId: number; name: string | null; email: string; joinedAt: string }[];
    gallery: { id: number; url: string }[];
    updates: { id: number; text: string | null; createdAt: string; userId: number; name: string | null; email: string; images: any[] }[];
  };
  canEdit: boolean;
}) {
  const z = data.zone;
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const join = async () => {
    setJoining(true);
    try {
      const res = await fetch(`/api/fires/${fireId}/zones/${zoneId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join" }),
      }).then((r) => r.json());
      if (!res?.ok) throw new Error(res?.error || "Грешка");
      location.reload();
    } catch (e: any) {
      alert(e?.message || "Грешка");
    } finally {
      setJoining(false);
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
      location.href = `/fires/${fireId}`;
    } catch (e: any) {
      alert(e?.message || "Грешка");
    } finally {
      setLeaving(false);
    }
  };

  const cover = data.gallery?.[0]?.url || buildStaticMapPreview(z);

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-6">
      <div className="mb-4">
        <a href={`/fires/${fireId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Назад към пожара
        </a>
      </div>

      <Card className="overflow-hidden">
        {cover ? (
          <AspectRatio ratio={16 / 6}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt={z.title || `Зона #${z.id}`} className="w-full h-full object-cover" />
          </AspectRatio>
        ) : (
          <div className="h-[280px] bg-gradient-to-br from-muted to-background flex items-center justify-center text-muted-foreground">
            <ImageIcon className="h-8 w-8 mr-2" /> Няма изображение
          </div>
        )}

        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{z.title || `Зона #${z.id}`}</span>
            <Badge variant="secondary" className="whitespace-nowrap">
              <Users className="h-3.5 w-3.5 mr-1" />
              {data.members.length} член(а)
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {z.description ? (
            <p className="text-muted-foreground">{z.description}</p>
          ) : (
            <p className="text-muted-foreground italic">Няма описание.</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={join} disabled={joining}> {joining ? "Присъединяване…" : "Влез в зоната"} </Button>
            <Button variant="outline" onClick={leave} disabled={leaving}> {leaving ? "Излизане…" : "Излез от зона"} </Button>
          </div>

          <Separator />

          <div className="grid gap-3">
            <div className="text-sm font-medium">Галерия</div>
            {data.gallery.length === 0 ? (
              <div className="text-sm text-muted-foreground">Няма снимки.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {data.gallery.map((g) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={g.id} src={g.url} alt="" className="w-full h-[140px] object-cover rounded-md border" />
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div className="grid gap-2">
            <div className="text-sm font-medium">Членове</div>
            {data.members.length === 0 ? (
              <div className="text-sm text-muted-foreground">Няма членове.</div>
            ) : (
              <ul className="grid sm:grid-cols-2 gap-2">
                {data.members.map((m) => (
                  <li key={m.userId} className="text-sm">
                    <span className="font-medium">{m.name || m.email}</span>
                    <span className="text-muted-foreground"> — от {new Date(m.joinedAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Separator />

          <div className="grid gap-2">
            <div className="text-sm font-medium">Обновления</div>
            {data.updates.length === 0 ? (
              <div className="text-sm text-muted-foreground">Няма обновления.</div>
            ) : (
              <ul className="space-y-3">
                {data.updates.map((u) => (
                  <li key={u.id} className="text-sm">
                    <div className="font-medium">{u.name || u.email}</div>
                    {u.text && <div className="text-muted-foreground">{u.text}</div>}
                    {u.images?.length > 0 && (
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {u.images.map((im: any) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={im.id} src={im.url} alt="" className="h-[120px] w-full object-cover rounded-md border" />
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">{new Date(u.createdAt).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

