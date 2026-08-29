import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const cartasPath = new URL('../lib/cartasImportadas.ts', import.meta.url)
const hookPath = new URL('../hooks/useDhnCharts.ts', import.meta.url)
const mapPath = new URL('../components/MapCanvas.tsx', import.meta.url)

test('notifica consumidores quando uma carta é importada ou removida', async () => {
  const [cartas, hook] = await Promise.all([readFile(cartasPath, 'utf8'), readFile(hookPath, 'utf8')])
  assert.match(cartas, /subscribeCartasImportadas/)
  assert.match(hook, /subscribeCartasImportadas/)
})

test('limpa o debounce ao desmontar o hook', async () => {
  const hook = await readFile(hookPath, 'utf8')
  assert.match(hook, /return\s*\(\)\s*=>[\s\S]*clearTimeout\(debounceTimer\.current\)/)
})

test('mudança de região consulta o zoom real do mapa', async () => {
  const map = await readFile(mapPath, 'utf8')
  assert.match(map, /await\s+mapRef\.current\.getZoom\(\)/)
})
test('liga o catálogo dinâmico à tela principal do mapa', async () => {
  const screen = await readFile(new URL('../app/(tabs)/mapa.tsx', import.meta.url), 'utf8')
  assert.match(screen, /visibleCharts=\{dhn\.visibleCharts\}/)
  assert.match(screen, /onRegionChange=\{dhn\.onViewportChange\}/)
})
