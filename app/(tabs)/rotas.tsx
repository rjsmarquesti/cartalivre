import { useCallback, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONTS, RADIUS } from '../../constants/theme'
import { getUltimoFix } from '../../lib/location'
import {
  getWaypoints, criarWaypoint, deletarWaypoint,
  getRotas, criarRota, deletarRota, getRotaComPontos, adicionarPontoRota, removerPontoRota,
  Waypoint, Route, RoutePoint, WaypointTipo,
} from '../../lib/db'

const TIPO_INFO: Record<WaypointTipo, { label: string; icon: string; cor: string }> = {
  generico:    { label: 'Genérico',    icon: 'pin',            cor: COLORS.primary },
  porto:       { label: 'Porto',       icon: 'boat',           cor: '#0891B2' },
  ancoragem:   { label: 'Ancoragem',   icon: 'anchor',         cor: '#16A34A' },
  perigo:      { label: 'Perigo',      icon: 'warning',        cor: COLORS.danger },
  combustivel: { label: 'Combustível', icon: 'water',          cor: COLORS.warning },
}

export default function RotasScreen() {
  const insets = useSafeAreaInsets()
  const [aba, setAba] = useState<'rotas' | 'waypoints'>('rotas')
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [rotas, setRotas] = useState<Route[]>([])
  const [rotaExpandida, setRotaExpandida] = useState<number | null>(null)
  const [pontosRota, setPontosRota] = useState<RoutePoint[]>([])

  const [modalWaypoint, setModalWaypoint] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoTipo, setNovoTipo] = useState<WaypointTipo>('generico')

  const [modalRota, setModalRota] = useState(false)
  const [nomeRota, setNomeRota] = useState('')

  const [modalAddPonto, setModalAddPonto] = useState<number | null>(null)

  function recarregar() {
    setWaypoints(getWaypoints())
    setRotas(getRotas())
  }

  useFocusEffect(useCallback(() => { recarregar() }, []))

  function abrirRota(id: number) {
    if (rotaExpandida === id) { setRotaExpandida(null); return }
    const { pontos } = getRotaComPontos(id)
    setPontosRota(pontos)
    setRotaExpandida(id)
  }

  function salvarWaypoint() {
    const fix = getUltimoFix()
    if (!fix) {
      Alert.alert('Sem posição GPS', 'Aguarde o app obter sua posição atual antes de salvar um waypoint.')
      return
    }
    if (!novoNome.trim()) {
      Alert.alert('Nome obrigatório', 'Dê um nome para este ponto.')
      return
    }
    criarWaypoint(novoNome.trim(), novoTipo, fix.lat, fix.lon)
    setNovoNome('')
    setNovoTipo('generico')
    setModalWaypoint(false)
    recarregar()
  }

  function confirmarDeletarWaypoint(id: number) {
    Alert.alert('Excluir waypoint', 'Deseja excluir este ponto salvo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => { deletarWaypoint(id); recarregar() } },
    ])
  }

  function salvarRota() {
    if (!nomeRota.trim()) {
      Alert.alert('Nome obrigatório', 'Dê um nome para esta rota.')
      return
    }
    criarRota(nomeRota.trim())
    setNomeRota('')
    setModalRota(false)
    recarregar()
  }

  function confirmarDeletarRota(id: number) {
    Alert.alert('Excluir rota', 'Deseja excluir esta rota e todos os seus pontos?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => { deletarRota(id); if (rotaExpandida === id) setRotaExpandida(null); recarregar() } },
    ])
  }

  function adicionarWaypointNaRota(rotaId: number, wp: Waypoint) {
    adicionarPontoRota(rotaId, wp.lat, wp.lon, wp.nome, wp.id)
    const { pontos } = getRotaComPontos(rotaId)
    setPontosRota(pontos)
    setModalAddPonto(null)
  }

  function adicionarPosicaoAtualNaRota(rotaId: number) {
    const fix = getUltimoFix()
    if (!fix) {
      Alert.alert('Sem posição GPS', 'Aguarde o app obter sua posição atual.')
      return
    }
    adicionarPontoRota(rotaId, fix.lat, fix.lon, 'Posição atual')
    const { pontos } = getRotaComPontos(rotaId)
    setPontosRota(pontos)
    setModalAddPonto(null)
  }

  function removerPonto(pontoId: number, rotaId: number) {
    removerPontoRota(pontoId)
    const { pontos } = getRotaComPontos(rotaId)
    setPontosRota(pontos)
  }

  return (
    <View style={[s.container, { paddingTop: insets.top + 12 }]}>
      <Text style={s.title}>Rotas e waypoints</Text>

      <View style={s.tabRow}>
        <TouchableOpacity style={[s.tabBtn, aba === 'rotas' && s.tabBtnAtivo]} onPress={() => setAba('rotas')}>
          <Text style={[s.tabTxt, aba === 'rotas' && s.tabTxtAtivo]}>Rotas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabBtn, aba === 'waypoints' && s.tabBtnAtivo]} onPress={() => setAba('waypoints')}>
          <Text style={[s.tabTxt, aba === 'waypoints' && s.tabTxtAtivo]}>Waypoints</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}>
        {aba === 'waypoints' ? (
          waypoints.length === 0 ? (
            <View style={s.vazio}>
              <Ionicons name="pin-outline" size={44} color={COLORS.textLight} />
              <Text style={s.vazioTxt}>Nenhum waypoint salvo</Text>
              <Text style={s.vazioSub}>Marque portos, ancoragens e pontos de perigo para usar nas suas rotas.</Text>
            </View>
          ) : waypoints.map(w => {
            const info = TIPO_INFO[w.tipo]
            return (
              <View key={w.id} style={s.card}>
                <View style={[s.iconBox, { backgroundColor: info.cor + '20' }]}>
                  <Ionicons name={info.icon as any} size={18} color={info.cor} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.cardNome}>{w.nome}</Text>
                  <Text style={s.cardSub}>{info.label} · {w.lat.toFixed(4)}, {w.lon.toFixed(4)}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => confirmarDeletarWaypoint(w.id)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={s.trashBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Excluir waypoint ${w.nome}`}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            )
          })
        ) : (
          rotas.length === 0 ? (
            <View style={s.vazio}>
              <Ionicons name="navigate-outline" size={44} color={COLORS.textLight} />
              <Text style={s.vazioTxt}>Nenhuma rota criada</Text>
              <Text style={s.vazioSub}>Crie uma rota e adicione waypoints em sequência para planejar sua navegação.</Text>
            </View>
          ) : rotas.map(r => {
            const aberta = rotaExpandida === r.id
            return (
              <View key={r.id} style={s.card}>
                <TouchableOpacity style={s.cardHeader} onPress={() => abrirRota(r.id)} activeOpacity={0.8}>
                  <View style={[s.iconBox, { backgroundColor: r.cor + '20' }]}>
                    <Ionicons name="navigate" size={18} color={r.cor} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.cardNome}>{r.nome}</Text>
                  </View>
                  <TouchableOpacity onPress={() => confirmarDeletarRota(r.id)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={s.trashBtn}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                  <Ionicons name={aberta ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textLight} style={{ marginLeft: 8 }} />
                </TouchableOpacity>

                {aberta && (
                  <View style={s.detalhe}>
                    {pontosRota.length === 0 ? (
                      <Text style={s.pontoVazio}>Nenhum ponto adicionado ainda.</Text>
                    ) : pontosRota.map((p, i) => (
                      <View key={p.id} style={s.pontoRow}>
                        <Text style={s.pontoOrdem}>{i + 1}</Text>
                        <Text style={s.pontoNome} numberOfLines={1}>{p.nome ?? `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`}</Text>
                        <TouchableOpacity onPress={() => removerPonto(p.id, r.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
                        </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity style={s.addPontoBtn} onPress={() => setModalAddPonto(r.id)}>
                      <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
                      <Text style={s.addPontoTxt}>Adicionar ponto</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )
          })
        )}
      </ScrollView>

      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + 16 }]}
        onPress={() => (aba === 'waypoints' ? setModalWaypoint(true) : setModalRota(true))}
        accessibilityRole="button"
        accessibilityLabel={aba === 'waypoints' ? 'Novo waypoint' : 'Nova rota'}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      {/* Modal: novo waypoint */}
      <Modal visible={modalWaypoint} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.overlay}>
            <View style={[s.modal, { paddingBottom: insets.bottom + 16 }]}>
              <Text style={s.modalTitle}>Novo waypoint</Text>
              <Text style={s.modalSub}>Salva sua posição GPS atual como um ponto.</Text>
              <TextInput
                style={s.input}
                value={novoNome}
                onChangeText={setNovoNome}
                placeholder="Nome do ponto"
                placeholderTextColor={COLORS.textLight}
              />
              <View style={s.tipoRow}>
                {(Object.keys(TIPO_INFO) as WaypointTipo[]).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.tipoChip, novoTipo === t && { backgroundColor: TIPO_INFO[t].cor + '25', borderColor: TIPO_INFO[t].cor }]}
                    onPress={() => setNovoTipo(t)}
                  >
                    <Ionicons name={TIPO_INFO[t].icon as any} size={14} color={TIPO_INFO[t].cor} />
                    <Text style={s.tipoChipTxt}>{TIPO_INFO[t].label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.modalBtnRow}>
                <TouchableOpacity style={s.modalBtnCancelar} onPress={() => setModalWaypoint(false)}>
                  <Text style={s.modalBtnCancelarTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.modalBtnSalvar} onPress={salvarWaypoint}>
                  <Text style={s.modalBtnSalvarTxt}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: nova rota */}
      <Modal visible={modalRota} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.overlay}>
            <View style={[s.modal, { paddingBottom: insets.bottom + 16 }]}>
              <Text style={s.modalTitle}>Nova rota</Text>
              <TextInput
                style={s.input}
                value={nomeRota}
                onChangeText={setNomeRota}
                placeholder="Nome da rota"
                placeholderTextColor={COLORS.textLight}
              />
              <View style={s.modalBtnRow}>
                <TouchableOpacity style={s.modalBtnCancelar} onPress={() => setModalRota(false)}>
                  <Text style={s.modalBtnCancelarTxt}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.modalBtnSalvar} onPress={salvarRota}>
                  <Text style={s.modalBtnSalvarTxt}>Criar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: adicionar ponto à rota */}
      <Modal visible={modalAddPonto != null} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={[s.modal, { paddingBottom: insets.bottom + 16, maxHeight: '70%' }]}>
            <Text style={s.modalTitle}>Adicionar ponto</Text>
            <TouchableOpacity
              style={s.addPontoBtn}
              onPress={() => modalAddPonto != null && adicionarPosicaoAtualNaRota(modalAddPonto)}
            >
              <Ionicons name="locate" size={18} color={COLORS.primary} />
              <Text style={s.addPontoTxt}>Usar posição atual</Text>
            </TouchableOpacity>
            <ScrollView style={{ marginTop: 8 }}>
              {waypoints.map(w => (
                <TouchableOpacity
                  key={w.id}
                  style={s.pontoRow}
                  onPress={() => modalAddPonto != null && adicionarWaypointNaRota(modalAddPonto, w)}
                >
                  <Ionicons name={TIPO_INFO[w.tipo].icon as any} size={16} color={TIPO_INFO[w.tipo].cor} />
                  <Text style={s.pontoNome}>{w.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.modalBtnCancelar} onPress={() => setModalAddPonto(null)}>
              <Text style={s.modalBtnCancelarTxt}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  title: { fontSize: FONTS.xl, fontWeight: '800', color: COLORS.text, paddingHorizontal: 16 },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, alignItems: 'center', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  tabBtnAtivo: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  tabTxt: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.textMuted },
  tabTxtAtivo: { color: COLORS.primaryDark },
  vazio: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  vazioTxt: { fontSize: FONTS.md, fontWeight: '700', color: COLORS.textMuted, marginTop: 16, textAlign: 'center' },
  vazioSub: { fontSize: FONTS.sm, color: COLORS.textLight, marginTop: 8, textAlign: 'center', lineHeight: 18 },
  card: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, marginBottom: 10, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 34, height: 34, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  cardNome: { fontSize: FONTS.base, fontWeight: '700', color: COLORS.text },
  cardSub: { fontSize: FONTS.xs, color: COLORS.textMuted, marginTop: 2 },
  trashBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  detalhe: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 6 },
  pontoVazio: { fontSize: FONTS.sm, color: COLORS.textLight },
  pontoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  pontoOrdem: { fontSize: FONTS.xs, fontWeight: '700', color: COLORS.primary, width: 18 },
  pontoNome: { flex: 1, fontSize: FONTS.sm, color: COLORS.text },
  addPontoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  addPontoTxt: { fontSize: FONTS.sm, fontWeight: '600', color: COLORS.primary },
  fab: {
    position: 'absolute', right: 16,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 6,
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, padding: 20, gap: 10 },
  modalTitle: { fontSize: FONTS.lg, fontWeight: '800', color: COLORS.text },
  modalSub: { fontSize: FONTS.sm, color: COLORS.textMuted, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: FONTS.base,
    color: COLORS.text, backgroundColor: COLORS.bg,
  },
  tipoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tipoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  tipoChipTxt: { fontSize: FONTS.xs, fontWeight: '600', color: COLORS.text },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalBtnCancelar: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  modalBtnCancelarTxt: { fontSize: FONTS.md, fontWeight: '700', color: COLORS.textMuted },
  modalBtnSalvar: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
  modalBtnSalvarTxt: { fontSize: FONTS.md, fontWeight: '700', color: '#fff' },
})
