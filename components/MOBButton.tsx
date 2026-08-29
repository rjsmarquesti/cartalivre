import { useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { COLORS, FONTS, RADIUS } from '../constants/theme'
import { getUltimoFix, getLastKnownFix } from '../lib/location'
import { registrarMOB, removerMOB, getMOBAtivo, MobEvent } from '../lib/db'

const UNDO_MS = 2000

export default function MOBButton({
  trackIdAtivo, onAcionado, onDesfeito,
}: {
  trackIdAtivo: number | null
  onAcionado: (evento: MobEvent) => void
  onDesfeito: (id: number) => void
}) {
  const [undoId, setUndoId] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function acionar() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})

    let fix = getUltimoFix()
    if (!fix) fix = await getLastKnownFix()
    if (!fix) return // sem qualquer fix disponível, não há posição para registrar

    const id = registrarMOB(fix.lat, fix.lon, trackIdAtivo)
    const evento = getMOBAtivo()
    if (evento) onAcionado(evento)

    setUndoId(id)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setUndoId(null), UNDO_MS)
  }

  function desfazer() {
    if (undoId == null) return
    if (timerRef.current) clearTimeout(timerRef.current)
    removerMOB(undoId)
    onDesfeito(undoId)
    setUndoId(null)
  }

  return (
    <View style={s.wrap} pointerEvents="box-none">
      {undoId != null && (
        <TouchableOpacity style={s.undoToast} onPress={desfazer} accessibilityRole="button" accessibilityLabel="Desfazer acionamento de homem ao mar">
          <Text style={s.undoTxt}>Toque para desfazer</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={s.btn}
        onPress={acionar}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Acionar alerta de homem ao mar"
      >
        <Ionicons name="warning" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', right: 16, bottom: 16, alignItems: 'flex-end' },
  btn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.danger,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  undoToast: {
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 10,
  },
  undoTxt: { color: '#fff', fontSize: FONTS.sm, fontWeight: '700' },
})
