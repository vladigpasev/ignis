"use client";

import { createContext, useContext } from "react";
import type mapboxgl from "mapbox-gl";

export type MapContextType = {
  map: mapboxgl.Map | null;
};

export const MapContext = createContext<MapContextType>({ map: null });

export function useMap() {
  const ctx = useContext(MapContext);
  if (!ctx) {
    throw new Error("useMap must be used within a MapProvider");
  }
  return ctx;
}

