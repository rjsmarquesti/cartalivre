import { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { Redirect } from 'expo-router'
import { initDB, getConfig } from '../lib/db'
import { COLORS } from '../constants/theme'

export default function Index() {
  const [ready, setReady] = useState(false)
  const [dest, setDest] = useState<'/onboarding' | '/(tabs)/mapa'>('/onboarding')

  useEffect(() => {
    async function boot() {
      initDB()
      const done = getConfig('onboarding_done')
      setDest(done ? '/(tabs)/mapa' : '/onboarding')
      setReady(true)
    }
    boot()
  }, [])

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg }}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    )
  }

  return <Redirect href={dest} />
}
