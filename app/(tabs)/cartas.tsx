import { useCallback, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONTS, RADIUS } from '../../constants/theme'
import { importarCartaZip, removerCartaImportada, getCartasImportadas } from '../../lib/cartasImportadas'
import type { CartaImportada } from '../../lib/db'

function formatarBytes(bytes: number): string {
  if (!bytes) return '--'
  const mb = bytes / (1024 * 1024)
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`
}

export default function CartasScreen() {
  const insets = useSafeAreaInsets()
  const [cartas, setCartas] = useState<CartaImportada[]>([])
  const [importando, setImportando] = useState(false)

  function recarregar() { setCartas(getCartasImportadas()) }
  useFocusEffect(useCallback(() => { recarregar() }, []))

  async function handleImportar() {
    setImportando(true)
    try {
      const result = await importarCartaZip()
      if (result.ok) {
        recarregar()
        if (result.chartCount) {
          Alert.alert('Carta importada', `${result.chartCount} carta(s) adicionada(s) com sucesso.`)
        }
      } else if (result.error) {
        Alert.alert('Não foi possível importar', result.error)
      }
    } finally {
      setImportando(false)
    }
  }

  function confirmarRemover(carta: CartaImportada) {
    Alert.alert('Remover carta', `Remover "${carta.nome}" e liberar o espaço ocupado?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive',
        onPress: async () => { await removerCartaImportada(carta.id); recarregar() },
      },
    ])
  }

  return (
    <View style={[s.container, { paddingTop: insets.top + 12 }]}>
      <Text style={s.title}>Cartas importadas</Text>
      <Text style={s.subtitle}>Importe o pacote gerado a partir da sua própria carta</Text>

      <TouchableOpacity
        style={[s.importarBtn, importando && s.importarBtnDisabled]}
        onPress={handleImportar}
        disabled={importando}
        accessibilityRole="button"
        accessibilityLabel="Importar carta"
      >
        {importando
          ? <ActivityIndicator color="#fff" />
          : <>
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={s.importarTxt}>Importar carta (.zip)</Text>
            </>
        }
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
        {cartas.length === 0 ? (
          <View style={s.vazio}>
            <Ionicons name="layers-outline" size={44} color={COLORS.textLight} />
            <Text style={s.vazioTxt}>Nenhuma carta importada</Text>
            <Text style={s.vazioSub}>
              Gere o pacote da sua carta no computador usando a ferramenta de conversão
              fornecida separadamente, depois toque em "Importar carta" acima.
            </Text>
          </View>
        ) : cartas.map(c => (
          <View key={c.id} style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardNome}>{c.nome}</Text>
              <Text style={s.cardSub}>{c.tile_count.toLocaleString('pt-BR')} tiles · {formatarBytes(c.tamanho_bytes)}</Text>
              <Text style={s.cardSub}>Zoom {c.zoom_min}–{c.zoom_max}</Text>
            </View>
            <TouchableOpacity onPress={() => confirmarRemover(c)} style={s.trashBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  title: { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.text, paddingHorizontal: 16 },
  subtitle: { fontSize: FONTS.sm, color: COLORS.textMuted, paddingHorizontal: 16, marginTop: 2, marginBottom: 12 },
  importarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, backgroundColor: COLORS.primary,
    paddingVertical: 14, borderRadius: RADIUS.md,
  },
  importarBtnDisabled: { opacity: 0.6 },
  importarTxt: { color: '#fff', fontWeight: '700', fontSize: FONTS.md },
  vazio: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 30 },
  vazioTxt: { fontSize: FONTS.md, fontWeight: '700', color: COLORS.textMuted, marginTop: 16, textAlign: 'center' },
  vazioSub: { fontSize: FONTS.sm, color: COLORS.textLight, marginTop: 8, textAlign: 'center', lineHeight: 18 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.md, marginBottom: 10, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  cardNome: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.text },
  cardSub: { fontSize: FONTS.xs, color: COLORS.textMuted, marginTop: 2 },
  trashBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
})
