import StaticServer from '@dr.pogodin/react-native-static-server'
import { getCartasDirPath } from './cartasImportadas'

const PORTA = 8080
const HOSTNAME = '127.0.0.1'

let server: StaticServer | null = null
let porta = 0

export async function iniciarServidorTiles(): Promise<number> {
  if (server && porta) return porta
  server = new StaticServer({ fileDir: getCartasDirPath(), port: PORTA, hostname: HOSTNAME })
  await server.start()
  porta = PORTA
  return porta
}

export function getPortaServidor(): number {
  return porta
}

export async function pararServidorTiles(): Promise<void> {
  await server?.stop()
  server = null
  porta = 0
}
