import { View, Text, StyleSheet } from 'react-native'
import { FONTS } from '../constants/theme'

export default function AttributionBar() {
  return (
    <View style={s.box} pointerEvents="none">
      <Text style={s.txt} numberOfLines={1}>
        © OpenStreetMap · © OpenSeaMap · MapTiler
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  box: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  txt: { fontSize: FONTS.xs, color: '#F1F5F9' },
})
