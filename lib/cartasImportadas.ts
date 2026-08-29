import * as DocumentPicker from 'expo-document-picker'
import { Directory, File, Paths } from 'expo-file-system'
import { unzip } from 'react-native-zip-archive'
import { validateManifest } from './dhnCatalog'
import { criarCartaImportada, deletarCartaImportada, getCartasImportadas } from './db'

const CARTAS_DIR = new Directory(Paths.document, 'cartas-importadas')

function garantirCartasDir(): void {
  if (!CARTAS_DIR.exists) CARTAS_DIR.create({ intermediates: true, idempotent: true })
}

// Caminho de sistema de arquivos puro (sem "file://"), formato que o
// servidor HTTP local (lib/tileServer.ts, baseado em Lighttpd) espera.
export function getCartasDirPath(): string {
  garantirCartasDir()
  return CARTAS_DIR.uri.replace(/^file:\/\//, '')
}

const listeners = new Set<() => void>()

export function subscribeCartasImportadas(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function notificar(): void {
  listeners.forEach(fn => fn())
}

export interface ImportResult {
  ok: boolean
  error?: string
  chartCount?: number
}

export async function importarCartaZip(): Promise<ImportResult> {
  const picked = await DocumentPicker.getDocumentAsync({ type: 'application/zip', copyToCacheDirectory: true })
  if (picked.canceled || !picked.assets?.[0]) return { ok: false }

  const zipUri = picked.assets[0].uri
  const tempDir = new Directory(Paths.cache, `import-tmp-${Date.now()}`)

  try {
    tempDir.create({ intermediates: true, idempotent: true })
    await unzip(zipUri, tempDir.uri.replace(/^file:\/\//, ''))

    const manifestFile = new File(tempDir, 'charts-manifest.json')
    if (!manifestFile.exists) return { ok: false, error: 'Zip inválido: charts-manifest.json não encontrado.' }

    let manifestJson: unknown
    try {
      manifestJson = JSON.parse(await manifestFile.text())
    } catch {
      return { ok: false, error: 'charts-manifest.json corrompido (JSON inválido).' }
    }

    const manifest = validateManifest(manifestJson)
    if (!manifest) return { ok: false, error: 'charts-manifest.json inválido — verifique se o pacote foi gerado corretamente.' }

    garantirCartasDir()

    let importadas = 0
    for (const chart of manifest.charts) {
      const origem = new Directory(tempDir, 'charts', chart.id)
      const destino = new Directory(CARTAS_DIR, chart.id)
      if (!origem.exists) continue // carta listada no manifest mas sem tiles no zip — pula

      if (destino.exists) destino.delete()
      await origem.move(destino)

      criarCartaImportada({
        id: chart.id,
        nome: chart.name,
        minLon: chart.bbox[0], minLat: chart.bbox[1], maxLon: chart.bbox[2], maxLat: chart.bbox[3],
        zoomMin: chart.minZoom, zoomMax: chart.maxZoom,
        tileCount: chart.tileCount, tamanhoBytes: chart.sizeBytes,
        caminhoLocal: destino.uri,
      })
      importadas++
    }

    if (importadas === 0) return { ok: false, error: 'Nenhuma carta do manifesto foi encontrada dentro do zip.' }

    notificar()
    return { ok: true, chartCount: importadas }
  } catch (e) {
    return { ok: false, error: 'Falha ao importar: ' + String(e) }
  } finally {
    if (tempDir.exists) tempDir.delete()
  }
}

export async function removerCartaImportada(id: string): Promise<void> {
  const destino = new Directory(CARTAS_DIR, id)
  if (destino.exists) destino.delete()
  deletarCartaImportada(id)
  notificar()
}

export { getCartasImportadas }
