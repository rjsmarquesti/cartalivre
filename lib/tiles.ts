import Constants from 'expo-constants'

// Chave gerada em https://cloud.maptiler.com — configurar em app.json > expo.extra.mapTilerKey
// (ou via variável de ambiente EXPO_PUBLIC_MAPTILER_KEY no build). Sem a chave, a camada
// base não carrega — telas devem tratar esse caso mostrando aviso, não travar o app.
export const MAPTILER_KEY: string =
  process.env.EXPO_PUBLIC_MAPTILER_KEY ??
  (Constants.expoConfig?.extra?.mapTilerKey as string | undefined) ??
  ''

// Style hospedado pela própria MapTiler — usado tanto na exibição ao vivo (prop
// `mapStyle` do <Map>) quanto no download offline (OfflineManager.createPack só aceita
// uma URL de style, não um objeto StyleSpecification inline nesta versão da lib).
export const MAPTILER_STYLE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/ocean/style.json?key=${MAPTILER_KEY}`
  : ''

export const SEAMARK_TILE_URL = 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'

// Proxy próprio (Cloudflare Worker) que converte bbox do tile em GetMap do WMS da GEBCO.
// Ver plano técnico — não é bloqueante para o MVP (camada fica desativada até existir).
export const BATHYMETRY_TILE_URL = ''

export const SEAMARK_MAX_ZOOM = 15
export const OFFLINE_ZOOM_DEFAULT = { min: 8, max: 14 }

// Style hospedado pro pacote offline de marcas náuticas — antes vinha de um proxy no
// servidor de ativação (só disponível pra contas com acesso DHN); esse app não tem
// mais esse servidor, então o download antecipado (offline) do seamark fica
// indisponível por ora (mesma limitação que já existia pra usuário sem acesso DHN
// no app-irmão — não é uma regressão introduzida aqui). A camada segue funcionando
// normalmente ao vivo via SEAMARK_TILE_URL, só o pacote offline dela é que não baixa.
export function getSeamarkStyleUrl(): string {
  return ''
}

// Servidor HTTP local (lib/tileServer.ts) que serve os tiles das cartas importadas
// pelo usuário — nunca aponta pra um host remoto.
export function getLocalChartTileUrl(chartId: string, porta: number): string {
  return `http://127.0.0.1:${porta}/${chartId}/{z}/{x}/{y}.png`
}

export interface CamadasConfig {
  seamarks: boolean
  bathymetry: boolean
  cartasImportadas: boolean
}
