import { useState, useEffect, useCallback } from 'react'
import { COLORS, DARK_COLORS, AppColors } from '../constants/theme'
import { getConfig, setConfig } from '../lib/db'

export function useAppTheme(): { colors: AppColors; dark: boolean; toggleDark: () => void } {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const saved = getConfig('dark_mode')
    if (saved === '1') setDark(true)
  }, [])

  const toggleDark = useCallback(() => {
    setDark(prev => {
      const next = !prev
      setConfig('dark_mode', next ? '1' : '0')
      return next
    })
  }, [])

  return { colors: dark ? DARK_COLORS : COLORS, dark, toggleDark }
}
