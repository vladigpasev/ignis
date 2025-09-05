"use client";

import Popup from "@/components/map/map-popup";
import { Button } from "@/components/ui/button";
import { Navigation } from "lucide-react";
import { FirmsHotspot } from "./firms-hotspots";
import { metersToReadable } from "@/lib/geo";

export default function FirmsPopup({
  hotspot,
  onClose,
  onPromote,
  isLoggedIn,
  isSubmitting,
}: {
  hotspot: FirmsHotspot;
  onClose?: () => void;
  onPromote?: () => void;
  isLoggedIn: boolean;
  isSubmitting?: boolean;
}) {
  const { lat, lng, radiusM } = hotspot;

  const isCluster = hotspot.source === "FIRMS_CLUSTER" || (hotspot.count ?? 1) > 1;
  const count = hotspot.count ?? 1;

  const frpSigma = typeof hotspot.frpTotal === "number" ? hotspot.frpTotal : (typeof hotspot.frp === "number" ? hotspot.frp : undefined);
  const confidenceLabel = typeof hotspot.confidence === "number"
    ? `${Math.round(hotspot.confidence)}%`
    : undefined;

  const timeLabel = (() => {
    if (isCluster && hotspot.firstSeenAt && hotspot.lastSeenAt && hotspot.firstSeenAt !== hotspot.lastSeenAt) {
      const a = new Date(hotspot.firstSeenAt);
      const b = new Date(hotspot.lastSeenAt);
      return `Период: ${a.toLocaleString()} – ${b.toLocaleString()}`;
    }
    if (hotspot.acquiredAt) {
      return `Засечен: ${new Date(hotspot.acquiredAt).toLocaleString()}`;
    }
    return undefined;
  })();

  const sourcesLabel = (() => {
    if (isCluster) {
      const list = hotspot.sources ?? [];
      if (list.length === 0) return "Обединени сигнали (FIRMS)";
      if (list.length <= 2) return list.join(", ");
      return `${list.slice(0, 2).join(", ")} +${list.length - 2}`;
    }
    return hotspot.source;
  })();

  return (
    <Popup latitude={lat} longitude={lng} onClose={onClose} offset={15} closeButton className="firms-popup">
      <div className="w-[300px] sm:w-[340px]">
        <h3 className="font-medium text-base">
          {isCluster ? "FIRMS клъстер (NASA)" : "FIRMS сигнал (NASA)"}
        </h3>

        <p className="text-sm text-muted-foreground mt-1">
          Източник:{" "}
          <span className="font-medium text-foreground">
            {sourcesLabel}
          </span>
          {hotspot.satellite && !isCluster && (
            <>
              {" • "}Сателит:{" "}
              <span className="font-medium text-foreground">{hotspot.satellite}</span>
            </>
          )}
          {hotspot.instrument && !isCluster && (
            <>
              {" • "}Инстр.:{" "}
              <span className="font-medium text-foreground">{hotspot.instrument}</span>
            </>
          )}
        </p>

        <p className="text-sm text-muted-foreground">
          Радиус: <span className="font-medium text-foreground">{metersToReadable(radiusM)}</span>
          {typeof hotspot.confidence === "number" && (
            <>
              {" • "}{isCluster ? "Ср. доверие" : "Доверие"}:{" "}
              <span className="font-medium text-foreground">{confidenceLabel}</span>
            </>
          )}
          {typeof frpSigma === "number" && (
            <>
              {" • "}{isCluster ? "FRP Σ" : "FRP"}:{" "}
              <span className="font-medium text-foreground">{frpSigma.toFixed(1)}</span>
            </>
          )}
          {isCluster && (
            <>
              {" • "}Сигнали:{" "}
              <span className="font-medium text-foreground">{count}</span>
            </>
          )}
        </p>

        {timeLabel && (
          <p className="text-xs text-muted-foreground mt-1" suppressHydrationWarning>
            {timeLabel}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank")}
          >
            <Navigation className="h-4 w-4 mr-1.5" />
            Навигация
          </Button>

          {isLoggedIn ? (
            <Button
              size="sm"
              onClick={onPromote}
              disabled={isSubmitting}
              className="bg-amber-500 hover:bg-amber-500/90 text-white"
            >
              {isSubmitting ? "Добавяне…" : "Добави като пожар"}
            </Button>
          ) : (
            <a href="/auth/login">
              <Button size="sm">Влез и добави</Button>
            </a>
          )}
        </div>

        <div className="mt-3 pt-2 border-t text-xs text-muted-foreground">
          <div className="flex justify-between items-center">
            <span className="truncate max-w-[170px]">ID: {hotspot.id.substring(0, 12)}…</span>
            <span className="text-right">{lat.toFixed(4)}, {lng.toFixed(4)}</span>
          </div>
        </div>
      </div>
    </Popup>
  );
}
