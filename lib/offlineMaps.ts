import { OfflineManager, type LngLatBounds } from '@maplibre/maplibre-react-native'
import { MAPTILER_STYLE_URL, getSeamarkStyleUrl } from './tiles'
import { atualizarStatusAreaOffline, atualizarPackCamada, type CamadaOffline } from './db'

export interface BBox {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
}

// Estimativa client-side (a lib não expõe contagem de tiles antes do download).
// Usado só para mostrar uma faixa aproximada na UI antes de confirmar — o tamanho real
// é atualizado depois, a partir do que o próprio OfflineManager reporta.
export function estimarTiles(bbox: BBox, zoomMin: number, zoomMax: number): number {
  let total = 0
  for (let z = zoomMin; z <= zoomMax; z++) {
    const n = 2 ** z
    const x1 = Math.floor(((bbox.minLon + 180) / 360) * n)
    const x2 = Math.floor(((bbox.maxLon + 180) / 360) * n)
    const lat2rad = (lat: number) => (lat * Math.PI) / 180
    const y1 = Math.floor(((1 - Math.log(Math.tan(lat2rad(bbox.maxLat)) + 1 / Math.cos(lat2rad(bbox.maxLat))) / Math.PI) / 2) * n)
    const y2 = Math.floor(((1 - Math.log(Math.tan(lat2rad(bbox.minLat)) + 1 / Math.cos(lat2rad(bbox.minLat))) / Math.PI) / 2) * n)
    total += (Math.abs(x2 - x1) + 1) * (Math.abs(y2 - y1) + 1)
  }
  return total
}

const BYTES_POR_TILE_ESTIMADO = 18000 // ~18KB/tile, média para raster 256px comprimido

export function estimarTamanhoBytes(bbox: BBox, zoomMin: number, zoomMax: number): number {
  return estimarTiles(bbox, zoomMin, zoomMax) * BYTES_POR_TILE_ESTIMADO
}

// URL de style por camada — cada uma vira seu próprio OfflinePack, já que o
// OfflineManager desta versão da lib só aceita UMA styleURL por pacote (não um
// StyleSpecification combinado). O cache de tiles do MapLibre é compartilhado por
// URL, então isso também é o que permite o mapa ao vivo reaproveitar o que já foi
// baixado offline.
function getStyleUrlPorCamada(): Record<CamadaOffline, string> {
  return {
    base: MAPTILER_STYLE_URL,
    seamark: getSeamarkStyleUrl(),
  }
}

// Baixa cada camada pedida como um OfflinePack separado. As camadas são iniciadas em
// sequência (o await só espera o registro do pack, não o download completo — o
// download roda em paralelo pelo OfflineManager nativo, cada um reportando progresso
// pelo próprio listener) e o status da área só vira "completo" quando todas as
// camadas pedidas tiverem terminado (ver atualizarPackCamada em lib/db.ts).
export async function baixarAreaOffline(
  areaId: number,
  nomePack: string,
  bbox: BBox,
  zoomMin: number,
  zoomMax: number,
  camadas: CamadaOffline[],
  onProgress?: (percentual: number) => void
): Promise<void> {
  const bounds: LngLatBounds = [bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat]
  atualizarStatusAreaOffline(areaId, 'baixando')

  const progressoPorCamada: Partial<Record<CamadaOffline, number>> = {}
  function reportarProgresso() {
    const valores = Object.values(progressoPorCamada)
    if (valores.length === 0) return
    const media = valores.reduce((a, b) => a + b, 0) / camadas.length
    onProgress?.(media)
  }

  const styleUrlPorCamada = getStyleUrlPorCamada()
  for (const camada of camadas) {
    const styleUrl = styleUrlPorCamada[camada]
    if (!styleUrl) {
      console.warn(`Camada "${camada}" sem style URL configurada — pulando.`)
      continue
    }
    try {
      await OfflineManager.createPack(
        { mapStyle: styleUrl, bounds, minZoom: zoomMin, maxZoom: zoomMax, metadata: { areaId, nomePack, camada } },
        (pack, status) => {
          progressoPorCamada[camada] = status.percentage
          reportarProgresso()
          if (status.state === 'complete') {
            atualizarPackCamada(areaId, camada, pack.id, status.completedResourceSize)
          }
        },
        (_pack, err) => {
          atualizarStatusAreaOffline(areaId, 'erro')
          console.warn('Falha ao baixar camada offline', camada, nomePack, err)
        }
      )
    } catch (err) {
      atualizarStatusAreaOffline(areaId, 'erro')
      console.warn('Falha ao criar pacote offline', camada, nomePack, err)
    }
  }
}

export async function removerAreaOffline(packIds: Partial<Record<CamadaOffline, string>>): Promise<void> {
  for (const packId of Object.values(packIds)) {
    if (!packId) continue
    try {
      await OfflineManager.deletePack(packId)
    } catch (err) {
      console.warn('Falha ao remover pacote offline', packId, err)
    }
  }
}
