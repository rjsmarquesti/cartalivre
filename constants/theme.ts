export const COLORS = {
  primary: '#0369A1',
  primaryLight: '#E0F2FE',
  primaryDark: '#075985',
  success: '#16A34A',
  successLight: '#F0FDF4',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  warning: '#EA580C',
  warningLight: '#FFF7ED',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  textMuted: '#64748B',
  textLight: '#94A3B8',
}

export const DARK_COLORS = {
  primary: '#38BDF8',
  primaryLight: '#0C2A3A',
  primaryDark: '#7DD3FC',
  success: '#4ADE80',
  successLight: '#14532D',
  danger: '#F87171',
  dangerLight: '#450A0A',
  warning: '#FB923C',
  warningLight: '#431407',
  bg: '#0B1220',
  card: '#111C30',
  border: '#1E293B',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  textLight: '#64748B',
}

export type AppColors = typeof COLORS
export type ColorValue = string

export const FONTS = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
} as const

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
} as const
