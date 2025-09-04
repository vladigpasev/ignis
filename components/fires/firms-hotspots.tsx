"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useMap } from "@/context/map-context";
import { circlePolygon, haversineMeters } from "@/lib/geo";
import FirmsMarker from "./firms-marker";
import FirmsPopup from "./firms-popup";
import { useUser } from "@auth0/nextjs-auth0";
import { useDebounce } from "@/hooks/useDebounce";

export type FirmsHotspot = {
  id: string;
  lat: number;
  lng: number;
  source: string;
  satellite?: string;
  instrument?: string;
  brightness?: number;
  frp?: number;         // при клъстер = Σ FRP (също идва във frpTotal)
  confidence?: number;
  confidenceRaw?: string;
  daynight?: string;
  acquiredAt?: string;
  radiusM: number;
  distanceM?: number;
  // нови
  count?: number;
  sources?: string[];
  firstSeenAt?: string;
  lastSeenAt?: string;
  frpTotal?: number;
};

const SRC_ID = "firms-polygons-src";
const FILL_ID = "firms-polygons-fill";
const LINE_ID = "firms-polygons-line";

// за подреждане под червените пожари (ако вече са налични)
const FIRES_FILL_ID = "fires-polygons-fill";
const FIRES_LINE_ID = "fires-polygons-line";

type Props = {
  createAction: (formData: FormData) => Promise<void>;
  dedupRadiusM?: number;
  minConfidence?: number;
  days?: number;
  maxMarkers?: number;
  activeFires?: { lat: number; lng: number }[];
  clusterRadiusM?: number; // ново
};

export default function FirmsHotspots({
  createAction,
  dedupRadiusM = 500,
  minConfidence = 0,
  days = 2,
  maxMarkers = 250,
  activeFires = [],
  clusterRadiusM = 650,
}: Props) {
  const { map } = useMap();
  const { user } = useUser();

  const [hotspots, setHotspots] = useState<FirmsHotspot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [isLoadedOnce, setIsLoadedOnce] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // === FETCH bbox ===
  const fetchRef = useRef<AbortController | null>(null);
  const [bboxString, setBboxString] = useState<string | null>(null);
  const debouncedBbox = useDebounce(bboxString, 350);

  useEffect(() => {
    if (!map) return;
    const apply = () => {
      try {
        const b = map.getBounds() as any;
        const sw = b.getSouthWest();
        const ne = b.getNorthEast();
        const bbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
        setBboxString(bbox);
      } catch {}
    };
    map.on("moveend", apply);
    if ((map as any).isStyleLoaded?.()) apply();
    return () => {
      try {
        map.off("moveend", apply);
      } catch {}
    };
  }, [map]);

  useEffect(() => {
    if (!debouncedBbox) return;
    const controller = new AbortController();
    fetchRef.current?.abort();
    fetchRef.current = controller;

    (async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("bbox", debouncedBbox);
        params.set("dedupRadiusM", String(dedupRadiusM));
        if (minConfidence > 0) params.set("minConfidence", String(minConfidence));
        params.set("days", String(days));
        params.set("clusterRadiusM", String(clusterRadiusM)); // ново

        const res = await fetch(`/api/firms?${params.toString()}`, { signal: controller.signal, cache: "no-store" });
        const j = await res.json();
        if (j?.ok) {
          const next: any[] = Array.isArray(j.hotspots) ? j.hotspots : [];
          if (next.length >= 0) setHotspots(next as any);
          setIsLoadedOnce(true);
        } else {
          console.error("FIRMS error:", j?.error);
        }
      } catch (e) {
        if (!(e as any)?.name?.includes?.("AbortError")) {
          console.error(e);
        }
      } finally {
        setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [debouncedBbox, dedupRadiusM, minConfidence, days, clusterRadiusM]);

  const selected = useMemo(
    () => (selectedId ? hotspots.find((h) => h.id === selectedId) ?? null : null),
    [hotspots, selectedId]
  );

  // Клиентска дедупликация срещу активни пожари (допълнителна защита)
  const visibleHotspots = useMemo(() => {
    if (!activeFires?.length) return hotspots;
    return hotspots.filter((h) => {
      for (const f of activeFires) {
        const d = haversineMeters({ lat: h.lat, lng: h.lng }, f);
        if (d <= dedupRadiusM) return false;
      }
      return true;
    });
  }, [hotspots, activeFires, dedupRadiusM]);

  // === GeoJSON полигоните (жълти) ===
  const geojson = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: visibleHotspots.map((h) => ({
        type: "Feature" as const,
        properties: {
          id: h.id,
          radiusM: h.radiusM,
          source: h.source,
          count: h.count ?? 1,
        },
        geometry: circlePolygon({ lat: h.lat, lng: h.lng }, h.radiusM).geometry,
      })),
    };
  }, [visibleHotspots]);

  // Добавяне/ъпдейт на източник и слоеве – винаги под червените (ако те съществуват)
  useEffect(() => {
    if (!map) return;

    const addOrUpdate = () => {
      if (!map || !map.isStyleLoaded()) return;
      try {
        // source
        if (!map.getSource(SRC_ID)) {
          map.addSource(SRC_ID, { type: "geojson", data: geojson });
        } else {
          (map.getSource(SRC_ID) as any)?.setData?.(geojson);
        }

        // fill
        if (!map.getLayer(FILL_ID)) {
          const layer: any = {
            id: FILL_ID,
            type: "fill",
            source: SRC_ID,
            paint: {
              "fill-color": "#f59e0b",
              "fill-opacity": 0.12,
            },
          };
          if (map.getLayer(FIRES_FILL_ID)) (map as any).addLayer(layer, FIRES_FILL_ID);
          else map.addLayer(layer);
        }

        // line
        if (!map.getLayer(LINE_ID)) {
          const layer: any = {
            id: LINE_ID,
            type: "line",
            source: SRC_ID,
            paint: {
              "line-color": "#f59e0b",
              "line-width": 2,
              "line-opacity": 0.7,
            },
          };
          if (map.getLayer(FIRES_LINE_ID)) (map as any).addLayer(layer, FIRES_LINE_ID);
          else map.addLayer(layer);
        }

        // преместване под червените, ако се появят по-късно
        try {
          if (map.getLayer(FIRES_FILL_ID)) (map as any).moveLayer(FILL_ID, FIRES_FILL_ID);
          if (map.getLayer(FIRES_LINE_ID)) (map as any).moveLayer(LINE_ID, FIRES_LINE_ID);
        } catch {}
      } catch {
        // swallow
      }
    };

    const onStyle = () => addOrUpdate();
    map.on("style.load", onStyle as any);
    if (map.isStyleLoaded()) addOrUpdate();

    return () => {
      try {
        map.off("style.load", onStyle as any);
      } catch {}
    };
  }, [map, geojson]);

  // live ъпдейт на данните
  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return;
    try {
      (map.getSource(SRC_ID) as any)?.setData?.(geojson);
    } catch {}
  }, [map, geojson]);

  // чистене на слоевете при унищожаване
  useEffect(() => {
    return () => {
      if (!map) return;
      try {
        if (map.getLayer(LINE_ID)) map.removeLayer(LINE_ID);
        if (map.getLayer(FILL_ID)) map.removeLayer(FILL_ID);
        if (map.getSource(SRC_ID)) map.removeSource(SRC_ID);
      } catch {}
    };
  }, [map]);

  // Превръщане на FIRMS сигнал/клъстер → докладван пожар (в БД)
  const promoteToFire = (h: FirmsHotspot) => {
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("lat", String(h.lat));
        fd.set("lng", String(h.lng));
        fd.set("radiusM", String(h.radiusM));
        await createAction(fd);
        setHotspots((prev) => prev.filter((x) => x.id !== h.id));
        setSelectedId(null);
      } catch (e: any) {
        alert(e?.message || "Неуспешно създаване.");
      }
    });
  };

  return (
    <>
      {/* Индикатор за live състояние */}
      <div className="absolute top-4 right-[11.5rem] sm:right-[13rem] z-10">
        {isLoading ? (
          <div className="bg-background/90 border rounded-lg shadow-lg px-2 py-1 text-xs">
            Зареждане FIRMS…
          </div>
        ) : isLoadedOnce ? (
          <div className="bg-background/90 border rounded-lg shadow-lg px-2 py-1 text-xs">
            FIRMS: {visibleHotspots.length} групи
          </div>
        ) : null}
      </div>

      {/* DOM пинове */}
      {visibleHotspots.slice(0, maxMarkers).map((h) => (
        <FirmsMarker
          key={h.id}
          id={h.id}
          lat={h.lat}
          lng={h.lng}
          count={h.count ?? 1}
          onClick={() => setSelectedId(h.id)}
        />
      ))}

      {selected && (
        <FirmsPopup
          hotspot={selected}
          isLoggedIn={!!user}
          isSubmitting={isPending}
          onPromote={() => promoteToFire(selected)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}
