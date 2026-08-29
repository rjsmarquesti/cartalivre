import { getCartasImportadas } from './db'
import type { DhnManifest } from './dhnCatalog'

let manifestCache: DhnManifest | null = null

/**
 * Monta o manifesto a partir das cartas já importadas e gravadas localmente —
 * sem rede, sem TTL, já que os dados estão 100% completos no dispositivo.
 */
export function buildManifestFromImportedCharts(): DhnManifest {
  const cartas = getCartasImportadas()
  const manifest: DhnManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    chartCount: cartas.length,
    charts: cartas.map(c => ({
      id: c.id,
      name: c.nome,
      bbox: [c.min_lon, c.min_lat, c.max_lon, c.max_lat],
      minZoom: c.zoom_min,
      maxZoom: c.zoom_max,
      tileCount: c.tile_count,
      sizeBytes: c.tamanho_bytes,
    })),
  }
  manifestCache = manifest
  return manifest
}

/**
 * Retorna manifesto cacheado (síncrono). Útil para UI que já carregou.
 */
export function getCachedManifest(): DhnManifest | null {
  return manifestCache
}

export function clearManifestCache(): void {
  manifestCache = null
}
