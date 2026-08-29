import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const layoutPath = new URL('../app/(tabs)/_layout.tsx', import.meta.url)
const mapPath = new URL('../app/(tabs)/mapa.tsx', import.meta.url)

test('inicia o servidor de tiles local no boot', async () => {
  const source = await readFile(layoutPath, 'utf8')
  assert.match(source, /import\s*\{\s*iniciarServidorTiles\s*\}\s*from\s*'\.\.\/\.\.\/lib\/tileServer'/)
  assert.match(source, /iniciarServidorTiles\(\)/)
})

test('só adiciona pontos GPS ao buffer quando existe trajeto ativo', async () => {
  const source = await readFile(mapPath, 'utf8')
  assert.match(source, /trackAtivoRef\.current/)
  assert.match(source, /if\s*\(trackAtivoRef\.current\s*&&[\s\S]*bufferRef\.current\.push/)
})

test('descarta pontos antigos ao iniciar e persiste o buffer no cleanup', async () => {
  const source = await readFile(mapPath, 'utf8')
  assert.match(source, /function iniciarGravacao\(\)[\s\S]*bufferRef\.current\s*=\s*\[\]/)
  assert.match(source, /return \(\) => \{[\s\S]*flushBuffer\(trackId\)/)
})
