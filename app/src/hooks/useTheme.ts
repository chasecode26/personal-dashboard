import { useEffect, useState } from 'react'
import * as store from '../data/store'

export const THEMES = [
  { key: 'matcha', color: '#35a06b', label: '抹茶绿' },
  { key: 'teal', color: '#2f9e8f', label: '青绿' },
  { key: 'sky', color: '#4f97d8', label: '天空蓝' },
  { key: 'apricot', color: '#e5913c', label: '杏橙' },
  { key: 'violet', color: '#7d7ce4', label: '优雅紫' },
  { key: 'rose', color: '#e4657b', label: '玫粉' },
] as const

export type ThemeKey = (typeof THEMES)[number]['key']

const KEY = 'nexus-theme'

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeKey>(() => {
    const saved = store.getItem(KEY) as ThemeKey | null
    return saved && THEMES.some((t) => t.key === saved) ? saved : 'matcha'
  })

  useEffect(() => {
    document.body.dataset.theme = theme
    store.setItem(KEY, theme)
  }, [theme])

  return { theme, setTheme: setThemeState }
}
