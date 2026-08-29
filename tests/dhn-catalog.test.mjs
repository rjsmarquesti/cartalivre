import assert from 'node:assert/strict'
import test from 'node:test'
import { getVisibleCharts, validateManifest } from '../lib/dhnCatalog.ts'

const chart = { id: '1511', name: 'Carta 1511', bbox: [-43.24, -23, -43.04, -22.86], minZoom: 10, maxZoom: 16, tileCount: 15, sizeBytes: 471596 }
const manifest = { version: 1, generatedAt: '2026-08-27T00:00:00Z', chartCount: 1, charts: [chart] }

test('aceita manifesto DHN íntegro e recalcula chartCount', () => {
  const result = validateManifest({ ...manifest, chartCount: 999 })
  assert.equal(result?.chartCount, 1)
})

test('rejeita bbox inválido e IDs duplicados', () => {
  assert.equal(validateManifest({ ...manifest, charts: [{ ...chart, bbox: [0, 0, 0, 0] }] }), null)
  assert.equal(validateManifest({ ...manifest, charts: [chart, chart] }), null)
})

test('seleciona somente cartas que cruzam a área visível e o zoom', () => {
  assert.deepEqual(getVisibleCharts(manifest, { minLon: -43.3, minLat: -23.1, maxLon: -43, maxLat: -22.8 }, 12).map(c => c.id), ['1511'])
  assert.equal(getVisibleCharts(manifest, { minLon: -50, minLat: -30, maxLon: -49, maxLat: -29 }, 12).length, 0)
  assert.equal(getVisibleCharts(manifest, { minLon: -43.3, minLat: -23.1, maxLon: -43, maxLat: -22.8 }, 8).length, 0)
})
