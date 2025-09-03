"use client";

import { useMap } from "@/context/map-context";
import mapboxgl from "mapbox-gl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type PopupProps = {
  children: React.ReactNode;
  latitude?: number;
  longitude?: number;
  onClose?: () => void;
  marker?: mapboxgl.Marker;
} & mapboxgl.PopupOptions;

export default function Popup({
  latitude,
  longitude,
  children,
  marker,
  onClose,
  className,
  ...props
}: PopupProps) {
  const { map } = useMap();

  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (typeof document !== "undefined") {
      setContainer(document.createElement("div"));
    }
  }, []);
  const handleClose = useCallback(() => onClose?.(), [onClose]);

  useEffect(() => {
    if (!map || !container) return;

    const popup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: false,
      ...props,
      className: `mapboxgl-custom-popup ${className ?? ""}`,
    })
      .setDOMContent(container)
      .setMaxWidth("none");

    popup.on("close", handleClose);

    if (marker) {
      const current = marker.getPopup();
      if (current) current.remove();
      marker.setPopup(popup);
      marker.togglePopup();
    } else if (latitude !== undefined && longitude !== undefined) {
      popup.setLngLat([longitude, latitude]).addTo(map);
    }

    return () => {
      popup.off("close", handleClose);
      // Detach our container before removing the popup to avoid React portal cleanup conflicts
      try {
        popup.setDOMContent(document.createElement("div"));
      } catch {}
      try {
        popup.remove();
      } catch {}
      try {
        if (marker && marker.getPopup()) marker.setPopup(null);
      } catch {}
    };
  }, [map, marker, latitude, longitude, props, className, container, handleClose]);

  if (!container) return null;
  return createPortal(children, container);
}
