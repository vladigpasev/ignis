"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ImageUploader from "@/components/uploads/image-uploader";

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
};

export default function ZoneList({
  fireId,
  canEdit,
  onChange,
}: {
  fireId: number;
  canEdit: boolean;
  onChange?: () => void;
}) {
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
    <div className="grid gap-3">
      {zones.map((z) => (
        <Card key={z.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{z.title || `Зона #${z.id}`}</span>
              <span className="text-sm text-muted-foreground">Членове: {z.members}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {z.description && <p className="text-sm text-muted-foreground">{z.description}</p>}

            <div className="flex gap-2">
              <Button size="sm" onClick={() => join(z.id)} disabled={joining === z.id}>
                {joining === z.id ? "Присъединяване…" : "Влез в зоната"}
              </Button>
              <Button size="sm" variant="outline" onClick={leave} disabled={leaving}>
                {leaving ? "Излизане…" : "Излез от зона"}
              </Button>
            </div>

            {canEdit && (
              <div className="pt-2 border-t">
                <div className="text-xs text-muted-foreground mb-1">Галерия</div>
                <ImageUploader
                  prefix={`fires/${fireId}/zones/${z.id}/gallery`}
                  onUploaded={async (f) => {
                    await fetch(`/api/fires/${fireId}/zones/${z.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ addGalleryImage: { url: f.url, key: f.key } }),
                    });
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      {zones.length === 0 && <div className="text-sm text-muted-foreground">Няма зони.</div>}
    </div>
  );
}

