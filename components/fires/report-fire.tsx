"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@auth0/nextjs-auth0";
import { useMap } from "@/context/map-context";
import { Button } from "@/components/ui/button";
import { circlePolygon, metersToReadable } from "@/lib/geo";
import FireMarker from "./fire-marker";

const PREVIEW_SRC = "fire-preview-src";
const PREVIEW_FILL = "fire-preview-fill";
const PREVIEW_LINE = "fire-preview-line";

type Props = {
  action: (formData: FormData) => Promise<void>;
};

export default function ReportFire({ action }: Props) {
  const { user, isLoading } = useUser();
  const { map } = useMap();
  const router = useRouter();

  const [isReporting, setIsReporting] = useState(false);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(300); // m
  const [isPending, startTransition] = useTransition();

  // Добавяме/ъпдейтваме "preview" слой
  useEffect(() => {
    if (!map) return;

    const applyPreview = () => {
      if (!map || !map.isStyleLoaded()) return;

      if (!point) {
        // премахваме ако има
        try {
          if (map.getLayer(PREVIEW_LINE)) map.removeLayer(PREVIEW_LINE);
          if (map.getLayer(PREVIEW_FILL)) map.removeLayer(PREVIEW_FILL);
          if (map.getSource(PREVIEW_SRC)) map.removeSource(PREVIEW_SRC);
        } catch {}
        return;
      }

      const gj = {
        type: "FeatureCollection" as const,
        features: [circlePolygon(point, radius)],
      };

      try {
        if (!map.getSource(PREVIEW_SRC)) {
          map.addSource(PREVIEW_SRC, { type: "geojson", data: gj });
          map.addLayer({
            id: PREVIEW_FILL,
            type: "fill",
            source: PREVIEW_SRC,
            paint: { "fill-color": "#DC2626", "fill-opacity": 0.12 },
          });
          map.addLayer({
            id: PREVIEW_LINE,
            type: "line",
            source: PREVIEW_SRC,
            paint: { "line-color": "#DC2626", "line-width": 2, "line-opacity": 0.7 },
          });
        } else {
          const src = map.getSource(PREVIEW_SRC) as any;
          src?.setData?.(gj);
        }
      } catch {}
    };

    // ensure on current style
    applyPreview();

    // re-apply on future style changes too
    const handler = () => applyPreview();
    map.on("style.load", handler as any);
    return () => {
      try {
        map.off("style.load", handler as any);
      } catch {}
    };
  }, [map, point, radius]);

  // Click върху картата при режим "докладване"
  useEffect(() => {
    if (!map || !isReporting) return;

    const onClick = (e: any) => {
      const { lng, lat } = e?.lngLat || {};
      if (typeof lng === 'number' && typeof lat === 'number') setPoint({ lat, lng });
    };

    try {
      const canvas = (map as any)?.getCanvas?.();
      if (canvas && canvas.style) canvas.style.cursor = "crosshair";
    } catch {}
    try { map.on("click", onClick); } catch {}

    return () => {
      try { map.off("click", onClick); } catch {}
      try {
        const canvas = (map as any)?.getCanvas?.();
        if (canvas && canvas.style) canvas.style.cursor = "";
      } catch {}
    };
  }, [map, isReporting]);

  const canCreate = !!point && radius >= 50 && radius <= 20000;

  const startReporting = () => {
    setIsReporting(true);
    setPoint(null);
    setRadius(300);
  };
  const cancelReporting = () => {
    setIsReporting(false);
    setPoint(null);
  };

  const onSubmit = (formData: FormData) => {
    startTransition(async () => {
      try {
        await action(formData);
        router.refresh();
        cancelReporting();
      } catch (e: any) {
        const msg = e?.message || '';
        if (msg === 'ProfileIncomplete' || /профил/i.test(msg)) {
          try { window.dispatchEvent(new Event('open-volunteer-modal')); } catch {}
        } else {
          alert(msg || "Неуспешно създаване.");
        }
      }
    });
  };

  return (
    <div className="absolute top-20 sm:top-4 right-4 z-10 flex flex-col items-end gap-2">
      {!isLoading && !user && (
        <div className="bg-background/90 border rounded-lg shadow-lg p-3 max-w-[320px]">
          <div className="text-sm mb-2">За да докладваш пожар, влез в профила си.</div>
          <div className="flex gap-2">
            <a href="/auth/login">
              <Button size="sm">Вход</Button>
            </a>
          </div>
        </div>
      )}

      <div className="bg-background/90 border rounded-lg shadow-lg p-2 flex gap-2">
        {!isReporting ? (
          <Button size="sm" onClick={startReporting} disabled={!user || isLoading}>
            Докладвай пожар
          </Button>
        ) : (
          <>
            <Button size="sm" variant="secondary" onClick={cancelReporting}>
              Откажи
            </Button>
            <div className="hidden sm:flex items-center text-sm text-muted-foreground px-1">Кликни на картата за позиция</div>
          </>
        )}
      </div>

      {isReporting && (
        <div className="bg-background/90 border rounded-lg shadow-lg p-3 w-[280px] sm:w-[360px]">
          <div className="text-sm font-medium mb-1">Нова точка на пожар</div>
          <div className="text-xs text-muted-foreground mb-3">
            1) Кликни на картата, за да зададеш център. 2) Задай радиус. 3) Създай пожар.
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Радиус: <span className="text-foreground font-medium">{metersToReadable(radius)}</span></label>
            <input
              type="range"
              min={50}
              max={5000}
              step={10}
              value={radius}
              onChange={(e) => setRadius(parseInt(e.target.value, 10))}
              className="w-full"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>50 м</span><span>5 км</span>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              onSubmit(fd);
            }}
            className="mt-3 flex gap-2 items-center"
          >
            <input type="hidden" name="lat" value={point?.lat ?? ""} />
            <input type="hidden" name="lng" value={point?.lng ?? ""} />
            <input type="hidden" name="radiusM" value={radius} />
            <Button size="sm" type="submit" disabled={!canCreate || isPending}>
              {isPending ? "Създаване…" : "Създай пожар"}
            </Button>
            <Button size="sm" variant="outline" type="button" onClick={cancelReporting}>
              Затвори
            </Button>
          </form>
          {!point && <div className="mt-2 text-xs text-muted-foreground">Избери точка на картата…</div>}
        </div>
      )}

      {isReporting && point && (
        <FireMarker id={-1} lat={point.lat} lng={point.lng} />
      )}
    </div>
  );
}
