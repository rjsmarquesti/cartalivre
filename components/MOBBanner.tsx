import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONTS, RADIUS } from '../constants/theme'
import { haversineDistanceM, bearingDeg } from '../lib/location'
import type { Fix } from '../lib/location'
import type { MobEvent } from '../lib/db'

function formatarDistancia(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(2)} km`
}

export default function MOBBanner({
  evento, fixAtual, onResolver,
}: {
  evento: MobEvent
  fixAtual: Fix | null
  onResolver: () => void
}) {
  const distancia = fixAtual ? haversineDistanceM({ lat: fixAtual.lat, lon: fixAtual.lon }, { lat: evento.lat, lon: evento.lon }) : null
  const rumo = fixAtual ? bearingDeg({ lat: fixAtual.lat, lon: fixAtual.lon }, { lat: evento.lat, lon: evento.lon }) : null

  return (
    <View style={s.box} accessibilityRole="alert">
      <Ionicons name="warning" size={20} color="#fff" />
      <View style={s.info}>
        <Text style={s.titulo}>Homem ao mar acionado</Text>
        <Text style={s.detalhe}>
          {distancia != null ? formatarDistancia(distancia) : '--'}
          {rumo != null ? `  ·  rumo ${Math.round(rumo)}°` : ''}
        </Text>
      </View>
      <TouchableOpacity
        style={s.btn}
        onPress={onResolver}
        accessibilityRole="button"
        accessibilityLabel="Marcar alerta de homem ao mar como resolvido"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={s.btnTxt}>Resolvido</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  info: { flex: 1 },
  titulo: { fontSize: FONTS.sm, fontWeight: '800', color: '#fff' },
  detalhe: { fontSize: FONTS.xs, color: '#FEE2E2', marginTop: 2 },
  btn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  btnTxt: { fontSize: FONTS.xs, fontWeight: '700', color: '#fff' },
})
