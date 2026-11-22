import { useCallback, useEffect, useState } from 'react'

export interface WeatherConfig {
  city: string
  lat: number | null
  lon: number | null
  unit: 'c' | 'f'
  autoLocate: boolean
}

export interface WeatherTrend {
  time: string
  temp: number
}

export interface WeatherData {
  city: string
  temp: number
  feels: number
  unit: 'c' | 'f'
  desc: string
  icon: string
  isDay: boolean
  humidity: number
  wind: number
  uv: string
  uvValue: number
  pm25: number | null
  aqi: number | null
  aqiText: string
  aqiColor: string
  trend: WeatherTrend[]
  syncedAt: string
  source: string
}

const api = () => (typeof window !== 'undefined' ? (window as any).nexus : null)

export function useWeather() {
  const [config, setConfig] = useState<WeatherConfig | null>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  const loadConfig = useCallback(async () => {
    const nexus = api()
    if (!nexus?.isElectron) { setReady(true); return }
    try {
      setConfig(await nexus.weatherConfig())
    } catch { setConfig(null) }
    setReady(true)
  }, [])

  const refresh = useCallback(async () => {
    const nexus = api()
    if (!nexus?.isElectron) return
    setLoading(true); setError('')
    try {
      const data = await nexus.weatherCurrent()
      setWeather(data)
      return data
    } catch (err: any) {
      const msg = String(err?.message || err || '加载失败')
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  const save = useCallback(async (cfg: WeatherConfig) => {
    const saved = await api().weatherSave(cfg)
    setConfig(saved)
    return saved
  }, [])

  const clear = useCallback(async () => {
    await api().weatherClear()
    setConfig(null); setWeather(null); setError('')
  }, [])

  const search = useCallback(async (kw: string) => {
    return api().weatherSearch(kw)
  }, [])

  return { config, weather, loading, error, ready, refresh, save, clear, search, setConfig }
}
