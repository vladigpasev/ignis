"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useMap } from "@/context/map-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pentagon, MousePointer2, Undo2, Check, XCircle } from "lucide-react";
import type mapboxgl from "mapbox-gl";
// Полигонално рисуване чрез Mapbox Draw (както в docs примера)
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

/**
 * Основни подобрения:
 * - Улавяне на събития на map container (capture), за да работи върху маркери/попъпи.
 * - Стабилно изключване/възстановяване на doubleClickZoom/dragPan/boxZoom/keyboard/touchZoomRotate.
 * - По-добри подсказки и UX (Esc=отказ, Enter/двуклик=край, десен клик/Backspace=назад).
 * - Без dynamic require; коректни превю слоеве; устойчивост при смяна на стил.
 */

export default function ZoneDraw({
  fireId,
  onCreated,
}: {
  fireId: number;
  onCreated?: () => void;
}) {
  const { map } = useMap();

  // UI/формови полета
  const [mode, setMode] = useState<"idle" | "polygon">("idle");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // Mobile detection for adaptive UX
  const [isMobile, setIsMobile] = useState(false);

  // Геометрия
  const [points, setPoints] = useState<[number, number][]>([]);
  const [cursor, setCursor] = useState<[number, number] | null>(null);

  const [hint, setHint] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  // Рефове за текущо състояние (избягват stale затваряния в DOM listeners)
  const modeRef = useRef(mode);
  const pointsRef = useRef(points);
  const drawRef = useRef<MapboxDraw | null>(null);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { pointsRef.current = points; }, [points]);

  // Detect mobile / touch or narrow screens
  useEffect(() => {
    try {
      const compute = () => {
        const coarse = window.matchMedia?.("(pointer: coarse)")?.matches || (navigator as any).maxTouchPoints > 0;
        const narrow = window.matchMedia?.("(max-width: 768px)")?.matches;
        setIsMobile(!!(coarse || narrow));
      };
      compute();
      window.addEventListener("resize", compute);
      return () => window.removeEventListener("resize", compute);
    } catch {}
  }, []);

  // Запомняне на интеракции за възстановяване
  const interactionsRef = useRef<{
    doubleClickZoom?: boolean;
    boxZoom?: boolean;
    dragPan?: boolean;
    keyboard?: boolean;
    touchZoomRotate?: boolean;
  } | null>(null);

  // Идентификатори за превю слоеве
  const PREVIEW_SRC = "zone-draw-preview-src";
  const PREVIEW_FILL = "zone-draw-preview-fill";
  const PREVIEW_LINE = "zone-draw-preview-line";
  const PREVIEW_PTS = "zone-draw-preview-pts";

  // GeoJSON превю според текущия режим
  const previewGeojson = useMemo(() => {
    const features: any[] = [];

    if (mode === "polygon") {
      const verts = points.slice();
      if (cursor) verts.push(cursor);
      if (verts.length >= 2) {
        features.push({
          type: "Feature",
          properties: { __kind: "line" },
          geometry: { type: "LineString", coordinates: verts },
        });
      }
      if (points.length >= 3) {
        const ring = points.concat([cursor || points[0], points[0]]);
        features.push({
          type: "Feature",
          properties: { __kind: "polygon" },
          geometry: { type: "Polygon", coordinates: [ring] },
        });
      }
      if (points.length > 0) {
        features.push({
          type: "Feature",
          properties: { __kind: "point" },
          geometry: { type: "MultiPoint", coordinates: points },
        });
      }
    }

    return { type: "FeatureCollection", features } as any;
  }, [mode, points, cursor]);

  // Помощни: блок/разблок на map интеракции по време на рисуване
  const lockInteractions = useCallback(() => {
    if (!map) return;
    try {
      interactionsRef.current = {
        doubleClickZoom: (map as any).doubleClickZoom?.isEnabled?.(),
        boxZoom: (map as any).boxZoom?.isEnabled?.(),
        dragPan: (map as any).dragPan?.isEnabled?.(),
        keyboard: (map as any).keyboard?.isEnabled?.(),
        touchZoomRotate: (map as any).touchZoomRotate?.isEnabled?.(),
      };
      // On mobile, keep pan/zoom enabled during drawing for better UX
      (map as any).doubleClickZoom?.disable?.();
      (map as any).boxZoom?.disable?.();
      if (isMobile) {
        (map as any).keyboard?.disable?.();
        // leave dragPan and touchZoomRotate enabled on mobile
      } else {
        (map as any).dragPan?.disable?.();
        (map as any).keyboard?.disable?.();
        (map as any).touchZoomRotate?.disable?.();
      }
    } catch {
      // ignore
    }
  }, [map, isMobile]);

  const unlockInteractions = useCallback(() => {
    if (!map || !interactionsRef.current) return;
    const prev = interactionsRef.current;
    interactionsRef.current = null;
    try {
      if (prev.doubleClickZoom) (map as any).doubleClickZoom?.enable?.();
      if (prev.boxZoom) (map as any).boxZoom?.enable?.();
      if (prev.dragPan) (map as any).dragPan?.enable?.();
      if (prev.keyboard) (map as any).keyboard?.enable?.();
      if (prev.touchZoomRotate) (map as any).touchZoomRotate?.enable?.();
    } catch {
      // ignore
    }
  }, [map]);

  // Курсор и listeners чрез Mapbox събития (подобно на картата с пожарите)
  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();

    const applyCursor = () => {
      try {
        const cc = map.getCanvas?.();
        if (!cc) return;
        (cc as HTMLCanvasElement).style.cursor = mode === "idle" ? "" : "crosshair";
      } catch {}
    };

    // при idle → чистим, връщаме интеракции
    if (mode === "idle") {
      applyCursor();
      unlockInteractions();
      setHint("");
      return;
    }

    // активен режим → блок интеракции и подсказка
    lockInteractions();
    applyCursor();
    setHint("Кликвай/тапвай, за да добавяш точки. Двоен клик/Enter за край. Десен клик/Backspace за назад. Esc за отказ.");

    // Интеграция с Mapbox Draw за полигон
    if (mode === "polygon") {
      try {
        // Ако вече има draw control – махаме го, за да зададем правилен режим
        if (drawRef.current) {
          try { map.removeControl(drawRef.current as any); } catch {}
          drawRef.current = null;
        }
        const draw = new MapboxDraw({
          displayControlsDefault: false,
          // On mobile, hide Draw controls; we provide a compact toolbar
          controls: isMobile ? {} : { polygon: true, trash: true },
          defaultMode: "draw_polygon",
        });
        map.addControl(draw as any, "top-right");
        drawRef.current = draw;
        try { (draw as any).changeMode && (draw as any).changeMode("draw_polygon"); } catch {}

        const syncFromDraw = () => {
          const data = draw.getAll();
          if (!data || !data.features || data.features.length === 0) {
            setPoints([]);
            return;
          }
          // Вземаме първия полигон и външния ринг
          const poly: any = data.features.find((f: any) => f.geometry?.type === "Polygon");
          if (!poly) return;
          const ring: [number, number][] = (poly.geometry as any).coordinates?.[0] || [];
          // махаме последната дублираща се точка (затваряне)
          const cleaned = ring.slice(0, ring.length > 1 ? ring.length - 1 : ring.length);
          setPoints(cleaned);
        };
        const onCreate = () => syncFromDraw();
        const onUpdate = () => syncFromDraw();
        const onDelete = () => setPoints([]);

        map.on("draw.create", onCreate as any);
        map.on("draw.update", onUpdate as any);
        map.on("draw.delete", onDelete as any);

        // Запазваме cleanup функции в ref за по-късно
        (drawRef as any).listeners = { onCreate, onUpdate, onDelete };
      } catch (e) {
        console.error("MapboxDraw init error", e);
      }
    }

    // DOM helpers (работят и върху маркери/попъпи)
    const toLngLat = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const ll = map.unproject([x, y]);
      return { lng: ll.lng, lat: ll.lat };
    };

    const onClick = (e: mapboxgl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      if (modeRef.current === "polygon" && drawRef.current) return; // Draw поема полигон

      if (modeRef.current === "polygon") {
        // Ако кликът е достатъчно близо до първата точка → подсказка за затваряне
        const pts = pointsRef.current;
        if (pts.length >= 3) {
          try {
            const p0 = pts[0];
            const a = map.project({ lng: p0[0], lat: p0[1] });
            const b = map.project({ lng, lat });
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < 12) {
              setHint("Полигон затворен. Натисни „Създай зона“ или Enter.");
              return;
            }
          } catch {}
        }

        setPoints((prev) => [...prev, [lng, lat]]);
        setHint((prev) =>
          (pointsRef.current.length + 1 >= 3)
            ? "Двоен клик или Enter за завършване. Десен клик/Backspace за назад."
            : "Добави още точки."
        );
      }
    };

    const onDomClick = (e: MouseEvent) => {
      // Ако използваме Mapbox Draw за полигон, не спираме събитията
      if (modeRef.current === "polygon" && drawRef.current) return;
      // В противен случай прихващаме събитието върху контейнера
      e.preventDefault();
      e.stopPropagation();
      const { lng, lat } = toLngLat(e);
      if (modeRef.current === "polygon") {
        const pts = pointsRef.current;
        if (pts.length >= 3) {
          try {
            const p0 = pts[0];
            const a = map.project({ lng: p0[0], lat: p0[1] });
            const b = map.project({ lng, lat });
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < 12) {
              setHint("Полигон затворен. Натисни „Създай зона“ или Enter.");
              return;
            }
          } catch {}
        }
        setPoints((prev) => [...prev, [lng, lat]]);
        setHint((prev) =>
          (pointsRef.current.length + 1 >= 3)
            ? "Двоен клик или Enter за завършване. Десен клик/Backspace за назад."
            : "Добави още точки."
        );
      }
    };

    const onMouseMove = (e: mapboxgl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      if (modeRef.current === "polygon" && drawRef.current) return; // Draw поема полигон
      if (modeRef.current === "polygon") {
        setCursor([lng, lat]);
      }
    };

    const onDomMouseMove = (e: MouseEvent) => {
      // Ако използваме Mapbox Draw за полигон, не спираме/обработваме DOM събитията
      if (modeRef.current === "polygon" && drawRef.current) return;
      const { lng, lat } = toLngLat(e);
      if (modeRef.current === "polygon") {
        setCursor([lng, lat]);
      }
    };

    const onDblClick = (_e: mapboxgl.MapMouseEvent) => {
      if (modeRef.current === "polygon" && drawRef.current) return; // Draw поема полигон
      if (modeRef.current === "polygon" && pointsRef.current.length >= 3) {
        createZone();
      }
    };

    const onDomDblClick = (e: MouseEvent) => {
      // Ако използваме Mapbox Draw за полигон, не спираме събитията
      if (modeRef.current === "polygon" && drawRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      if (modeRef.current === "polygon" && pointsRef.current.length >= 3) {
        createZone();
      }
    };

    const onContext = (_e: mapboxgl.MapMouseEvent) => {
      if (modeRef.current === "polygon" && drawRef.current) return; // Draw поема полигон
      if (modeRef.current !== "polygon") return;
      if (pointsRef.current.length === 0) return;
      setPoints((p) => p.slice(0, -1));
    };

    const onDomContext = (e: MouseEvent) => {
      if (modeRef.current !== "polygon") return;
      if (pointsRef.current.length === 0) return;
      // Ако Mapbox Draw е активен, оставяме събитията да минат към него
      if (drawRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      setPoints((p) => p.slice(0, -1));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const m = modeRef.current;
      if (m === "polygon") {
        if (e.key === "Escape") reset();
        if ((e.key === "Backspace" || e.key === "Delete") && pointsRef.current.length > 0) {
          e.preventDefault();
          setPoints((p) => p.slice(0, -1));
        }
        if ((e.key === "Enter" || e.key === "Return") && pointsRef.current.length >= 3) {
          e.preventDefault();
          createZone();
        }
      }
      // circle mode removed
    };

    // Mapbox събития (както при докладване на пожар) – за circle
    map.on("click", onClick as any);
    map.on("mousemove", onMouseMove as any);
    map.on("dblclick", onDblClick as any);
    map.on("contextmenu", onContext as any);
    window.addEventListener("keydown", onKeyDown);

    // DOM capture върху контейнера → работи и при клик върху HTML маркери/попъпи
    container.addEventListener("click", onDomClick, { capture: true });
    container.addEventListener("mousemove", onDomMouseMove, { capture: true });
    container.addEventListener("dblclick", onDomDblClick, { capture: true });
    container.addEventListener("contextmenu", onDomContext, { capture: true });

    const cleanup = () => {
      try {
        map.off("click", onClick as any);
        map.off("mousemove", onMouseMove as any);
        map.off("dblclick", onDblClick as any);
        map.off("contextmenu", onContext as any);
        window.removeEventListener("keydown", onKeyDown);
        container.removeEventListener("click", onDomClick, { capture: true } as any);
        container.removeEventListener("mousemove", onDomMouseMove, { capture: true } as any);
        container.removeEventListener("dblclick", onDomDblClick, { capture: true } as any);
        container.removeEventListener("contextmenu", onDomContext, { capture: true } as any);
        // премахваме draw ако е активен
        try {
          if (drawRef.current) {
            // изключваме draw listeners
            const lst: any = (drawRef as any).listeners;
            if (lst) {
              try { map.off("draw.create", lst.onCreate as any); } catch {}
              try { map.off("draw.update", lst.onUpdate as any); } catch {}
              try { map.off("draw.delete", lst.onDelete as any); } catch {}
            }
            map.removeControl(drawRef.current as any);
          }
        } catch {}
      } catch {}
      applyCursor();
      unlockInteractions();
      setCursor(null);
      setHint("");
    };
    return cleanup;
  }, [map, lockInteractions, unlockInteractions, mode]);

  // Превю слоеве: ensure + live update + cleanup (изключени, когато е активен MapboxDraw за полигон)
  useEffect(() => {
    if (!map) return;
    if (mode === "polygon" && drawRef.current) return; // draw се грижи за визуализацията

    const ensure = () => {
      if (!map || !map.isStyleLoaded()) return;
      const fc = previewGeojson;
      try {
        if (!map.getSource(PREVIEW_SRC)) {
          map.addSource(PREVIEW_SRC, { type: "geojson", data: fc });
        } else {
          (map.getSource(PREVIEW_SRC) as any)?.setData?.(fc);
        }

        if (!map.getLayer(PREVIEW_FILL)) {
          map.addLayer({
            id: PREVIEW_FILL,
            type: "fill",
            source: PREVIEW_SRC,
            filter: ["==", ["geometry-type"], "Polygon"],
            paint: { "fill-color": "#22c55e", "fill-opacity": 0.16 },
          });
        }
        if (!map.getLayer(PREVIEW_LINE)) {
          map.addLayer({
            id: PREVIEW_LINE,
            type: "line",
            source: PREVIEW_SRC,
            paint: { "line-color": "#16a34a", "line-width": 2, "line-opacity": 0.8 },
          });
        }
        if (!map.getLayer(PREVIEW_PTS)) {
          map.addLayer({
            id: PREVIEW_PTS,
            type: "circle",
            source: PREVIEW_SRC,
            filter: [
              "any",
              ["==", ["geometry-type"], "Point"],
              ["==", ["geometry-type"], "MultiPoint"],
            ],
            paint: {
              "circle-radius": 6,
              "circle-color": "#16a34a",
              "circle-stroke-color": "#064e3b",
              "circle-stroke-width": 1,
              "circle-opacity": 0.9,
            },
          });
        }

        // Винаги държим превю слоевете най-отгоре
        try {
          if (map.getLayer(PREVIEW_FILL)) (map as any).moveLayer(PREVIEW_FILL);
          if (map.getLayer(PREVIEW_LINE)) (map as any).moveLayer(PREVIEW_LINE);
          if (map.getLayer(PREVIEW_PTS)) (map as any).moveLayer(PREVIEW_PTS);
        } catch {}
      } catch {
        // ignore transient style errors
      }
    };

    const onStyle = () => ensure();
    map.on("style.load", onStyle as any);
    if (map.isStyleLoaded()) ensure();

    return () => {
      try {
        map.off("style.load", onStyle as any);
      } catch {}
    };
  }, [map, previewGeojson, mode]);

  // Live обновяване на GeoJSON-а
  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return;
    if (mode === "polygon" && drawRef.current) return; // draw mode → прескачаме
    try {
      (map.getSource(PREVIEW_SRC) as any)?.setData?.(previewGeojson);
    } catch {}
  }, [map, previewGeojson, mode]);

  // Премахване на превю слоевете при idle/Unmount
  useEffect(() => {
    if (!map) return;
    if (mode !== "idle") return;
    
    try {
      if (map.getLayer(PREVIEW_LINE)) map.removeLayer(PREVIEW_LINE);
      if (map.getLayer(PREVIEW_FILL)) map.removeLayer(PREVIEW_FILL);
      if (map.getLayer(PREVIEW_PTS)) map.removeLayer(PREVIEW_PTS);
      if (map.getSource(PREVIEW_SRC)) map.removeSource(PREVIEW_SRC);
    } catch {}
  }, [map, mode]);

  const createZone = useCallback(() => {
    if (!map) return;
    if (modeRef.current === "polygon") {
      const pts = pointsRef.current;
      if (pts.length < 3) return alert("Минимум 3 точки.");
      startTransition(async () => {
        const res = await fetch(`/api/fires/${fireId}/zones`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            geomType: "polygon",
            polygon: pts,
          }),
        }).then((r) => r.json());
        if (!res?.ok) return alert(res?.error || "Грешка");
        reset();
        onCreated?.();
      });
    }
  }, [map, fireId, title, description, onCreated]);

  function reset() {
    setMode("idle");
    setPoints([]);
    setCursor(null);
    setTitle("");
    setDescription("");
    setHint("");
  }

  return (
    <>
      {/* Desktop / non-drawing full panel OR any non-mobile */}
      {!(isMobile && mode === "polygon") && (
        <div className="bg-background/90 backdrop-blur-md border rounded-lg shadow-lg p-3 w-[320px] sm:w-[380px] space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Създай зона</div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={reset} title="Откажи">
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === "polygon" ? "default" : "outline"}
              onClick={() => {
                setMode("polygon");
                setHint("Кликвай върху картата, за да добавяш точки.");
              }}
            >
              <Pentagon className="h-4 w-4 mr-1" /> Полигон
            </Button>
            {mode === "polygon" && (
              <>
                {/* При активен Mapbox Draw скриваме локалното "Назад" и изчистваме чрез draw */}
                {!drawRef.current && (
                  <Button size="sm" variant="outline" onClick={() => setPoints((p) => p.slice(0, -1))} disabled={points.length === 0}>
                    <Undo2 className="h-4 w-4 mr-1" /> Назад
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (drawRef.current) {
                      try { (drawRef.current as any).deleteAll(); } catch {}
                    }
                    setPoints([]);
                  }}
                  disabled={(!drawRef.current && points.length === 0)}
                >
                  Изчисти
                </Button>
              </>
            )}
          </div>

          <Input placeholder="Име (по желание)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Описание (по желание)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />

          {mode === "polygon" && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <MousePointer2 className="h-3.5 w-3.5" />
              <span>
                Кликвай точки. Двоен клик/Enter за край. Десен клик/Backspace за назад. Точки: {points.length}
              </span>
            </div>
          )}

          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={createZone}
              disabled={isPending || (mode === "polygon" && points.length < 3)}
            >
              {isPending ? "Създаване…" : (<><Check className="h-4 w-4 mr-1" /> Създай зона</>)}
            </Button>
          </div>
        </div>
      )}

      {/* Mobile drawing: compact overlay controls, keep map fully usable */}
      {isMobile && mode === "polygon" && (
        <>
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-3 py-2 rounded-full border bg-background/90 backdrop-blur text-xs text-muted-foreground shadow">
            Точки: {points.length} — двоен тап за край
          </div>
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100]">
            <div className="flex items-center gap-2 bg-background/95 backdrop-blur px-3 py-2 rounded-full border shadow-lg">
              {!drawRef.current && (
                <Button size="sm" variant="ghost" onClick={() => setPoints((p) => p.slice(0, -1))} disabled={points.length === 0}>
                  Назад
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (drawRef.current) {
                    try { (drawRef.current as any).deleteAll(); } catch {}
                  }
                  setPoints([]);
                }}
                disabled={(!drawRef.current && points.length === 0)}
              >
                Изчисти
              </Button>
              <Button size="sm" onClick={createZone} disabled={isPending || points.length < 3}>
                Готово
              </Button>
              <Button size="sm" variant="outline" onClick={reset}>
                Откажи
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
