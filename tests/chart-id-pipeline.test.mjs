import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../scripts/converter-carta-para-app.ps1', import.meta.url))

function resolveChartId(name) {
  return execFileSync('pwsh', ['-NoProfile', '-File', script, '-ResolveChartIdOnly', name], { encoding: 'utf8' }).trim()
}

test('preserva variantes e séries alfanuméricas no identificador da carta', () => {
  assert.equal(resolveChartId('4020.KAP'), '4020')
  assert.equal(resolveChartId('4020A.KAP'), '4020A')
  assert.equal(resolveChartId('4101b.kap'), '4101B')
  assert.equal(resolveChartId('ba-1.kap'), 'BA-1')
  assert.equal(resolveChartId('hsb2.kap'), 'HSB2')
})

test('rejeita nomes que não identificam uma carta', () => {
  assert.throws(() => resolveChartId('../arquivo.kap'))
  assert.throws(() => resolveChartId('Transacoes.zip'))
})
