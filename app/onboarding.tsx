import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONTS, RADIUS } from '../constants/theme'
import { setConfig } from '../lib/db'

const PASSOS = [
  {
    icone: 'locate' as const,
    cor: '#0369A1',
    titulo: 'Sua posição em tempo real na carta',
    descricao: 'Veja onde você está e para onde está indo, com posição GPS atualizada direto sobre o mapa náutico.',
  },
  {
    icone: 'navigate' as const,
    cor: '#0891B2',
    titulo: 'Planeje rotas e waypoints',
    descricao: 'Marque portos, ancoragens, pontos de perigo e combustível, e monte rotas com múltiplos pontos antes de sair.',
  },
  {
    icone: 'cloud-download' as const,
    cor: '#16A34A',
    titulo: 'Baixe áreas para navegar offline',
    descricao: 'Sem sinal no mar ou no lago? Baixe a região com antecedência e continue vendo mapa e rota normalmente.',
  },
  {
    icone: 'warning' as const,
    cor: '#DC2626',
    titulo: 'Alerta de Homem ao Mar em 1 toque',
    descricao: 'Um botão sempre visível registra a posição exata e mostra distância e rumo até o ponto, na hora.',
  },
]

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets()
  const [passo, setPasso] = useState(0)

  function avancar() {
    if (passo < PASSOS.length - 1) {
      setPasso(passo + 1)
    } else {
      concluir()
    }
  }

  function concluir() {
    setConfig('onboarding_done', '1')
    router.replace('/(tabs)/mapa')
  }

  const p = PASSOS[passo]

  return (
    <View style={[s.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <TouchableOpacity
        style={s.skip}
        onPress={concluir}
        accessibilityRole="button"
        accessibilityLabel="Pular introdução"
      >
        <Text style={s.skipTxt}>Pular</Text>
      </TouchableOpacity>

      <View style={s.iconArea}>
        <View style={[s.iconCircle, { backgroundColor: p.cor + '20' }]}>
          <Ionicons name={p.icone} size={72} color={p.cor} />
        </View>
      </View>

      <View style={s.textArea}>
        <Text style={s.titulo}>{p.titulo}</Text>
        <Text style={s.descricao}>{p.descricao}</Text>
      </View>

      <View style={s.dots} accessibilityRole="none" accessibilityLabel={`Passo ${passo + 1} de ${PASSOS.length}`}>
        {PASSOS.map((_, i) => (
          <View key={i} style={[s.dot, i === passo && s.dotAtivo]} />
        ))}
      </View>

      <TouchableOpacity
        style={s.btn}
        onPress={avancar}
        accessibilityRole="button"
        accessibilityLabel={passo < PASSOS.length - 1 ? 'Próximo passo' : 'Começar a usar o app'}
      >
        <Text style={s.btnTxt}>
          {passo < PASSOS.length - 1 ? 'Próximo' : 'Começar'}
        </Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: COLORS.bg,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  skip: { alignSelf: 'flex-end', minWidth: 44, minHeight: 44, padding: 12, alignItems: 'flex-end', justifyContent: 'center' },
  skipTxt: { fontSize: FONTS.sm, color: COLORS.textMuted },
  iconArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconCircle: {
    width: 160, height: 160, borderRadius: 80,
    alignItems: 'center', justifyContent: 'center',
  },
  textArea: { width: '100%', alignItems: 'center', marginBottom: 32 },
  titulo: {
    fontSize: FONTS['2xl'], fontWeight: '800', color: COLORS.text,
    textAlign: 'center', marginBottom: 12,
  },
  descricao: {
    fontSize: FONTS.md, color: COLORS.textMuted,
    textAlign: 'center', lineHeight: 24,
  },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 32 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  dotAtivo: { backgroundColor: COLORS.primary, width: 24 },
  btn: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: FONTS.lg },
})
