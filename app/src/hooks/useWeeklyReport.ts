import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Task } from '../data/repository'
import {
  buildReport,
  loadDraft,
  saveDraft,
  toMarkdown,
  weekKeyOf,
  weekLabelOf,
  uid,
  type WeeklyReport,
  type WeeklyJiraData,
  type WeeklySvnData,
  type ReportGroup,
} from '../data/weeklyReport'

type Section = 'work' | 'plan'

export function useWeeklyReport(tasks: Task[]) {
  const [weekKey] = useState(() => weekKeyOf())
  const weekLabel = useMemo(() => weekLabelOf(), [weekKey])
  const [report, setReport] = useState<WeeklyReport | null>(() => loadDraft(weekKey))
  const [jira, setJira] = useState<WeeklyJiraData | null>(null)
  const [svn, setSvn] = useState<WeeklySvnData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sourcesReady, setSourcesReady] = useState(false)
  const autoDone = useRef(false)
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks

  /** 拉取 Jira 周报数据 + SVN 提交记录；未配置的数据源返回 null，不影响其余来源 */
  const refreshSources = useCallback(async () => {
    const api = (window as any).nexus
    setLoading(true)
    setError('')
    let j: WeeklyJiraData | null = null
    let s: WeeklySvnData | null = null
    const missing: string[] = []
    if (api?.isElectron) {
      if (typeof api.jiraWeekly === 'function') {
        j = await api.jiraWeekly().catch(() => null)
        if (!j) missing.push('Jira')
      }
      if (typeof api.svnLogs === 'function') {
        s = await api.svnLogs().catch(() => null)
        if (!s) missing.push('SVN')
      }
    }
    setJira(j)
    setSvn(s)
    if (missing.length) setError(`${missing.join(' / ')} 未连接或拉取失败，周报将以可用来源生成`)
    setLoading(false)
    setSourcesReady(true)
    return { jira: j, svn: s }
  }, [])

  useEffect(() => { refreshSources() }, [refreshSources])

  // 数据就绪后自动生成一次草稿；已有草稿则尊重用户编辑，不覆盖
  useEffect(() => {
    if (!sourcesReady || autoDone.current) return
    autoDone.current = true
    if (loadDraft(weekKey)) return
    const fresh = buildReport(jira, svn, tasksRef.current, new Date())
    setReport(fresh)
    saveDraft(fresh)
  }, [sourcesReady, jira, svn, weekKey])

  // 任何编辑即时持久化
  useEffect(() => {
    if (report) saveDraft(report)
  }, [report])

  const mutate = useCallback((fn: (r: WeeklyReport) => WeeklyReport) => {
    setReport((prev) => prev ? { ...fn(prev), edited: true } : prev)
  }, [])

  const mapSection = (r: WeeklyReport, section: Section, fn: (g: ReportGroup) => ReportGroup): WeeklyReport => ({
    ...r,
    [section]: r[section].map(fn),
  })

  const updateItem = useCallback((section: Section, groupId: string, itemId: string, text: string) => {
    mutate((r) => mapSection(r, section, (g) => g.id !== groupId ? g : {
      ...g, items: g.items.map((i) => i.id === itemId ? { ...i, text } : i),
    }))
  }, [mutate])

  const removeItem = useCallback((section: Section, groupId: string, itemId: string) => {
    mutate((r) => mapSection(r, section, (g) => g.id !== groupId ? g : {
      ...g, items: g.items.filter((i) => i.id !== itemId),
    }))
  }, [mutate])

  const addItem = useCallback((section: Section, groupId: string) => {
    mutate((r) => mapSection(r, section, (g) => g.id !== groupId ? g : {
      ...g, items: [...g.items, { id: uid(), text: '', source: 'manual' as const }],
    }))
  }, [mutate])

  const addGroup = useCallback((section: Section) => {
    mutate((r) => ({
      ...r,
      [section]: [...r[section], { id: `manual:${uid()}`, name: '新项目', items: [] }],
    }))
  }, [mutate])

  const removeGroup = useCallback((section: Section, groupId: string) => {
    mutate((r) => ({ ...r, [section]: r[section].filter((g) => g.id !== groupId) }))
  }, [mutate])

  const renameGroup = useCallback((section: Section, groupId: string, name: string) => {
    mutate((r) => mapSection(r, section, (g) => g.id !== groupId ? g : { ...g, name }))
  }, [mutate])

  /** 重新从数据源聚合，覆盖当前草稿（面板里需先向用户确认） */
  const regenerate = useCallback(async () => {
    const fresh = await refreshSources()
    const next = buildReport(fresh.jira, fresh.svn, tasksRef.current, new Date())
    setReport(next)
    return next
  }, [refreshSources])

  const markdown = useMemo(
    () => report ? toMarkdown(report, weekLabel) : '',
    [report, weekLabel],
  )

  return {
    report,
    weekLabel,
    loading,
    error,
    markdown,
    hasJira: Boolean(jira),
    hasSvn: Boolean(svn),
    refreshSources,
    regenerate,
    updateItem,
    removeItem,
    addItem,
    addGroup,
    removeGroup,
    renameGroup,
  }
}
