"use client";

import { useEffect, useMemo } from "react";
import { useMap } from "@/context/map-context";
import { circlePolygon } from "@/lib/geo";

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
};

const SRC_ID = "zones-polygons-src";
const FILL_ID = "zones-polygons-fill";
const LINE_ID = "zones-polygons-line";

export default function ZoneShapes({ zones }: { zones: Zone[] }) {
  const { map } = useMap();

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
          properties: { id: z.id, title: z.title || "" },
          geometry,
        };
      }),
    };
  }, [zones]);

  useEffect(() => {
    if (!map) return;

    const ensure = () => {
      if (!map || !map.isStyleLoaded()) return;
      try {
        if (!map.getSource(SRC_ID)) {
          map.addSource(SRC_ID, { type: "geojson", data: geojson });
        } else {
          (map.getSource(SRC_ID) as any)?.setData?.(geojson);
        }

        if (!map.getLayer(FILL_ID)) {
          map.addLayer({
            id: FILL_ID,
            type: "fill",
            source: SRC_ID,
            paint: {
              "fill-color": "#22c55e",
              "fill-opacity": 0.12,
            },
          });
        }
        if (!map.getLayer(LINE_ID)) {
          map.addLayer({
            id: LINE_ID,
            type: "line",
            source: SRC_ID,
            paint: {
              "line-color": "#16a34a",
              "line-width": 2,
              "line-opacity": 0.7,
            },
          });
        }
      } catch {}
    };

    const onStyle = () => ensure();
    map.on("style.load", onStyle as any);
    if (map.isStyleLoaded()) ensure();

    return () => {
      try {
        map.off("style.load", onStyle as any);
      } catch {}
    };
  }, [map, geojson]);

  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return;
    try {
      (map.getSource(SRC_ID) as any)?.setData?.(geojson);
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
