"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMap } from "@/context/map-context";
import { circlePolygon } from "@/lib/geo";
import Popup from "@/components/map/map-popup";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { useRouter } from "next/navigation";

type Zone = {
  id: number;
  fireId: number;
  title?: string | null;
  description?: string | null;
  geomType: "circle" | "polygon";
  centerLat?: number | null;
  centerLng?: number | null;
  radiusM?: number | null;
  polygon?: [number, number][];
  // optional membership flag (present in ZoneListItem)
  isMember?: boolean;
  // optional extras when provided from list endpoint
  createdAt?: string;
  members?: number;
  coverUrl?: string | null;
};

const SRC_ID = "zones-polygons-src";
const FILL_ID = "zones-polygons-fill";
const LINE_ID = "zones-polygons-line";
// Special highlight layers for user's own zone (kept above all)
const MY_FILL_ID = "zones-polygons-fill-my";
const MY_LINE_ID = "zones-polygons-line-my";

export default function ZoneShapes({ zones, onChange }: { zones: Zone[]; onChange?: () => void }) {
  const { map } = useMap();
  const router = useRouter();

  const [selected, setSelected] = useState<
    | {
        id: number;
        fireId: number;
        title: string;
        isMember?: boolean;
        lng: number;
        lat: number;
      }
    | null
  >(null);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // optimisticMark is defined after geojson

  const geojson = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: zones.map((z) => {
        const geometry =
          z.geomType === "circle" && z.centerLat != null && z.centerLng != null && z.radiusM
            ? circlePolygon({ lat: z.centerLat, lng: z.centerLng }, z.radiusM).geometry
            : {
                type: "Polygon" as const,
                coordinates: [(z.polygon || []).concat([(z.polygon || [])[0] || [0, 0]])] as [number, number][][],
              };
        return {
          type: "Feature" as const,
          properties: { id: z.id, fireId: z.fireId, title: z.title || "", isMember: !!z.isMember },
          geometry,
        };
      }),
    };
  }, [zones]);

  // Optimistic map style update: mark my zone immediately after join/leave
  const optimisticMark = useCallback(
    (mode: "join" | "leave", zoneId?: number) => {
      if (!map) return;
      try {
        const src: any = map.getSource(SRC_ID);
        if (!src || !src.setData) return;
        const newFc = {
          ...geojson,
          features: (geojson.features || []).map((f: any) => {
            const fid = Number(f?.properties?.id);
            const isMy = mode === "join" ? fid === zoneId : false;
            return { ...f, properties: { ...f.properties, isMember: isMy } };
          }),
        } as any;
        src.setData(newFc);
      } catch {}
    },
    [map, geojson],
  );

  useEffect(() => {
    if (!map) return;

    const ensure = () => {
      // Be defensive: sometimes isStyleLoaded() lies during rapid mounts.
      if (!map) return;
      try {
        // Ensure source exists, otherwise add it
        if (!map.getSource(SRC_ID)) {
          map.addSource(SRC_ID, { type: "geojson", data: geojson });
        }
        // Update data (safe even immediately after add)
        (map.getSource(SRC_ID) as any)?.setData?.(geojson);

        // Ensure fill/line layers exist
        if (!map.getLayer(FILL_ID)) {
          map.addLayer({
            id: FILL_ID,
            type: "fill",
            source: SRC_ID,
            // Base zones (not my zone)
            filter: ["!=", ["get", "isMember"], true],
            paint: {
              "fill-color": "#ef4444",
              "fill-opacity": 0.15,
            },
          });
        }
        if (!map.getLayer(LINE_ID)) {
          map.addLayer({
            id: LINE_ID,
            type: "line",
            source: SRC_ID,
            filter: ["!=", ["get", "isMember"], true],
            paint: {
              "line-color": "#dc2626",
              "line-width": 2,
              "line-opacity": 0.7,
            },
          });
        }
        // My zone highlight layers
        if (!map.getLayer(MY_FILL_ID)) {
          map.addLayer({
            id: MY_FILL_ID,
            type: "fill",
            source: SRC_ID,
            filter: ["==", ["get", "isMember"], true],
            paint: {
              // Blue highlight with slightly higher opacity
              "fill-color": "#3b82f6",
              "fill-opacity": 0.22,
            },
          });
        }
        if (!map.getLayer(MY_LINE_ID)) {
          map.addLayer({
            id: MY_LINE_ID,
            type: "line",
            source: SRC_ID,
            filter: ["==", ["get", "isMember"], true],
            paint: {
              // Stronger outline
              "line-color": "#1d4ed8",
              "line-width": 3,
              "line-opacity": 0.85,
            },
          });
        }
        // Keep zone layers near the top for reliable clicks
        try {
          if (map.getLayer(FILL_ID)) (map as any).moveLayer(FILL_ID);
          if (map.getLayer(LINE_ID)) (map as any).moveLayer(LINE_ID);
          if (map.getLayer(MY_FILL_ID)) (map as any).moveLayer(MY_FILL_ID);
          if (map.getLayer(MY_LINE_ID)) (map as any).moveLayer(MY_LINE_ID);
        } catch {}
      } catch {}
    };

    // Try on multiple lifecycle events to beat race conditions
    const onLoad = () => ensure();
    const onStyle = () => ensure();
    const onIdle = () => ensure();
    map.on("load", onLoad as any);
    map.on("style.load", onStyle as any);
    map.on("idle", onIdle as any);
    // Also attempt immediately if the style is already ready
    try {
      if (map.isStyleLoaded?.()) ensure();
    } catch {}
    // And schedule a short retry window just in case
    const t1 = setTimeout(ensure, 150);
    const t2 = setTimeout(ensure, 500);

    return () => {
      try {
        clearTimeout(t1);
        clearTimeout(t2);
        map.off("load", onLoad as any);
        map.off("style.load", onStyle as any);
        map.off("idle", onIdle as any);
      } catch {}
    };
  }, [map, geojson]);

  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return;
    try {
      // If source/layers are missing for any reason (e.g. a late style refresh), re-create them
      if (!map.getSource(SRC_ID)) {
        try {
          map.addSource(SRC_ID, { type: "geojson", data: geojson });
        } catch {}
      } else {
        (map.getSource(SRC_ID) as any)?.setData?.(geojson);
      }
      if (!map.getLayer(FILL_ID)) {
        try {
          map.addLayer({ id: FILL_ID, type: "fill", source: SRC_ID, filter: ["!=", ["get", "isMember"], true], paint: { "fill-color": "#ef4444", "fill-opacity": 0.15 } });
        } catch {}
      }
      if (!map.getLayer(LINE_ID)) {
        try {
          map.addLayer({ id: LINE_ID, type: "line", source: SRC_ID, filter: ["!=", ["get", "isMember"], true], paint: { "line-color": "#dc2626", "line-width": 2, "line-opacity": 0.7 } });
        } catch {}
      }
      if (!map.getLayer(MY_FILL_ID)) {
        try {
          map.addLayer({ id: MY_FILL_ID, type: "fill", source: SRC_ID, filter: ["==", ["get", "isMember"], true], paint: { "fill-color": "#3b82f6", "fill-opacity": 0.22 } });
        } catch {}
      }
      if (!map.getLayer(MY_LINE_ID)) {
        try {
          map.addLayer({ id: MY_LINE_ID, type: "line", source: SRC_ID, filter: ["==", ["get", "isMember"], true], paint: { "line-color": "#1d4ed8", "line-width": 3, "line-opacity": 0.85 } });
        } catch {}
      }
      try {
        if (map.getLayer(FILL_ID)) (map as any).moveLayer(FILL_ID);
        if (map.getLayer(LINE_ID)) (map as any).moveLayer(LINE_ID);
        if (map.getLayer(MY_FILL_ID)) (map as any).moveLayer(MY_FILL_ID);
        if (map.getLayer(MY_LINE_ID)) (map as any).moveLayer(MY_LINE_ID);
      } catch {}
    } catch {}
  }, [map, geojson]);

  // Interactions: hover + click on polygons
  useEffect(() => {
    if (!map) return;

    const onEnter = () => {
      try {
        const c = map.getCanvas?.();
        if (c) (c as HTMLCanvasElement).style.cursor = "pointer";
      } catch {}
    };
    const onLeave = () => {
      try {
        const c = map.getCanvas?.();
        if (c) (c as HTMLCanvasElement).style.cursor = "";
      } catch {}
    };
    const onClick = (e: any) => {
      const f = e?.features?.[0];
      if (!f) return;
      const p = f.properties || {};
      const id = Number(p.id);
      const fireId = Number(p.fireId);
      const title = String(p.title || "Зона");
      const isMember = p.isMember === true || p.isMember === "true" || p.isMember === 1 || p.isMember === "1";
      const { lng, lat } = e.lngLat || { lng: 0, lat: 0 };
      if (isMember) {
        // Direct navigation for user's own zone
        router.push(`/fires/${fireId}/zones/${id}`);
        setSelected(null);
        return;
      }
      setSelected({ id, fireId, title, isMember, lng, lat });
    };

    let onMapClick: ((ev: any) => void) | null = null;

    const attach = () => {
      try {
        if (map.getLayer(FILL_ID)) {
          map.on("mouseenter", FILL_ID, onEnter as any);
          map.on("mouseleave", FILL_ID, onLeave as any);
          map.on("click", FILL_ID, onClick as any);
        }
        if (map.getLayer(LINE_ID)) {
          map.on("mouseenter", LINE_ID, onEnter as any);
          map.on("mouseleave", LINE_ID, onLeave as any);
          map.on("click", LINE_ID, onClick as any);
        }
        if (map.getLayer(MY_FILL_ID)) {
          map.on("mouseenter", MY_FILL_ID, onEnter as any);
          map.on("mouseleave", MY_FILL_ID, onLeave as any);
          map.on("click", MY_FILL_ID, onClick as any);
        }
        if (map.getLayer(MY_LINE_ID)) {
          map.on("mouseenter", MY_LINE_ID, onEnter as any);
          map.on("mouseleave", MY_LINE_ID, onLeave as any);
          map.on("click", MY_LINE_ID, onClick as any);
        }
        // Global fallback click: query features from our layers (more robust)
        onMapClick = (ev: any) => {
          try {
            const layersToQuery = [MY_FILL_ID, MY_LINE_ID, FILL_ID, LINE_ID].filter((id) => !!map.getLayer(id));
            if (layersToQuery.length === 0) return;
            const feats = map.queryRenderedFeatures(ev.point, { layers: layersToQuery as any });
            const f = feats?.[0];
            if (!f) return;
            const p: any = f.properties || {};
            const id = Number(p.id);
            const fireId = Number(p.fireId);
            const title = String(p.title || "Зона");
            const isMember = p.isMember === true || p.isMember === "true" || p.isMember === 1 || p.isMember === "1";
            const { lng, lat } = ev.lngLat || { lng: 0, lat: 0 };
            if (isMember) {
              router.push(`/fires/${fireId}/zones/${id}`);
              setSelected(null);
              return;
            }
            setSelected({ id, fireId, title, isMember, lng, lat });
          } catch {}
        };
        map.on("click", onMapClick as any);
      } catch {}
    };
    const detach = () => {
      try {
        if (map.getLayer(FILL_ID)) {
          map.off("mouseenter", FILL_ID, onEnter as any);
          map.off("mouseleave", FILL_ID, onLeave as any);
          map.off("click", FILL_ID, onClick as any);
        }
        if (map.getLayer(LINE_ID)) {
          map.off("mouseenter", LINE_ID, onEnter as any);
          map.off("mouseleave", LINE_ID, onLeave as any);
          map.off("click", LINE_ID, onClick as any);
        }
        if (map.getLayer(MY_FILL_ID)) {
          map.off("mouseenter", MY_FILL_ID, onEnter as any);
          map.off("mouseleave", MY_FILL_ID, onLeave as any);
          map.off("click", MY_FILL_ID, onClick as any);
        }
        if (map.getLayer(MY_LINE_ID)) {
          map.off("mouseenter", MY_LINE_ID, onEnter as any);
          map.off("mouseleave", MY_LINE_ID, onLeave as any);
          map.off("click", MY_LINE_ID, onClick as any);
        }
        if (onMapClick) map.off("click", onMapClick as any);
      } catch {}
    };

    attach();
    const onStyle = () => {
      detach();
      attach();
    };
    map.on("style.load", onStyle as any);

    return () => {
      try {
        map.off("style.load", onStyle as any);
      } catch {}
      detach();
    };
  }, [map]);

  useEffect(() => {
    return () => {
      if (!map) return;
      try {
        if (map.getLayer(LINE_ID)) map.removeLayer(LINE_ID);
        if (map.getLayer(FILL_ID)) map.removeLayer(FILL_ID);
        if (map.getLayer(MY_LINE_ID)) map.removeLayer(MY_LINE_ID);
        if (map.getLayer(MY_FILL_ID)) map.removeLayer(MY_FILL_ID);
        if (map.getSource(SRC_ID)) map.removeSource(SRC_ID);
      } catch {}
    };
  }, [map]);

  const doOpen = useCallback(() => {
    if (!selected) return;
    router.push(`/fires/${selected.fireId}/zones/${selected.id}`);
    setSelected(null);
  }, [router, selected]);

  const doJoin = useCallback(async () => {
    if (!selected) return;
    setJoining(true);
    try {
      const res = await fetch(`/api/fires/${selected.fireId}/zones/${selected.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join" }),
      }).then((r) => r.json());
      if (!res?.ok) throw new Error(res?.error || "Грешка");
      // Optimistic update: recolor on map and update popup state
      optimisticMark("join", selected.id);
      setSelected((prev) => (prev ? { ...prev, isMember: true } : prev));
      onChange?.();
    } catch (e: any) {
      alert(e?.message || "Грешка");
    } finally {
      setJoining(false);
    }
  }, [selected, optimisticMark, onChange]);

  const doLeave = useCallback(async () => {
    if (!selected) return;
    setLeaving(true);
    try {
      const res = await fetch(`/api/fires/${selected.fireId}/zones/0/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave" }),
      }).then((r) => r.json());
      if (!res?.ok) throw new Error(res?.error || "Грешка");
      // Optimistic update: remove highlight and update popup state
      optimisticMark("leave");
      setSelected((prev) => (prev ? { ...prev, isMember: false } : prev));
      onChange?.();
    } catch (e: any) {
      alert(e?.message || "Грешка");
    } finally {
      setLeaving(false);
    }
  }, [selected, optimisticMark, onChange]);

  return (
    <>
      {selected && (() => {
        const z = zones.find((x) => x.id === selected.id);
        const displayTitle = z?.title || selected.title || null;
        const zoneLabel = `Зона #${selected.id}`;
        const desc = z?.description || "Няма описание.";
        const members = z?.members ?? undefined;
        const isMember = selected.isMember ?? z?.isMember ?? false;
        const cover = z?.coverUrl || null;
        // For user's zone: no popup/buttons; click already navigates directly.
        if (isMember) return null;
        return (
          <Popup latitude={selected.lat} longitude={selected.lng} offset={12} closeOnMove={false}>
            <div className="min-w-[240px] max-w-[320px]">
              {cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt={displayTitle || zoneLabel} className="w-full h-28 object-cover rounded-md border mb-2" />
              )}
              <div className="flex items-center justify-between gap-2 mb-1">
                <Badge variant="outline" className="shrink-0">{zoneLabel}</Badge>
                {typeof members === "number" && (
                  <Badge variant="secondary" className="shrink-0">
                    <Users className="h-3.5 w-3.5 mr-1" /> {members}
                  </Badge>
                )}
              </div>
              {displayTitle && (
                <div className="text-sm font-semibold leading-snug truncate pr-1 mb-1">{displayTitle}</div>
              )}
              {desc && (
                <div className="text-xs text-muted-foreground mb-3 line-clamp-3">{desc}</div>
              )}

              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={doJoin} disabled={joining} className="flex-1">
                  {joining ? "Присъединяване…" : "Влез"}
                </Button>
              </div>
            </div>
          </Popup>
        );
      })()}
    </>
  );
}
