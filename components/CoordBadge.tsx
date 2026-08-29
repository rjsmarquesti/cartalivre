import { View, Text, StyleSheet } from 'react-native'
import { COLORS, FONTS, RADIUS } from '../constants/theme'
import type { Fix } from '../lib/location'

function formatarCoord(v: number, positivo: string, negativo: string): string {
  const letra = v >= 0 ? positivo : negativo
  return `${Math.abs(v).toFixed(5)}°${letra}`
}

function formatarVelocidadeNos(msPorSegundo: number | null): string {
  if (msPorSegundo == null || msPorSegundo < 0) return '--'
  const nos = msPorSegundo * 1.94384
  return `${nos.toFixed(1)} nós`
}

export default function CoordBadge({ fix }: { fix: Fix | null }) {
  if (!fix) {
    return (
      <View style={s.box}>
        <Text style={s.txt}>Aguardando sinal GPS…</Text>
      </View>
    )
  }
  return (
    <View style={s.box}>
      <Text style={s.coord}>{formatarCoord(fix.lat, 'N', 'S')}  {formatarCoord(fix.lon, 'E', 'W')}</Text>
      <Text style={s.txt}>{formatarVelocidadeNos(fix.velocidade)}{fix.rumo != null ? `  ·  ${Math.round(fix.rumo)}°` : ''}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  box: {
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  coord: { fontSize: FONTS.sm, fontWeight: '700', color: '#fff' },
  txt: { fontSize: FONTS.xs, color: '#E2E8F0', marginTop: 2 },
})
