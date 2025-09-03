"use client";

import { MapPin } from "lucide-react";
import Marker from "@/components/map/map-marker";

type Props = {
  id: number;
  lat: number;
  lng: number;
  onClick?: (id: number) => void;
  onHover?: (id: number) => void;
};

export default function FireMarker({ id, lat, lng, onClick, onHover }: Props) {
  // map-marker изисква data: LocationFeature, за да не променяме generics – подаваме dummy
  const dummy: any = { properties: { mapbox_id: String(id) } };

  return (
    <Marker
      longitude={lng}
      latitude={lat}
      data={dummy}
      onHover={() => onHover?.(id)}
      onClick={() => onClick?.(id)}
    >
      <div className="rounded-full flex items-center justify-center transform transition-all duration-200 bg-red-500 text-white shadow-lg size-8 cursor-pointer hover:scale-110">
        <MapPin className="stroke-[2.5px] size-4.5" />
      </div>
    </Marker>
  );
}

