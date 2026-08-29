import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONTS, RADIUS } from '../../constants/theme'
import { getTracks, getTrackPoints, deletarTrack, Track } from '../../lib/db'

function formatarData(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatarDistancia(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`
}

function formatarDuracao(inicio: number, fim: number | null): string {
  const fimReal = fim ?? Date.now()
  const min = Math.round((fimReal - inicio) / 60000)
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)}h ${min % 60}min`
}

export default function HistoricoScreen() {
  const insets = useSafeAreaInsets()
  const [tracks, setTracks] = useState<Track[]>([])
  const [expandido, setExpandido] = useState<number | null>(null)
  const [pontosCount, setPontosCount] = useState<number | null>(null)

  useFocusEffect(useCallback(() => {
    setTracks(getTracks())
  }, []))

  function toggle(t: Track) {
    if (expandido === t.id) { setExpandido(null); return }
    setPontosCount(getTrackPoints(t.id).length)
    setExpandido(t.id)
  }

  function confirmarExcluir(id: number) {
    Alert.alert('Excluir trajeto', 'Deseja excluir este registro de navegação?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => { deletarTrack(id); setTracks(getTracks()); if (expandido === id) setExpandido(null) } },
    ])
  }

  return (
    <View style={[s.container, { paddingTop: insets.top + 12 }]}>
      <Text style={s.title}>Histórico</Text>
      <Text style={s.subtitle}>Trajetos gravados neste aparelho</Text>

      {tracks.length === 0 ? (
        <View style={s.vazio}>
          <Ionicons name="time-outline" size={48} color={COLORS.textLight} />
          <Text style={s.vazioTxt}>Nenhum trajeto gravado ainda</Text>
          <Text style={s.vazioSub}>Toque em "Gravar trajeto" na tela do mapa para começar a registrar sua navegação.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
          {tracks.map(t => {
            const aberto = expandido === t.id
            return (
              <TouchableOpacity key={t.id} style={s.card} onPress={() => toggle(t)} activeOpacity={0.8}>
                <View style={s.cardHeader}>
                  <View style={[s.iconBox, { backgroundColor: (t.ativo ? COLORS.warning : COLORS.primary) + '20' }]}>
                    <Ionicons name={t.ativo ? 'radio-button-on' : 'navigate'} size={18} color={t.ativo ? COLORS.warning : COLORS.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.cardNome}>{t.nome}</Text>
                    <Text style={s.cardData}>{formatarData(t.iniciado_em)} · {formatarDistancia(t.distancia_m)} · {formatarDuracao(t.iniciado_em, t.finalizado_em)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => confirmarExcluir(t.id)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={s.trashBtn}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                  <Ionicons name={aberto ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textLight} style={{ marginLeft: 8 }} />
                </View>

                {aberto && (
                  <View style={s.detalhe}>
                    <Text style={s.detalheTxt}>Pontos GPS registrados: {pontosCount ?? '--'}</Text>
                    <Text style={s.detalheTxt}>Distância total: {formatarDistancia(t.distancia_m)}</Text>
                    {t.ativo === 1 && <Text style={[s.detalheTxt, { color: COLORS.warning, fontWeight: '700' }]}>Gravação em andamento</Text>}
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  title: { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.text, paddingHorizontal: 16 },
  subtitle: { fontSize: FONTS.sm, color: COLORS.textMuted, paddingHorizontal: 16, marginTop: 2, marginBottom: 12 },
  vazio: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  vazioTxt: { fontSize: FONTS.md, fontWeight: '700', color: COLORS.textMuted, marginTop: 16, textAlign: 'center' },
  vazioSub: { fontSize: FONTS.sm, color: COLORS.textLight, marginTop: 8, textAlign: 'center', lineHeight: 18 },
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, marginBottom: 10, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 40, height: 40, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  cardNome: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.text },
  cardData: { fontSize: FONTS.xs, color: COLORS.textLight, marginTop: 2 },
  trashBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  detalhe: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 4 },
  detalheTxt: { fontSize: FONTS.sm, color: COLORS.text },
})
