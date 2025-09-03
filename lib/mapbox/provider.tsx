"use client";

import React, { useEffect, useRef, useState } from "react";
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
  children?: React.ReactNode;
};

export default function MapProvider({
  mapContainerRef,
  initialViewState,
  styleUrl = "mapbox://styles/mapbox/streets-v12",
  children,
}: MapProviderProps) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

        const onError = (e: any) => {
          console.error("Mapbox error:", e);
          const msg =
            typeof e?.error?.message === "string"
              ? e.error.message
              : "Неуспешно зареждане на карта. Виж конзолата.";
          setError(msg);
        };

        map.on("error", onError);
        map.on("load", () => {
          if (cancelled) return;
          setLoaded(true);
          try {
            map.resize();
          } catch {}
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
      }
    };
  }, [
    mapContainerRef,
    initialViewState.longitude,
    initialViewState.latitude,
    initialViewState.zoom,
    styleUrl,
  ]);

  return (
    <>
      <MapContext.Provider value={{ map: mapRef.current }}>
        {children}
      </MapContext.Provider>

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

