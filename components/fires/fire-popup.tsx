"use client";

import Popup from "@/components/map/map-popup";
import { Button } from "@/components/ui/button";
import { metersToReadable } from "@/lib/geo";
import { Navigation } from "lucide-react";

type Props = {
  id: number;
  lat: number;
  lng: number;
  radiusM: number;
  createdAt: string | Date;
  onClose?: () => void;
};

export default function FirePopup({ id, lat, lng, radiusM, createdAt, onClose }: Props) {
  const created = new Date(createdAt);
  return (
    <Popup latitude={lat} longitude={lng} onClose={onClose} offset={15} closeButton className="fire-popup">
      <div className="w-[280px] sm:w-[320px]">
        <h3 className="font-medium text-base">Докладван пожар</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Радиус: <span className="font-medium text-foreground">{metersToReadable(radiusM)}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          ID: {id} • {created.toLocaleString()}
        </p>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
            }}
          >
            <Navigation className="h-4 w-4 mr-1.5" />
            Навигация
          </Button>
        </div>
      </div>
    </Popup>
  );
}

