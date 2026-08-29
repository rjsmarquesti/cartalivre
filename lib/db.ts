import * as SQLite from 'expo-sqlite'

const db = SQLite.openDatabaseSync('CartaLivre.db')

export function initDB(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS waypoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'generico',
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      notas TEXT,
      criado_em INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cor TEXT NOT NULL DEFAULT '#0369A1',
      criado_em INTEGER NOT NULL,
      atualizado_em INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS route_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      waypoint_id INTEGER,
      ordem INTEGER NOT NULL,
      nome TEXT,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      iniciado_em INTEGER NOT NULL,
      finalizado_em INTEGER,
      distancia_m REAL NOT NULL DEFAULT 0,
      ativo INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS track_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id INTEGER NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      alt REAL,
      velocidade REAL,
      rumo REAL,
      precisao REAL,
      timestamp_gps INTEGER NOT NULL,
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mob_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id INTEGER,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      timestamp_ms INTEGER NOT NULL,
      resolvido INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS cartas_importadas (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      min_lon REAL NOT NULL, min_lat REAL NOT NULL,
      max_lon REAL NOT NULL, max_lat REAL NOT NULL,
      zoom_min INTEGER NOT NULL, zoom_max INTEGER NOT NULL,
      tile_count INTEGER NOT NULL DEFAULT 0,
      tamanho_bytes INTEGER NOT NULL DEFAULT 0,
      caminho_local TEXT NOT NULL,
      criado_em INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS offline_areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      min_lat REAL NOT NULL, max_lat REAL NOT NULL,
      min_lon REAL NOT NULL, max_lon REAL NOT NULL,
      zoom_min INTEGER NOT NULL, zoom_max INTEGER NOT NULL,
      camadas TEXT NOT NULL DEFAULT 'base',
      maplibre_pack_id TEXT,
      status TEXT NOT NULL DEFAULT 'pendente',
      tamanho_bytes INTEGER,
      criado_em INTEGER NOT NULL,
      atualizado_em INTEGER NOT NULL
    );
  `)
}

// ── Config ───────────────────────────────────────────────────────────────────

export function getConfig(key: string): string | null {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM config WHERE key = ?', [key])
  return row?.value ?? null
}

export function setConfig(key: string, value: string): void {
  db.runSync('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', [key, value])
}

// ── Waypoints ────────────────────────────────────────────────────────────────

export type WaypointTipo = 'generico' | 'porto' | 'ancoragem' | 'perigo' | 'combustivel'

export interface Waypoint {
  id: number
  nome: string
  tipo: WaypointTipo
  lat: number
  lon: number
  notas: string | null
  criado_em: number
}

export function getWaypoints(): Waypoint[] {
  return db.getAllSync<Waypoint>('SELECT * FROM waypoints ORDER BY criado_em DESC')
}

export function criarWaypoint(nome: string, tipo: WaypointTipo, lat: number, lon: number, notas?: string): number {
  const r = db.runSync(
    'INSERT INTO waypoints (nome, tipo, lat, lon, notas, criado_em) VALUES (?, ?, ?, ?, ?, ?)',
    [nome, tipo, lat, lon, notas ?? null, Date.now()]
  )
  return r.lastInsertRowId
}

export function deletarWaypoint(id: number): void {
  db.runSync('DELETE FROM waypoints WHERE id = ?', [id])
}

// ── Rotas ────────────────────────────────────────────────────────────────────

export interface Route {
  id: number
  nome: string
  cor: string
  criado_em: number
  atualizado_em: number
}

export interface RoutePoint {
  id: number
  route_id: number
  waypoint_id: number | null
  ordem: number
  nome: string | null
  lat: number
  lon: number
}

export function getRotas(): Route[] {
  return db.getAllSync<Route>('SELECT * FROM routes ORDER BY atualizado_em DESC')
}

export function criarRota(nome: string, cor = '#0369A1'): number {
  const now = Date.now()
  const r = db.runSync(
    'INSERT INTO routes (nome, cor, criado_em, atualizado_em) VALUES (?, ?, ?, ?)',
    [nome, cor, now, now]
  )
  return r.lastInsertRowId
}

export function getRotaComPontos(routeId: number): { rota: Route | null; pontos: RoutePoint[] } {
  const rota = db.getFirstSync<Route>('SELECT * FROM routes WHERE id = ?', [routeId]) ?? null
  const pontos = db.getAllSync<RoutePoint>(
    'SELECT * FROM route_points WHERE route_id = ? ORDER BY ordem ASC',
    [routeId]
  )
  return { rota, pontos }
}

export function adicionarPontoRota(routeId: number, lat: number, lon: number, nome?: string, waypointId?: number): number {
  const ultima = db.getFirstSync<{ maxOrdem: number | null }>(
    'SELECT MAX(ordem) as maxOrdem FROM route_points WHERE route_id = ?',
    [routeId]
  )
  const ordem = (ultima?.maxOrdem ?? -1) + 1
  const r = db.runSync(
    'INSERT INTO route_points (route_id, waypoint_id, ordem, nome, lat, lon) VALUES (?, ?, ?, ?, ?, ?)',
    [routeId, waypointId ?? null, ordem, nome ?? null, lat, lon]
  )
  db.runSync('UPDATE routes SET atualizado_em = ? WHERE id = ?', [Date.now(), routeId])
  return r.lastInsertRowId
}

export function reordenarPontosRota(routeId: number, pontoIdsEmOrdem: number[]): void {
  db.withTransactionSync(() => {
    pontoIdsEmOrdem.forEach((id, ordem) => {
      db.runSync('UPDATE route_points SET ordem = ? WHERE id = ? AND route_id = ?', [ordem, id, routeId])
    })
    db.runSync('UPDATE routes SET atualizado_em = ? WHERE id = ?', [Date.now(), routeId])
  })
}

export function removerPontoRota(pontoId: number): void {
  db.runSync('DELETE FROM route_points WHERE id = ?', [pontoId])
}

export function deletarRota(id: number): void {
  db.runSync('DELETE FROM routes WHERE id = ?', [id])
}

// ── Trajetos (tracks) ────────────────────────────────────────────────────────

export interface Track {
  id: number
  nome: string
  iniciado_em: number
  finalizado_em: number | null
  distancia_m: number
  ativo: number
}

export interface TrackPoint {
  id: number
  track_id: number
  lat: number
  lon: number
  alt: number | null
  velocidade: number | null
  rumo: number | null
  precisao: number | null
  timestamp_gps: number
}

export function getTrackAtivo(): Track | null {
  return db.getFirstSync<Track>('SELECT * FROM tracks WHERE ativo = 1 ORDER BY iniciado_em DESC LIMIT 1') ?? null
}

export function iniciarTrack(nome: string): number {
  const r = db.runSync(
    'INSERT INTO tracks (nome, iniciado_em, distancia_m, ativo) VALUES (?, ?, 0, 1)',
    [nome, Date.now()]
  )
  return r.lastInsertRowId
}

export function adicionarTrackPoints(trackId: number, pontos: Array<{
  lat: number; lon: number; alt?: number | null; velocidade?: number | null; rumo?: number | null;
  precisao?: number | null; timestampGps: number
}>, distanciaIncrementalM: number): void {
  if (pontos.length === 0) return
  db.withTransactionSync(() => {
    for (const p of pontos) {
      db.runSync(
        'INSERT INTO track_points (track_id, lat, lon, alt, velocidade, rumo, precisao, timestamp_gps) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [trackId, p.lat, p.lon, p.alt ?? null, p.velocidade ?? null, p.rumo ?? null, p.precisao ?? null, p.timestampGps]
      )
    }
    if (distanciaIncrementalM > 0) {
      db.runSync('UPDATE tracks SET distancia_m = distancia_m + ? WHERE id = ?', [distanciaIncrementalM, trackId])
    }
  })
}

export function finalizarTrack(trackId: number): void {
  db.runSync('UPDATE tracks SET ativo = 0, finalizado_em = ? WHERE id = ?', [Date.now(), trackId])
}

export function getTracks(): Track[] {
  return db.getAllSync<Track>('SELECT * FROM tracks ORDER BY iniciado_em DESC')
}

export function getTrackPoints(trackId: number): TrackPoint[] {
  return db.getAllSync<TrackPoint>('SELECT * FROM track_points WHERE track_id = ? ORDER BY timestamp_gps ASC', [trackId])
}

export function deletarTrack(id: number): void {
  db.runSync('DELETE FROM tracks WHERE id = ?', [id])
}

// ── MOB (homem ao mar) ───────────────────────────────────────────────────────

export interface MobEvent {
  id: number
  track_id: number | null
  lat: number
  lon: number
  timestamp_ms: number
  resolvido: number
}

export function registrarMOB(lat: number, lon: number, trackId?: number | null): number {
  const r = db.runSync(
    'INSERT INTO mob_events (track_id, lat, lon, timestamp_ms, resolvido) VALUES (?, ?, ?, ?, 0)',
    [trackId ?? null, lat, lon, Date.now()]
  )
  return r.lastInsertRowId
}

export function getMOBAtivo(): MobEvent | null {
  return db.getFirstSync<MobEvent>('SELECT * FROM mob_events WHERE resolvido = 0 ORDER BY timestamp_ms DESC LIMIT 1') ?? null
}

export function resolverMOB(id: number): void {
  db.runSync('UPDATE mob_events SET resolvido = 1 WHERE id = ?', [id])
}

// Usado só pelo "toque para desfazer" de um acionamento acidental (2s) — um MOB
// confirmado nunca deve ser removido, apenas resolvido via resolverMOB.
export function removerMOB(id: number): void {
  db.runSync('DELETE FROM mob_events WHERE id = ?', [id])
}

// ── Cartas importadas ────────────────────────────────────────────────────────

export interface CartaImportada {
  id: string
  nome: string
  min_lon: number
  min_lat: number
  max_lon: number
  max_lat: number
  zoom_min: number
  zoom_max: number
  tile_count: number
  tamanho_bytes: number
  caminho_local: string
  criado_em: number
}

export function criarCartaImportada(carta: {
  id: string; nome: string; minLon: number; minLat: number; maxLon: number; maxLat: number;
  zoomMin: number; zoomMax: number; tileCount: number; tamanhoBytes: number; caminhoLocal: string;
}): void {
  db.runSync(
    `INSERT OR REPLACE INTO cartas_importadas
      (id, nome, min_lon, min_lat, max_lon, max_lat, zoom_min, zoom_max, tile_count, tamanho_bytes, caminho_local, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [carta.id, carta.nome, carta.minLon, carta.minLat, carta.maxLon, carta.maxLat,
     carta.zoomMin, carta.zoomMax, carta.tileCount, carta.tamanhoBytes, carta.caminhoLocal, Date.now()]
  )
}

export function getCartasImportadas(): CartaImportada[] {
  return db.getAllSync<CartaImportada>('SELECT * FROM cartas_importadas ORDER BY criado_em DESC')
}

export function getCartaImportada(id: string): CartaImportada | null {
  return db.getFirstSync<CartaImportada>('SELECT * FROM cartas_importadas WHERE id = ?', [id]) ?? null
}

export function deletarCartaImportada(id: string): void {
  db.runSync('DELETE FROM cartas_importadas WHERE id = ?', [id])
}

// ── Áreas offline ────────────────────────────────────────────────────────────

// Uma área pode combinar várias camadas — cada uma vira seu próprio OfflinePack no
// MapLibre (a lib só aceita 1 style URL por pack). "camadas" guarda a lista pedida
// (ex: "base,seamark,dhnRnc"); "maplibre_pack_id" guarda um JSON { camada: packId }
// com o que já foi baixado — só fica "completo" quando todas as camadas pedidas
// tiverem pack id registrado.
export type CamadaOffline = 'base' | 'seamark'
export type StatusOffline = 'pendente' | 'baixando' | 'completo' | 'erro'

export interface OfflineArea {
  id: number
  nome: string
  min_lat: number
  max_lat: number
  min_lon: number
  max_lon: number
  zoom_min: number
  zoom_max: number
  camadas: string
  maplibre_pack_id: string | null
  status: StatusOffline
  tamanho_bytes: number | null
  criado_em: number
  atualizado_em: number
}

export function criarAreaOffline(area: {
  nome: string; minLat: number; maxLat: number; minLon: number; maxLon: number;
  zoomMin: number; zoomMax: number; camadas: CamadaOffline[];
}): number {
  const now = Date.now()
  const r = db.runSync(
    `INSERT INTO offline_areas
      (nome, min_lat, max_lat, min_lon, max_lon, zoom_min, zoom_max, camadas, status, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?)`,
    [area.nome, area.minLat, area.maxLat, area.minLon, area.maxLon, area.zoomMin, area.zoomMax, area.camadas.join(','), now, now]
  )
  return r.lastInsertRowId
}

export function getCamadasArea(area: OfflineArea): CamadaOffline[] {
  return area.camadas.split(',').filter(Boolean) as CamadaOffline[]
}

export function getPackIds(area: OfflineArea): Partial<Record<CamadaOffline, string>> {
  if (!area.maplibre_pack_id) return {}
  try {
    return JSON.parse(area.maplibre_pack_id)
  } catch {
    return {}
  }
}

export function atualizarStatusAreaOffline(id: number, status: StatusOffline): void {
  db.runSync('UPDATE offline_areas SET status = ?, atualizado_em = ? WHERE id = ?', [status, Date.now(), id])
}

// Registra o pack id de UMA camada concluída, soma o tamanho ao total acumulado e
// marca a área como "completo" só quando todas as camadas pedidas já tiverem pack id.
export function atualizarPackCamada(id: number, camada: CamadaOffline, packId: string, tamanhoBytes?: number | null): void {
  const area = db.getFirstSync<OfflineArea>('SELECT * FROM offline_areas WHERE id = ?', [id])
  if (!area) return
  const packIds = getPackIds(area)
  packIds[camada] = packId
  const completo = getCamadasArea(area).every(c => packIds[c])
  db.runSync(
    'UPDATE offline_areas SET maplibre_pack_id = ?, status = ?, tamanho_bytes = COALESCE(tamanho_bytes, 0) + ?, atualizado_em = ? WHERE id = ?',
    [JSON.stringify(packIds), completo ? 'completo' : 'baixando', tamanhoBytes ?? 0, Date.now(), id]
  )
}

export function getAreasOffline(): OfflineArea[] {
  return db.getAllSync<OfflineArea>('SELECT * FROM offline_areas ORDER BY criado_em DESC')
}

export function deletarAreaOffline(id: number): void {
  db.runSync('DELETE FROM offline_areas WHERE id = ?', [id])
}
