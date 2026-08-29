import { forwardRef, useImperativeHandle, useMemo, useRef, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import {
  Map, Camera, UserLocation, Marker, RasterSource, GeoJSONSource, Layer,
  type MapRef, type LngLatBounds,
} from '@maplibre/maplibre-react-native'
import { MAPTILER_STYLE_URL, SEAMARK_TILE_URL, BATHYMETRY_TILE_URL, SEAMARK_MAX_ZOOM, getLocalChartTileUrl, CamadasConfig } from '../lib/tiles'
import { getPortaServidor } from '../lib/tileServer'
import { COLORS } from '../constants/theme'
import type { Waypoint, RoutePoint, MobEvent } from '../lib/db'
import type { DhnChart } from '../lib/dhnCatalog'

const FALLBACK_STYLE = { version: 8 as const, sources: {}, layers: [] }

const WAYPOINT_COR: Record<string, string> = {
  generico: COLORS.primary,
  porto: '#0891B2',
  ancoragem: '#16A34A',
  perigo: COLORS.danger,
  combustivel: COLORS.warning,
}

export interface MapCanvasHandle {
  getVisibleBounds: () => Promise<{ minLat: number; maxLat: number; minLon: number; maxLon: number } | null>
}

export interface MapCanvasProps {
  camadas: CamadasConfig
  centro: [number, number]
  zoom?: number
  seguirPosicao?: boolean
  waypoints?: Waypoint[]
  rotaPontos?: RoutePoint[]
  mobEvento?: MobEvent | null
  onMapPress?: (coord: { lat: number; lon: number }) => void
  visibleCharts?: DhnChart[]
  onRegionChange?: (bounds: { minLon: number; minLat: number; maxLon: number; maxLat: number }, zoom: number) => void
}

const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas({
  camadas, centro, zoom = 13, seguirPosicao = false,
  waypoints = [], rotaPontos = [], mobEvento = null, onMapPress,
  visibleCharts = [],
  onRegionChange,
}, ref) {
  const mapRef = useRef<MapRef>(null)

  useImperativeHandle(ref, () => ({
    async getVisibleBounds() {
      if (!mapRef.current) return null
      const bounds: LngLatBounds = await mapRef.current.getBounds()
      const [west, south, east, north] = bounds
      return { minLat: south, maxLat: north, minLon: west, maxLon: east }
    },
  }))

  const handleRegionChange = useCallback(async () => {
    if (!onRegionChange || !mapRef.current) return
    try {
      const bounds: LngLatBounds = await mapRef.current.getBounds()
      if (bounds) {
        onRegionChange(
          { minLon: bounds[0], minLat: bounds[1], maxLon: bounds[2], maxLat: bounds[3] },
          await mapRef.current.getZoom()
        )
      }
    } catch { /* map não pronto */ }
  }, [onRegionChange])

  const rotaGeoJSON = useMemo(() => {
    if (rotaPontos.length < 2) return null
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: rotaPontos.map(p => [p.lon, p.lat]),
      },
      properties: {},
    }
  }, [rotaPontos])

  const porta = getPortaServidor()

  return (
    <Map
      ref={mapRef}
      style={s.map}
      mapStyle={MAPTILER_STYLE_URL || FALLBACK_STYLE}
      logo={false}
      attribution={false}
      onPress={(e: any) => {
        if (!onMapPress) return
        const lngLat = e?.nativeEvent?.lngLat
        if (Array.isArray(lngLat)) onMapPress({ lat: lngLat[1], lon: lngLat[0] })
      }}
      onRegionDidChange={handleRegionChange}
    >
      <Camera
        center={centro}
        zoom={zoom}
        duration={400}
        trackUserLocation={seguirPosicao ? 'course' : undefined}
      />

      <UserLocation animated accuracy heading />

      {camadas.cartasImportadas && porta > 0 && visibleCharts.map(chart => (
        <RasterSource
          key={`carta-${chart.id}`}
          id={`carta-${chart.id}`}
          tiles={[getLocalChartTileUrl(chart.id, porta)]}
          tileSize={256}
          maxzoom={chart.maxZoom}
          attribution="Carta importada pelo usuário — não redistribuída pelo app"
        >
          <Layer
            id={`carta-${chart.id}-layer`}
            type="raster"
            paint={{ 'raster-opacity': 1 }}
          />
        </RasterSource>
      ))}

      {camadas.seamarks && (
        <RasterSource id="seamark" tiles={[SEAMARK_TILE_URL]} tileSize={256} maxzoom={SEAMARK_MAX_ZOOM} attribution="© OpenSeaMap contributors">
          <Layer id="seamark-layer" type="raster" paint={{ 'raster-opacity': 1 }} />
        </RasterSource>
      )}

      {camadas.bathymetry && BATHYMETRY_TILE_URL && (
        <RasterSource id="bathymetry" tiles={[BATHYMETRY_TILE_URL]} tileSize={256} attribution="GEBCO">
          <Layer id="bathymetry-layer" type="raster" paint={{ 'raster-opacity': 0.6 }} />
        </RasterSource>
      )}

      {rotaGeoJSON && (
        <GeoJSONSource id="rota-atual" data={rotaGeoJSON}>
          <Layer id="rota-atual-linha" type="line" paint={{ 'line-color': COLORS.primary, 'line-width': 3, 'line-opacity': 0.9 }} />
        </GeoJSONSource>
      )}

      {waypoints.map(w => (
        <Marker key={`wp-${w.id}`} id={`wp-${w.id}`} lngLat={[w.lon, w.lat]}>
          <View style={[s.pin, { backgroundColor: WAYPOINT_COR[w.tipo] ?? COLORS.primary }]} />
        </Marker>
      ))}

      {mobEvento && (
        <Marker id="mob-ativo" lngLat={[mobEvento.lon, mobEvento.lat]}>
          <View style={[s.pin, s.pinMob]} />
        </Marker>
      )}
    </Map>
  )
})

export default MapCanvas

const s = StyleSheet.create({
  map: { flex: 1 },
  pin: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 2, elevation: 3,
  },
  pinMob: { backgroundColor: COLORS.danger, width: 22, height: 22, borderRadius: 11 },
})
