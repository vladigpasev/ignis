"use client";

import mapboxgl, { MarkerOptions } from "mapbox-gl";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMap } from "@/context/map-context";
import { LocationFeature } from "@/lib/mapbox/utils";

type Props = {
  longitude: number;
  latitude: number;
  data: LocationFeature;
  onHover?: (args: {
    isHovered: boolean;
    position: { longitude: number; latitude: number };
    marker: mapboxgl.Marker;
    data: LocationFeature;
  }) => void;
  onClick?: (args: {
    position: { longitude: number; latitude: number };
    marker: mapboxgl.Marker;
    data: LocationFeature;
  }) => void;
  children?: React.ReactNode;
} & MarkerOptions;

export default function Marker({
  children,
  latitude,
  longitude,
  data,
  onHover,
  onClick,
  ...props
}: Props) {
  const { map } = useMap();
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // Create container on client only
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (typeof document !== "undefined") {
      setContainer(document.createElement("div"));
    }
  }, []);

  useEffect(() => {
    if (!map) return;

    const handleEnter = () =>
      onHover?.({ isHovered: true, position: { longitude, latitude }, marker: markerRef.current!, data });
    const handleLeave = () =>
      onHover?.({ isHovered: false, position: { longitude, latitude }, marker: markerRef.current!, data });
    const handleClick = () => onClick?.({ position: { longitude, latitude }, marker: markerRef.current!, data });

    if (!container) return;

    container.addEventListener("mouseenter", handleEnter);
    container.addEventListener("mouseleave", handleLeave);
    container.addEventListener("click", handleClick);

    const addMarker = () => {
      try {
        const marker = new mapboxgl.Marker({ element: container, ...props })
          .setLngLat([longitude, latitude])
          .addTo(map);
        markerRef.current = marker;
      } catch (e) {
        // swallow transient errors if map not ready
      }
    };

    if ((map as any).isStyleLoaded?.()) addMarker();
    map.once("style.load", addMarker as any);

    return () => {
      try {
        container.removeEventListener("mouseenter", handleEnter);
        container.removeEventListener("mouseleave", handleLeave);
        container.removeEventListener("click", handleClick);
        map.off("style.load", addMarker as any);
        markerRef.current?.remove();
      } catch {}
    };
  }, [map, longitude, latitude, props, onHover, onClick, data, container]);

  // Update position if coordinates change without recreating marker
  useEffect(() => {
    markerRef.current?.setLngLat([longitude, latitude]);
  }, [longitude, latitude]);

  // Render React children into the detached container owned by Mapbox
  if (!container) return null;
  return createPortal(children, container);
}
