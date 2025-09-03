"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Crosshair, MapPin, LocateFixed } from "lucide-react"
import { cn } from "@/lib/utils"
// Ensure Mapbox styles are loaded in the client bundle
import "mapbox-gl/dist/mapbox-gl.css"
import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css"

export default function MapView() {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const geolocateRef = React.useRef<any>(null)
  const mapRef = React.useRef<any>(null)
  const [ready, setReady] = React.useState(false)
  const [status, setStatus] = React.useState<string | null>("Зареждане на карта…")

  React.useEffect(() => {
    let mapboxgl: any
    let geocoderCtor: any

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) {
      setStatus("Липсва MAPBOX токен. Добави NEXT_PUBLIC_MAPBOX_TOKEN в .env.")
      return
    }

    let cancelled = false

    async function init() {
      try {
        // Dynamic imports to avoid SSR issues
        const gl = await import("mapbox-gl")
        mapboxgl = gl.default ?? gl
        const geocoderModule = await import("@mapbox/mapbox-gl-geocoder")
        geocoderCtor = geocoderModule.default ?? geocoderModule

        mapboxgl.accessToken = token

        if (cancelled || !containerRef.current) return

        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [23.3219, 42.6977], // Sofia as a friendly default
          zoom: 10,
          attributionControl: true,
        })

        mapRef.current = map

        // Controls
        const nav = new mapboxgl.NavigationControl({ visualizePitch: true })
        map.addControl(nav, "top-right")

        const geolocate = new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserHeading: true,
          showAccuracyCircle: true,
        })
        geolocateRef.current = geolocate
        map.addControl(geolocate, "top-right")

        // Search control
        const geocoder = new geocoderCtor({
          accessToken: token,
          mapboxgl,
          placeholder: "Търси адрес, място или град",
          marker: true,
          proximity: { longitude: 23.3219, latitude: 42.6977 },
          flyTo: true,
        })
        map.addControl(geocoder, "top-left")

        map.on("load", () => {
          if (cancelled) return
          setReady(true)
          setStatus(null)
          // In case initial size calc was off
          try { map.resize() } catch {}
        })

        geolocate.on("geolocate", () => {
          setStatus("Локализацията е успешна.")
        })
        geolocate.on("error", async (e: any) => {
          setStatus("Опит за алтернативна геолокация…")
          // Fallback to browser Geolocation API
          try {
            await new Promise<void>((resolve, reject) => {
              if (!navigator.geolocation) return reject(new Error("Геолокацията не се поддържа."))
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const { longitude, latitude } = pos.coords
                  try {
                    mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 14 })
                    // Add or move a marker
                    new mapboxgl.Marker().setLngLat([longitude, latitude]).addTo(mapRef.current)
                    setStatus("Локализация по браузър е успешна.")
                  } catch {}
                  resolve()
                },
                (err) => {
                  setStatus("Няма разрешение за достъп до локация или е изключен GPS.")
                  reject(err)
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
              )
            })
          } catch {}
        })
      } catch (err) {
        console.error(err)
        setStatus("Проблем при инициализация на картата. Виж конзолата.")
      }
    }

    init()

    return () => {
      cancelled = true
      if (mapRef.current) {
        try {
          mapRef.current.remove()
        } catch {}
      }
    }
  }, [])

  const handleLocate = React.useCallback(() => {
    if (geolocateRef.current) {
      geolocateRef.current.trigger()
      setStatus("Опит за локализиране…")
    } else {
      setStatus("Контролът за геолокация не е готов.")
    }
  }, [])

  return (
    <div className="relative h-[calc(100vh-64px)] min-h-[560px] w-full">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Gradient edges for subtle depth */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_50%_at_50%_-20%,rgba(0,0,0,0.08),transparent_70%)]" />

      {/* Overlay UI */}
      <div className="absolute left-4 bottom-4 right-4 sm:left-6 sm:bottom-6 sm:right-auto z-10 max-w-sm">
        <Card className={cn("backdrop-blur bg-background/80 border-border/60 shadow-lg") }>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Карта и локация
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Button onClick={handleLocate} className="gap-2">
              <LocateFixed className="h-4 w-4" /> Използвай моята локация
            </Button>
            {status && (
              <div className="text-sm text-muted-foreground">{status}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
