"use client";

import { metersToReadable } from "@/lib/geo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useMap } from "@/context/map-context";

export type FireListItem = {
  id: number;
  lat: number;
  lng: number;
  radiusM: number;
  status: string;
  createdAt: string;
  distanceM?: number;
  volunteersConfirmed?: number;
  volunteersRequested?: number;
};

function timeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "преди секунди";
  const min = Math.round(sec / 60);
  if (min < 60) return `преди ${min} мин`;
  const h = Math.round(min / 60);
  if (h < 24) return `преди ${h} ч`;
  const d = Math.round(h / 24);
  return `преди ${d} д`;
}

export default function FireList({
  fires,
  onFocus,
}: {
  fires: FireListItem[];
  onFocus?: (f: FireListItem) => void;
}) {
  const { map } = useMap();

  return (
    <div className="max-w-5xl mx-auto w-full px-4 pb-10">
      <h2 className="text-xl font-semibold mb-3">Докладвани пожари</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {fires.map((f) => (
          <Card key={f.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                <span>Пожар #{f.id}</span>
                <span className="text-sm font-normal text-muted-foreground">{timeAgo(f.createdAt)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-sm text-muted-foreground">
                Радиус: <span className="text-foreground font-medium">{metersToReadable(f.radiusM)}</span>
                {typeof f.distanceM === "number" && (
                  <>
                    {" • "}Разстояние: <span className="text-foreground font-medium">{metersToReadable(f.distanceM)}</span>
                  </>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                {typeof f.volunteersConfirmed === "number" && (
                  <Badge variant="secondary">Потвърдени: {f.volunteersConfirmed}</Badge>
                )}
                {typeof f.volunteersRequested === "number" && (
                  <Badge variant="outline">Заявили: {f.volunteersRequested}</Badge>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (map) {
                      map.flyTo({ center: [f.lng, f.lat], zoom: 14, speed: 1.2 });
                    }
                    onFocus?.(f);
                  }}
                >
                  Фокусирай на картата
                </Button>
                <Link href={`/fires/${f.id}`}>
                  <Button size="sm">Детайли</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
        {fires.length === 0 && (
          <div className="text-sm text-muted-foreground">Няма докладвани пожари.</div>
        )}
      </div>
    </div>
  );
}
