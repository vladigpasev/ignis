"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapContext } from "@/context/map-context";

const ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

type MapProviderProps = {
  mapContainerRef: React.RefObject<HTMLDivElement | null>;
  initialViewState: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  styleUrl?: string;
  /** NEW: извиква се при `map.on("load")` */
  onMapLoad?: (map: mapboxgl.Map) => void;
  children?: React.ReactNode;
};

export default function MapProvider({
  mapContainerRef,
  initialViewState,
  styleUrl = "mapbox://styles/mapbox/streets-v12",
  onMapLoad,
  children,
}: MapProviderProps) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ctxMap, setCtxMap] = useState<mapboxgl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // track load state in a ref for event handlers
  const loadedRef = useRef(false);
  // keep a stable ref to the callback to avoid re-creating the map
  const onLoadCbRef = useRef<MapProviderProps["onMapLoad"] | undefined>(undefined);
  useEffect(() => {
    onLoadCbRef.current = onMapLoad;
  }, [onMapLoad]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (mapRef.current || !mapContainerRef.current) return;

        if (!ACCESS_TOKEN) {
          setError("Липсва NEXT_PUBLIC_MAPBOX_TOKEN в .env.local");
          return;
        }
        if (ACCESS_TOKEN.startsWith("sk.")) {
          setError("Клиентът изисква публичен pk.* токен, не sk.*");
          return;
        }

        mapboxgl.accessToken = ACCESS_TOKEN;

        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: styleUrl,
          center: [initialViewState.longitude, initialViewState.latitude],
          zoom: initialViewState.zoom,
          attributionControl: false,
          logoPosition: "bottom-right",
        });

        mapRef.current = map;
        setCtxMap(map);

        const onError = (e: any) => {
          const msg =
            typeof e?.error?.message === "string"
              ? e.error.message
              : typeof e?.message === "string"
              ? e.message
              : null;
          const isBenign = typeof msg === "string" && /layer .* does not exist|source .* does not exist|cannot query|style( is)? not (done )?loading/i.test(msg);
          // After map is loaded, treat errors as non-fatal warnings to avoid noisy overlays
          if (loadedRef.current || isBenign) {
            console.warn("Mapbox warning:", msg || e);
            return;
          }
          console.error("Mapbox error:", msg || e);
          setError(msg || "Неуспешно зареждане на карта. Виж конзолата.");
        };

        map.on("error", onError);
        map.on("load", () => {
          if (cancelled) return;
          setLoaded(true);
          loadedRef.current = true;
          try {
            map.resize();
          } catch {}
          try {
            onLoadCbRef.current?.(map);
          } catch (e) {
            console.error(e);
          }
        });
      } catch (err: any) {
        console.error(err);
        setError(err?.message || "Грешка при инициализация на картата.");
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
        setCtxMap(null);
      }
      loadedRef.current = false;
    };
  }, [
    mapContainerRef,
    initialViewState.longitude,
    initialViewState.latitude,
    initialViewState.zoom,
    styleUrl,
  ]);

  // стабилизирана стойност за контекста (не създаваме нов обект на всеки ререндер)
  const contextValue = useMemo(() => ({ map: ctxMap }), [ctxMap]);

  return (
    <>
      <MapContext.Provider value={contextValue}>{children}</MapContext.Provider>

      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-[1000]">
          <div className="text-sm">Зареждане на карта…</div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 p-4 z-[1000]">
          <div className="max-w-md text-center text-sm text-destructive">{error}</div>
        </div>
      )}
    </>
  );
}
