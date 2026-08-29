import { useEffect } from 'react'
import { Tabs, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAppTheme } from '../../hooks/useAppTheme'
import { getConfig, initDB } from '../../lib/db'
import { iniciarServidorTiles } from '../../lib/tileServer'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

function TabIcon({ name, color }: { name: IoniconName; focused: boolean; color: any }) {
  return <Ionicons name={name} size={22} color={color} accessible={false} />
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  const { colors } = useAppTheme()

  useEffect(() => {
    initDB()
    iniciarServidorTiles()

    // Disclaimer legal — precisa ser aceito uma vez antes de usar o mapa
    if (getConfig('disclaimer_accepted') !== '1') {
      router.replace('/(tabs)/sobre')
    }
  }, [])

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom + 4,
          height: 58 + insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="mapa"      options={{ title: 'Mapa',      tabBarIcon: ({ focused, color }) => <TabIcon name={focused ? 'map' : 'map-outline'} focused={focused} color={color} /> }} />
      <Tabs.Screen name="rotas"     options={{ title: 'Rotas',     tabBarIcon: ({ focused, color }) => <TabIcon name={focused ? 'navigate' : 'navigate-outline'} focused={focused} color={color} /> }} />
      <Tabs.Screen name="cartas"    options={{ title: 'Cartas',    tabBarIcon: ({ focused, color }) => <TabIcon name={focused ? 'layers' : 'layers-outline'} focused={focused} color={color} /> }} />
      <Tabs.Screen name="offline"  options={{ title: 'Offline',  tabBarIcon: ({ focused, color }) => <TabIcon name={focused ? 'cloud-download' : 'cloud-download-outline'} focused={focused} color={color} /> }} />
      <Tabs.Screen name="historico" options={{ title: 'Histórico', tabBarIcon: ({ focused, color }) => <TabIcon name={focused ? 'time' : 'time-outline'} focused={focused} color={color} /> }} />
      <Tabs.Screen name="sobre"     options={{ title: 'Sobre',     tabBarIcon: ({ focused, color }) => <TabIcon name={focused ? 'information-circle' : 'information-circle-outline'} focused={focused} color={color} /> }} />
    </Tabs>
  )
}
