import { useCallback, useRef, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Modal, TextInput,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONTS, RADIUS } from '../../constants/theme'
import MapCanvas, { MapCanvasHandle } from '../../components/MapCanvas'
import { OFFLINE_ZOOM_DEFAULT, MAPTILER_KEY } from '../../lib/tiles'
import { estimarTiles, estimarTamanhoBytes, baixarAreaOffline, removerAreaOffline, BBox } from '../../lib/offlineMaps'
import {
  getAreasOffline, criarAreaOffline, deletarAreaOffline, getPackIds, getCamadasArea,
  OfflineArea, CamadaOffline,
} from '../../lib/db'

function formatarBytes(bytes: number | null): string {
  if (!bytes) return '--'
  const mb = bytes / (1024 * 1024)
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`
}

const CAMADA_LABEL: Record<CamadaOffline, string> = {
  base: 'Mapa base',
  seamark: 'Marcas náuticas',
}

const STATUS_INFO: Record<string, { label: string; cor: string }> = {
  pendente: { label: 'Pendente', cor: COLORS.textLight },
  baixando: { label: 'Baixando…', cor: COLORS.warning },
  completo: { label: 'Disponível offline', cor: COLORS.success },
  erro: { label: 'Falhou', cor: COLORS.danger },
}

export default function OfflineScreen() {
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapCanvasHandle>(null)
  const [areas, setAreas] = useState<OfflineArea[]>([])
  const [modalNovo, setModalNovo] = useState(false)
  const [bboxSelecionado, setBboxSelecionado] = useState<BBox | null>(null)
  const [nome, setNome] = useState('')
  const [incluirSeamark, setIncluirSeamark] = useState(true)

  function recarregar() { setAreas(getAreasOffline()) }
  useFocusEffect(useCallback(() => { recarregar() }, []))

  async function capturarAreaVisivel() {
    const bounds = await mapRef.current?.getVisibleBounds()
    if (!bounds) {
      Alert.alert('Não foi possível capturar a área', 'Aguarde o mapa carregar e tente novamente.')
      return
    }
    setBboxSelecionado(bounds)
    setModalNovo(true)
  }

  function confirmarDownload() {
    if (!bboxSelecionado) return
    if (!nome.trim()) {
      Alert.alert('Nome obrigatório', 'Dê um nome para esta área (ex: Baía de Guanabara).')
      return
    }
    if (!MAPTILER_KEY) {
      Alert.alert(
        'Chave do MapTiler não configurada',
        'Configure expo.extra.mapTilerKey no app.json antes de baixar áreas offline.'
      )
      return
    }
    const camadas: CamadaOffline[] = [
      'base',
      ...(incluirSeamark ? (['seamark'] as CamadaOffline[]) : []),
    ]
    const { min, max } = OFFLINE_ZOOM_DEFAULT
    const id = criarAreaOffline({
      nome: nome.trim(),
      minLat: bboxSelecionado.minLat, maxLat: bboxSelecionado.maxLat,
      minLon: bboxSelecionado.minLon, maxLon: bboxSelecionado.maxLon,
      zoomMin: min, zoomMax: max, camadas,
    })
    baixarAreaOffline(id, `area_${id}`, bboxSelecionado, min, max, camadas, () => recarregar())
    setModalNovo(false)
    setNome('')
    setBboxSelecionado(null)
    recarregar()
  }

  function confirmarExcluir(area: OfflineArea) {
    Alert.alert('Excluir área offline', `Remover "${area.nome}" e liberar o espaço ocupado?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive',
        onPress: async () => {
          await removerAreaOffline(getPackIds(area))
          deletarAreaOffline(area.id)
          recarregar()
        },
      },
    ])
  }

  const camadasSelecionadas = 1 + (incluirSeamark ? 1 : 0)
  const estimativaTiles = bboxSelecionado
    ? estimarTiles(bboxSelecionado, OFFLINE_ZOOM_DEFAULT.min, OFFLINE_ZOOM_DEFAULT.max) * camadasSelecionadas
    : 0
  const estimativaBytes = bboxSelecionado
    ? estimarTamanhoBytes(bboxSelecionado, OFFLINE_ZOOM_DEFAULT.min, OFFLINE_ZOOM_DEFAULT.max) * camadasSelecionadas
    : 0

  return (
    <View style={[s.container, { paddingTop: insets.top + 12 }]}>
      <Text style={s.title}>Áreas offline</Text>
      <Text style={s.subtitle}>Baixe uma região para navegar sem internet</Text>

      <View style={s.mapBox}>
        <MapCanvas ref={mapRef} camadas={{ seamarks: true, bathymetry: false, cartasImportadas: true }} centro={[-43.2, -22.9]} zoom={9} />
        <TouchableOpacity style={s.capturarBtn} onPress={capturarAreaVisivel} accessibilityRole="button" accessibilityLabel="Baixar área visível no mapa">
          <Ionicons name="cloud-download" size={16} color="#fff" />
          <Text style={s.capturarTxt}>Baixar área visível</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.aviso}>Escolha abaixo quais camadas incluir no pacote offline dessa área.</Text>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
        {areas.length === 0 ? (
          <View style={s.vazio}>
            <Ionicons name="cloud-download-outline" size={44} color={COLORS.textLight} />
            <Text style={s.vazioTxt}>Nenhuma área baixada</Text>
            <Text style={s.vazioSub}>Ajuste o mapa acima para a região desejada e toque em "Baixar área visível".</Text>
          </View>
        ) : areas.map(a => {
          const info = STATUS_INFO[a.status]
          const rotuloCamadas = getCamadasArea(a).map(c => CAMADA_LABEL[c]).join(' + ')
          return (
            <View key={a.id} style={s.card}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardNome}>{a.nome}</Text>
                <Text style={s.cardSub}>{rotuloCamadas} · {formatarBytes(a.tamanho_bytes)}</Text>
                <Text style={[s.cardStatus, { color: info.cor }]}>{info.label}</Text>
              </View>
              <TouchableOpacity onPress={() => confirmarExcluir(a)} style={s.trashBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          )
        })}
      </ScrollView>

      <Modal visible={modalNovo} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={[s.modal, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={s.modalTitle}>Baixar esta área</Text>
            <TextInput
              style={s.input}
              value={nome}
              onChangeText={setNome}
              placeholder="Nome da área (ex: Baía de Guanabara)"
              placeholderTextColor={COLORS.textLight}
            />

            <View style={s.camadaRow}>
              <Text style={s.camadaLabel}>Mapa base</Text>
              <Text style={s.camadaObrigatoria}>Sempre incluído</Text>
            </View>

            <TouchableOpacity
              style={s.camadaRow}
              onPress={() => setIncluirSeamark(v => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: incluirSeamark }}
              accessibilityLabel="Incluir marcas náuticas no pacote offline"
            >
              <Text style={s.camadaLabel}>Marcas náuticas (OpenSeaMap)</Text>
              <Ionicons name={incluirSeamark ? 'checkbox' : 'square-outline'} size={22} color={incluirSeamark ? COLORS.primary : COLORS.textLight} />
            </TouchableOpacity>

            <Text style={s.estimativa}>
              Estimativa: ~{estimativaTiles.toLocaleString('pt-BR')} tiles · {formatarBytes(estimativaBytes)}
            </Text>
            <View style={s.modalBtnRow}>
              <TouchableOpacity style={s.modalBtnCancelar} onPress={() => setModalNovo(false)}>
                <Text style={s.modalBtnCancelarTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnSalvar} onPress={confirmarDownload}>
                <Text style={s.modalBtnSalvarTxt}>Baixar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  title: { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.text, paddingHorizontal: 16 },
  subtitle: { fontSize: FONTS.sm, color: COLORS.textMuted, paddingHorizontal: 16, marginTop: 2, marginBottom: 10 },
  mapBox: { height: 220, marginHorizontal: 16, borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  capturarBtn: {
    position: 'absolute', bottom: 10, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.full,
  },
  capturarTxt: { color: '#fff', fontWeight: '700', fontSize: FONTS.sm },
  aviso: { fontSize: FONTS.xs, color: COLORS.textLight, paddingHorizontal: 16, marginTop: 8, textAlign: 'center' },
  vazio: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 30 },
  vazioTxt: { fontSize: FONTS.md, fontWeight: '700', color: COLORS.textMuted, marginTop: 16, textAlign: 'center' },
  vazioSub: { fontSize: FONTS.sm, color: COLORS.textLight, marginTop: 8, textAlign: 'center', lineHeight: 18 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.md, marginBottom: 10, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  cardNome: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.text },
  cardSub: { fontSize: FONTS.xs, color: COLORS.textMuted, marginTop: 2 },
  cardStatus: { fontSize: FONTS.xs, fontWeight: '700', marginTop: 4 },
  trashBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, padding: 20, gap: 10 },
  modalTitle: { fontSize: FONTS.lg, fontWeight: '800', color: COLORS.text },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: FONTS.base,
    color: COLORS.text, backgroundColor: COLORS.bg,
  },
  camadaRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, minHeight: 44,
  },
  camadaLabel: { fontSize: FONTS.base, color: COLORS.text },
  camadaObrigatoria: { fontSize: FONTS.xs, color: COLORS.textLight },
  estimativa: { fontSize: FONTS.xs, color: COLORS.textLight },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalBtnCancelar: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  modalBtnCancelarTxt: { fontSize: FONTS.md, fontWeight: '700', color: COLORS.textMuted },
  modalBtnSalvar: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  modalBtnSalvarTxt: { fontSize: FONTS.md, fontWeight: '700', color: '#fff' },
})
