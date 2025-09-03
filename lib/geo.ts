export type LatLng = { lat: number; lng: number };

const R = 6371000; // meters

export function haversineMeters(a: LatLng, b: LatLng) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return R * c;
}

// Геодезически кръг като GeoJSON Polygon (приблизение)
export function circlePolygon(center: LatLng, radiusM: number, steps = 64) {
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * 2 * Math.PI;
    const lat1 = (center.lat * Math.PI) / 180;
    const lng1 = (center.lng * Math.PI) / 180;
    const angDist = radiusM / R;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angDist) +
        Math.cos(lat1) * Math.sin(angDist) * Math.cos(bearing),
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angDist) * Math.cos(lat1),
        Math.cos(angDist) - Math.sin(lat1) * Math.sin(lat2),
      );

    coords.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }

  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coords],
    },
    properties: {},
  };
}

export function metersToReadable(m: number) {
  if (m < 1000) return `${Math.round(m)} м`;
  return `${(m / 1000).toFixed(m >= 5000 ? 0 : 1)} км`;
}

