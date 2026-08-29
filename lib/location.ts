import * as Location from 'expo-location'

export interface Fix {
  lat: number
  lon: number
  alt: number | null
  velocidade: number | null
  rumo: number | null
  precisao: number | null
  timestampGps: number
}

function toFix(loc: Location.LocationObject): Fix {
  return {
    lat: loc.coords.latitude,
    lon: loc.coords.longitude,
    alt: loc.coords.altitude,
    velocidade: loc.coords.speed,
    rumo: loc.coords.heading,
    precisao: loc.coords.accuracy,
    timestampGps: loc.timestamp,
  }
}

export async function requestForegroundPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync()
  return status === 'granted'
}

let lastFix: Fix | null = null
let subscription: Location.LocationSubscription | null = null

export function getUltimoFix(): Fix | null {
  return lastFix
}

export async function getLastKnownFix(): Promise<Fix | null> {
  if (lastFix) return lastFix
  const loc = await Location.getLastKnownPositionAsync()
  return loc ? toFix(loc) : null
}

export async function startWatch(onFix: (fix: Fix) => void): Promise<void> {
  await stopWatch()
  subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000,
      distanceInterval: 1,
    },
    loc => {
      const fix = toFix(loc)
      lastFix = fix
      onFix(fix)
    }
  )
}

export async function stopWatch(): Promise<void> {
  subscription?.remove()
  subscription = null
}

const EARTH_RADIUS_M = 6371000

export function haversineDistanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export function bearingDeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  const brng = (Math.atan2(y, x) * 180) / Math.PI
  return (brng + 360) % 360
}
