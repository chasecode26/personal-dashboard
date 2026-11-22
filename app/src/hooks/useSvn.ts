import { useCallback, useEffect, useState } from 'react'

export interface SvnRepo {
  name: string
  url: string
}

export interface SvnConfig {
  repos: SvnRepo[]
  username: string
  password: string
  ignoreCert: boolean
  limit: number
  authorFilter: string
}

export interface SvnCommit {
  revision: number
  author: string
  date: string
  message: string
  paths: { action: string; path: string }[]
}

export interface SvnGroup {
  name: string
  url: string
  commits: SvnCommit[]
  error: string
}

export interface SvnLogData {
  groups: SvnGroup[]
  counts: { repos: number; commits: number }
  syncedAt: string
}

const EMPTY_CONFIG: SvnConfig = {
  repos: [], username: '', password: '', ignoreCert: false, limit: 20, authorFilter: '',
}

export function useSvn() {
  const [config, setConfig] = useState<SvnConfig | null>(null)
  const [logs, setLogs] = useState<SvnLogData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  const api = () => (typeof window !== 'undefined' ? (window as any).nexus : null)

  const loadConfig = useCallback(async () => {
    const nexus = api()
    if (!nexus?.isElectron) { setReady(true); return }
    try {
      const cfg = await nexus.svnConfig()
      setConfig(cfg && cfg.repos && cfg.repos.length ? cfg : null)
    } catch { setConfig(null) }
    setReady(true)
  }, [])

  const refresh = useCallback(async () => {
    const nexus = api()
    if (!nexus?.isElectron) return
    setLoading(true); setError('')
    try {
      const data = await nexus.svnLogs()
      setLogs(data)
    } catch (err: any) {
      setError(String(err?.message || err || '加载失败'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  const save = useCallback(async (cfg: SvnConfig) => {
    const nexus = api()
    const saved = await nexus.svnSave(cfg)
    setConfig(saved)
    return saved
  }, [])

  const clear = useCallback(async () => {
    const nexus = api()
    await nexus.svnClear()
    setConfig(null); setLogs(null); setError('')
  }, [])

  const test = useCallback(async (cfg: SvnConfig) => {
    return api().svnTest(cfg)
  }, [])

  return { config, logs, loading, error, ready, refresh, save, clear, test, setConfig, EMPTY_CONFIG }
}
