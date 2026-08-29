export interface DhnChart {
  id: string
  name: string
  edition?: string
  bbox: [number, number, number, number]
  minZoom: number
  maxZoom: number
  tileCount: number
  sizeBytes: number
  checksum?: string
}

export interface DhnManifest {
  version: number
  generatedAt: string
  chartCount: number
  charts: DhnChart[]
}

export interface ViewBounds { minLon: number; minLat: number; maxLon: number; maxLat: number }

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isValidChart(value: unknown): value is DhnChart {
  if (!value || typeof value !== 'object') return false
  const chart = value as Partial<DhnChart>
  if (!chart.id || !/^\d+$/.test(chart.id) || typeof chart.name !== 'string') return false
  if (!Array.isArray(chart.bbox) || chart.bbox.length !== 4 || !chart.bbox.every(isFiniteNumber)) return false
  const [minLon, minLat, maxLon, maxLat] = chart.bbox
  if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90) return false
  if (minLon >= maxLon || minLat >= maxLat) return false
  if (!isFiniteNumber(chart.minZoom) || !isFiniteNumber(chart.maxZoom) || chart.minZoom > chart.maxZoom) return false
  return true
}

export function validateManifest(value: unknown): DhnManifest | null {
  if (!value || typeof value !== 'object') return null
  const manifest = value as Partial<DhnManifest>
  if (manifest.version !== 1 || typeof manifest.generatedAt !== 'string' || !Array.isArray(manifest.charts)) return null
  if (!manifest.charts.every(isValidChart)) return null
  const ids = new Set(manifest.charts.map(chart => chart.id))
  if (ids.size !== manifest.charts.length) return null
  return {
    version: 1,
    generatedAt: manifest.generatedAt,
    chartCount: manifest.charts.length,
    charts: manifest.charts.map(chart => ({
      ...chart,
      tileCount: isFiniteNumber(chart.tileCount) ? chart.tileCount : 0,
      sizeBytes: isFiniteNumber(chart.sizeBytes) ? chart.sizeBytes : 0,
    })),
  }
}

export function getVisibleCharts(manifest: DhnManifest, bounds: ViewBounds, zoom: number): DhnChart[] {
  return manifest.charts.filter(chart => {
    if (zoom < chart.minZoom || zoom > chart.maxZoom) return false
    return !(chart.bbox[2] < bounds.minLon || chart.bbox[0] > bounds.maxLon || chart.bbox[3] < bounds.minLat || chart.bbox[1] > bounds.maxLat)
  })
}
