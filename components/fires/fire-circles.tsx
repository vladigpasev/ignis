"use client";

import { useEffect, useMemo } from "react";
import { useMap } from "@/context/map-context";
import { circlePolygon } from "@/lib/geo";

export type FireItem = {
  id: number;
  lat: number;
  lng: number;
  radiusM: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  distanceM?: number;
};

const SRC_ID = "fires-polygons-src";
const FILL_ID = "fires-polygons-fill";
const LINE_ID = "fires-polygons-line";

export default function FireCircles({ fires }: { fires: FireItem[] }) {
  const { map } = useMap();

  const geojson = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: fires.map((f) => ({
        type: "Feature" as const,
        properties: { id: f.id, radiusM: f.radiusM, status: f.status },
        geometry: circlePolygon({ lat: f.lat, lng: f.lng }, f.radiusM).geometry,
      })),
    };
  }, [fires]);

  useEffect(() => {
    if (!map) return;

    const ensureLayers = () => {
      if (!map || !map.isStyleLoaded()) return;
      try {
        if (!map.getSource(SRC_ID)) {
          map.addSource(SRC_ID, { type: "geojson", data: geojson });
        } else {
          const src = map.getSource(SRC_ID) as any;
          src?.setData?.(geojson);
        }

        if (!map.getLayer(FILL_ID)) {
          map.addLayer({
            id: FILL_ID,
            type: "fill",
            source: SRC_ID,
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
            paint: {
              "line-color": "#ef4444",
              "line-width": 2,
              "line-opacity": 0.6,
            },
          });
        }
      } catch (e) {
        // swallow errors during style reloads
      }
    };

    const handler = () => ensureLayers();
    map.on("style.load", handler as any);
    if (map.isStyleLoaded()) ensureLayers();
    return () => {
      try {
        map.off("style.load", handler as any);
      } catch {}
    };
  }, [map, geojson]);

  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return;
    // Ъпдейт на данните при промяна (ако източникът вече съществува)
    try {
      const src = map.getSource(SRC_ID) as any;
      src?.setData?.(geojson);
    } catch {}
  }, [map, geojson]);

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

  return null;
}
