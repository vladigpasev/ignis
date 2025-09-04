"use client";

import mapboxgl from "mapbox-gl";
import React, { useEffect, useRef, useState } from "react";
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
};

export default function Marker({
  children,
  latitude,
  longitude,
  data,
  onHover,
  onClick,
}: Props) {
  const { map } = useMap();
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // контейнер за React портала – създаваме го веднъж
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (typeof document !== "undefined") {
      setContainer(document.createElement("div"));
    }
  }, []);

  // стабилни референции към callback-ите (без да ре-създаваме маркера)
  const hoverRef = useRef<typeof onHover>(undefined);
  const clickRef = useRef<typeof onClick>(undefined);
  const dataRef = useRef<LocationFeature>(data);
  useEffect(() => {
    hoverRef.current = onHover;
  }, [onHover]);
  useEffect(() => {
    clickRef.current = onClick;
  }, [onClick]);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // добавяне на слушатели към контейнера (веднъж)
  useEffect(() => {
    if (!container) return;
    const handleEnter = () => {
      if (!markerRef.current) return;
      hoverRef.current?.({
        isHovered: true,
        position: { longitude, latitude },
        marker: markerRef.current,
        data: dataRef.current,
      });
    };
    const handleLeave = () => {
      if (!markerRef.current) return;
      hoverRef.current?.({
        isHovered: false,
        position: { longitude, latitude },
        marker: markerRef.current,
        data: dataRef.current,
      });
    };
    const handleClick = () => {
      if (!markerRef.current) return;
      clickRef.current?.({
        position: { longitude, latitude },
        marker: markerRef.current,
        data: dataRef.current,
      });
    };

    container.addEventListener("mouseenter", handleEnter);
    container.addEventListener("mouseleave", handleLeave);
    container.addEventListener("click", handleClick);

    return () => {
      container.removeEventListener("mouseenter", handleEnter);
      container.removeEventListener("mouseleave", handleLeave);
      container.removeEventListener("click", handleClick);
    };
    // умишлено НЕ зависим от onHover/onClick/data, защото използваме рефове
  }, [container, latitude, longitude]);

  // създаваме маркера ВЕДНЪЖ (не ползваме style.load) – маркерите оцеляват при смяна на стил
  useEffect(() => {
    if (!map || !container) return;
    if (markerRef.current) return; // вече е създаден

    try {
      const marker = new mapboxgl.Marker({ element: container })
        .setLngLat([longitude, latitude])
        .addTo(map);
      markerRef.current = marker;
    } catch {
      // ignore
    }

    return () => {
      try {
        markerRef.current?.remove();
      } catch {}
      markerRef.current = null;
    };
  }, [map, container]); // умишлено НЕ зависим от longitude/latitude

  // плавно обновяване на позицията, без да унищожаваме маркера
  useEffect(() => {
    markerRef.current?.setLngLat([longitude, latitude]);
  }, [longitude, latitude]);

  if (!container) return null;
  return createPortal(children, container);
}
