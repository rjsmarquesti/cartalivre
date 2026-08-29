import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as KeepAwake from 'expo-keep-awake'
import { COLORS, FONTS, RADIUS } from '../../constants/theme'
import MapCanvas from '../../components/MapCanvas'
import CoordBadge from '../../components/CoordBadge'
import AttributionBar from '../../components/AttributionBar'
import MOBButton from '../../components/MOBButton'
import MOBBanner from '../../components/MOBBanner'
import {
  requestForegroundPermission, startWatch, stopWatch, haversineDistanceM, Fix,
} from '../../lib/location'
import {
  getWaypoints, getTrackAtivo, iniciarTrack, finalizarTrack, adicionarTrackPoints,
  getMOBAtivo, resolverMOB, Waypoint, MobEvent, Track, getConfig, setConfig,
} from '../../lib/db'
import { useDhnCharts } from '../../hooks/useDhnCharts'

const KEEP_AWAKE_TAG = 'cartalivre-gravando'
const FLUSH_INTERVAL_MS = 5000

export default function MapaScreen() {
  const insets = useSafeAreaInsets()
  const dhn = useDhnCharts()
  const [fix, setFix] = useState<Fix | null>(null)
  const [permitido, setPermitido] = useState<boolean | null>(null)
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [trackAtivo, setTrackAtivo] = useState<Track | null>(null)
  const [mobAtivo, setMobAtivo] = useState<MobEvent | null>(null)
  const [seguir, setSeguir] = useState(true)
  const [avisoCartaVisivel, setAvisoCartaVisivel] = useState(false)

  useEffect(() => {
    if (dhn.manifest && dhn.manifest.chartCount > 0 && getConfig('aviso_carta_dispensado') !== '1') {
      setAvisoCartaVisivel(true)
    }
  }, [dhn.manifest])

  const bufferRef = useRef<Array<{ lat: number; lon: number; alt?: number | null; velocidade?: number | null; rumo?: number | null; precisao?: number | null; timestampGps: number }>>([])
  const ultimoPontoRef = useRef<{ lat: number; lon: number } | null>(null)
  const trackAtivoRef = useRef<Track | null>(null)
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useFocusEffect(useCallback(() => {
    setWaypoints(getWaypoints())
    const track = getTrackAtivo()
    trackAtivoRef.current = track
    setTrackAtivo(track)
    setMobAtivo(getMOBAtivo())
  }, []))

  useEffect(() => {
    let ativo = true
    async function boot() {
      const ok = await requestForegroundPermission()
      if (!ativo) return
      setPermitido(ok)
      if (!ok) {
        Alert.alert(
          'Permissão de localização necessária',
          'Sem acesso ao GPS o app não consegue mostrar sua posição na carta. Ative a permissão de localização nas configurações do aparelho.'
        )
        return
      }
      await startWatch(novoFix => {
        setFix(novoFix)
        if (trackAtivoRef.current && (bufferRef.current.length === 0 || bufferRef.current[bufferRef.current.length - 1].timestampGps !== novoFix.timestampGps)) {
          bufferRef.current.push({
            lat: novoFix.lat, lon: novoFix.lon, alt: novoFix.alt,
            velocidade: novoFix.velocidade, rumo: novoFix.rumo, precisao: novoFix.precisao,
            timestampGps: novoFix.timestampGps,
          })
        }
      })
    }
    boot()
    return () => { ativo = false; stopWatch() }
  }, [])

  useEffect(() => {
    if (!trackAtivo) {
      if (flushTimerRef.current) { clearInterval(flushTimerRef.current); flushTimerRef.current = null }
      KeepAwake.deactivateKeepAwake(KEEP_AWAKE_TAG)
      return
    }
    const trackId = trackAtivo.id
    KeepAwake.activateKeepAwakeAsync(KEEP_AWAKE_TAG)
    flushTimerRef.current = setInterval(() => flushBuffer(trackId), FLUSH_INTERVAL_MS)
    return () => {
      flushBuffer(trackId)
      if (flushTimerRef.current) clearInterval(flushTimerRef.current)
      KeepAwake.deactivateKeepAwake(KEEP_AWAKE_TAG)
    }
  }, [trackAtivo?.id])

  function flushBuffer(trackId: number) {
    const pontos = bufferRef.current.splice(0, bufferRef.current.length)
    if (pontos.length === 0) return
    let distanciaIncremental = 0
    for (const p of pontos) {
      if (ultimoPontoRef.current) {
        distanciaIncremental += haversineDistanceM(ultimoPontoRef.current, p)
      }
      ultimoPontoRef.current = { lat: p.lat, lon: p.lon }
    }
    adicionarTrackPoints(trackId, pontos, distanciaIncremental)
  }

  function iniciarGravacao() {
    bufferRef.current = []
    const id = iniciarTrack(`Trajeto ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`)
    ultimoPontoRef.current = fix ? { lat: fix.lat, lon: fix.lon } : null
    const track = getTrackAtivo()
    trackAtivoRef.current = track
    setTrackAtivo(track)
  }

  function pararGravacao() {
    if (!trackAtivo) return
    flushBuffer(trackAtivo.id)
    finalizarTrack(trackAtivo.id)
    trackAtivoRef.current = null
    setTrackAtivo(null)
    ultimoPontoRef.current = null
  }

  const centro: [number, number] = fix ? [fix.lon, fix.lat] : [-43.2, -22.9]

  return (
    <View style={s.container}>
      <MapCanvas
        camadas={{ seamarks: true, bathymetry: false, cartasImportadas: true }}
        centro={centro}
        seguirPosicao={seguir}
        waypoints={waypoints}
        mobEvento={mobAtivo}
        visibleCharts={dhn.visibleCharts}
        onRegionChange={dhn.onViewportChange}
      />

      <View style={[s.topOverlay, { top: insets.top + 8 }]} pointerEvents="box-none">
        <CoordBadge fix={fix} />
        <TouchableOpacity
          style={s.followBtn}
          onPress={() => setSeguir(v => !v)}
          accessibilityRole="button"
          accessibilityLabel={seguir ? 'Parar de seguir posição' : 'Seguir minha posição'}
        >
          <Ionicons name={seguir ? 'locate' : 'locate-outline'} size={20} color={seguir ? COLORS.primary : '#fff'} />
        </TouchableOpacity>
      </View>

      {avisoCartaVisivel && (
        <View style={[s.avisoDhnWrap, { top: insets.top + 64 }]}>
          <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
          <Text style={s.avisoDhnTxt}>
            Você está vendo uma carta importada por você — confirme sempre os Avisos aos Navegantes vigentes e as cartas oficiais.
          </Text>
          <TouchableOpacity
            onPress={() => { setConfig('aviso_carta_dispensado', '1'); setAvisoCartaVisivel(false) }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Dispensar aviso"
          >
            <Ionicons name="close" size={16} color={COLORS.textLight} />
          </TouchableOpacity>
        </View>
      )}

      {mobAtivo && (
        <View style={[s.mobBannerWrap, { top: insets.top + 64 }]}>
          <MOBBanner
            evento={mobAtivo}
            fixAtual={fix}
            onResolver={() => { resolverMOB(mobAtivo.id); setMobAtivo(null) }}
          />
        </View>
      )}

      <View style={[s.bottomOverlay, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
        <TouchableOpacity
          style={[s.gravarBtn, trackAtivo && s.gravarBtnAtivo]}
          onPress={trackAtivo ? pararGravacao : iniciarGravacao}
          accessibilityRole="button"
          accessibilityLabel={trackAtivo ? 'Parar gravação de trajeto' : 'Iniciar gravação de trajeto'}
        >
          <Ionicons name={trackAtivo ? 'stop-circle' : 'play-circle'} size={20} color="#fff" />
          <Text style={s.gravarTxt}>{trackAtivo ? 'Parar trajeto' : 'Gravar trajeto'}</Text>
        </TouchableOpacity>
      </View>

      <AttributionBar />

      <MOBButton
        trackIdAtivo={trackAtivo?.id ?? null}
        onAcionado={evento => setMobAtivo(evento)}
        onDesfeito={() => setMobAtivo(getMOBAtivo())}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  topOverlay: {
    position: 'absolute', left: 12, right: 12,
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  followBtn: {
    width: 40, height: 40, borderRadius: RADIUS.full,
    backgroundColor: 'rgba(15,23,42,0.75)',
    alignItems: 'center', justifyContent: 'center',
  },
  mobBannerWrap: { position: 'absolute', left: 12, right: 12 },
  avisoDhnWrap: {
    position: 'absolute', left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.dangerLight, borderWidth: 1, borderColor: COLORS.danger,
    borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8,
  },
  avisoDhnTxt: { flex: 1, fontSize: FONTS.xs, color: COLORS.text, lineHeight: 15 },
  bottomOverlay: { position: 'absolute', left: 12 },
  gravarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: RADIUS.full,
  },
  gravarBtnAtivo: { backgroundColor: COLORS.danger },
  gravarTxt: { color: '#fff', fontWeight: '700', fontSize: FONTS.sm },
})
