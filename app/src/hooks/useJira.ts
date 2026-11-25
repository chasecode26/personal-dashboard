import { useCallback, useEffect, useState } from 'react'

export interface JiraConfig {
  baseUrl: string
  email: string
  token: string
  projectKey: string
  mode: 'cloud' | 'server'
  authType: 'basic' | 'pat'
  ignoreCert: boolean
}

export interface JiraIssue {
  key: string
  summary: string
  type: string
  typeIcon: string
  status: string
  statusCategory: string
  priority: string
  priorityIcon: string
  assignee: string
  updated: string
  resolved: string
  url: string
}

export interface JiraBoardData {
  todo: JiraIssue[]
  bugs: JiraIssue[]
  done: JiraIssue[]
  counts: { todo: number; bugs: number; done: number }
  syncedAt: string
}

export function useJira() {
  const [config, setConfig] = useState<JiraConfig | null>(null)
  const [board, setBoard] = useState<JiraBoardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  const api = () => (typeof window !== 'undefined' ? (window as any).nexus : null)

  const loadConfig = useCallback(async () => {
    const nexus = api()
    if (!nexus?.isElectron) { setReady(true); return }
    try {
      const cfg = await nexus.jiraConfig()
      setConfig(cfg)
    } catch { setConfig(null) }
    setReady(true)
  }, [])

  const refresh = useCallback(async () => {
    const nexus = api()
    if (!nexus?.isElectron) return
    setLoading(true); setError('')
    try {
      const data = await nexus.jiraBoard()
      setBoard(data)
      return data as JiraBoardData
    } catch (err: any) {
      setError(String(err?.message || err || '加载失败'))
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  const save = useCallback(async (cfg: JiraConfig) => {
    const nexus = api()
    const saved = await nexus.jiraSave(cfg)
    setConfig(saved)
    return saved
  }, [])

  const clear = useCallback(async () => {
    const nexus = api()
    await nexus.jiraClear()
    setConfig(null); setBoard(null); setError('')
  }, [])

  const test = useCallback(async (cfg: JiraConfig) => {
    const nexus = api()
    return nexus.jiraTest(cfg)
  }, [])

  return { config, board, loading, error, ready, refresh, save, clear, test, setConfig }
}
