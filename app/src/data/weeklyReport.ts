/**
 * 周报数据模型与聚合逻辑
 * ------------------------------------------------------------------
 * 数据源：Jira 本周完成/未完成、SVN 本周提交、本地任务完成/未完成。
 * 全部来自已接入的真实数据；用户可在面板里二次编辑，草稿按周持久化。
 */
import { startOfWeek } from './repository'
import type { Task, TaskCategory } from './repository'

export type ReportSource = 'jira' | 'svn' | 'local' | 'manual'

export interface ReportItem {
  id: string
  text: string
  source: ReportSource
  url?: string
}

export interface ReportGroup {
  id: string
  name: string
  items: ReportItem[]
}

export interface WeeklyReport {
  weekKey: string
  work: ReportGroup[]
  plan: ReportGroup[]
  generatedAt: number
  edited: boolean
}

// 结构化输入类型：不直接依赖 hook 的返回类型，避免循环引用
export interface WeeklyIssue {
  key: string
  summary: string
  type: string
  resolved?: string
  updated?: string
  project: string
  projectName: string
  url: string
}
export interface WeeklyJiraData {
  completed: WeeklyIssue[]
  planned: WeeklyIssue[]
  syncedAt: string
}
export interface WeeklySvnGroup {
  name: string
  url: string
  commits: { revision: number; author: string; date: string; message: string }[]
  error?: string
}
export interface WeeklySvnData {
  groups: WeeklySvnGroup[]
  syncedAt?: string
}

const CATEGORY_LABEL: Record<TaskCategory, string> = { work: '工作', life: '生活', study: '学习' }

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

/** 本周一的 YYYY-MM-DD，作为草稿 key */
export function weekKeyOf(d: Date = new Date()): string {
  const x = new Date(startOfWeek(d))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`
}

/** 周区间展示文案：2026-11-23 ~ 2026-11-29 */
export function weekLabelOf(d: Date = new Date()): string {
  const monday = new Date(startOfWeek(d))
  const sunday = new Date(monday.getTime() + 6 * 86400000)
  const p = (n: number) => String(n).padStart(2, '0')
  const fmt = (x: Date) => `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`
  return `${fmt(monday)} ~ ${fmt(sunday)}`
}

function draftKey(weekKey: string): string {
  return `nexus.weekly-report.v1.${weekKey}`
}

export function loadDraft(weekKey: string): WeeklyReport | null {
  try {
    const raw = localStorage.getItem(draftKey(weekKey))
    if (!raw) return null
    const parsed = JSON.parse(raw) as WeeklyReport
    if (!parsed || !Array.isArray(parsed.work) || !Array.isArray(parsed.plan)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveDraft(report: WeeklyReport): void {
  try {
    localStorage.setItem(draftKey(report.weekKey), JSON.stringify(report))
  } catch {}
}

/** 按 key 聚合为有序分组（保持首次出现顺序） */
function groupBy<T>(items: T[], keyOf: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  items.forEach((it) => {
    const k = keyOf(it)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(it)
  })
  return map
}

/**
 * 从真实数据源聚合周报。
 * Jira 按 project 分组；SVN 按仓库分组；本地任务按分类归入「个人 · X」。
 */
export function buildReport(
  jira: WeeklyJiraData | null,
  svn: WeeklySvnData | null,
  tasks: Task[],
  now: Date = new Date(),
): WeeklyReport {
  const weekKey = weekKeyOf(now)
  const monday = startOfWeek(now)

  // ===== 本周工作 =====
  const work: ReportGroup[] = []

  if (jira?.completed?.length) {
    const byProject = groupBy(jira.completed, (i) => i.project || 'OTHER')
    byProject.forEach((issues, key) => {
      work.push({
        id: `jira:${key}`,
        name: issues[0].projectName || key,
        items: issues.map((i) => ({
          id: uid(),
          text: `[${i.type}] ${i.summary}（${i.key}）`,
          source: 'jira' as const,
          url: i.url,
        })),
      })
    })
  }

  if (svn?.groups?.length) {
    for (const g of svn.groups) {
      const commits = g.commits
        .filter((c) => {
          if (!c.date) return false
          const t = new Date(c.date).getTime()
          return Number.isFinite(t) && t >= monday
        })
        .slice(0, 30)
      if (!commits.length) continue
      work.push({
        id: `svn:${g.url}`,
        name: g.name || g.url,
        items: commits.map((c) => ({
          id: uid(),
          text: `r${c.revision} ${c.message.replace(/\s+/g, ' ').trim()}`,
          source: 'svn' as const,
          url: g.url,
        })),
      })
    }
  }

  const doneTasks = tasks.filter((t) => t.done && t.completedAt && t.completedAt >= monday)
  if (doneTasks.length) {
    const byCat = groupBy(doneTasks, (t) => t.category)
    byCat.forEach((ts, cat) => {
      work.push({
        id: `local:${cat}`,
        name: `个人 · ${CATEGORY_LABEL[cat as TaskCategory] || cat}`,
        items: ts.map((t) => ({ id: uid(), text: t.title, source: 'local' as const })),
      })
    })
  }

  // ===== 下周计划 =====
  const plan: ReportGroup[] = []

  if (jira?.planned?.length) {
    const byProject = groupBy(jira.planned, (i) => i.project || 'OTHER')
    byProject.forEach((issues, key) => {
      plan.push({
        id: `jira:${key}`,
        name: issues[0].projectName || key,
        items: issues.map((i) => ({
          id: uid(),
          text: `[${i.type}] ${i.summary}（${i.key}）`,
          source: 'jira' as const,
          url: i.url,
        })),
      })
    })
  }

  const pendingTasks = tasks.filter((t) => !t.done)
  if (pendingTasks.length) {
    const byCat = groupBy(pendingTasks, (t) => t.category)
    byCat.forEach((ts, cat) => {
      plan.push({
        id: `local:${cat}`,
        name: `个人 · ${CATEGORY_LABEL[cat as TaskCategory] || cat}`,
        items: ts.map((t) => ({ id: uid(), text: t.title, source: 'local' as const })),
      })
    })
  }

  return { weekKey, work, plan, generatedAt: Date.now(), edited: false }
}

/** 导出为 Markdown（用户可直接粘贴到周报系统） */
export function toMarkdown(report: WeeklyReport, weekLabel: string): string {
  const lines: string[] = [`# 周报（${weekLabel}）`, '']
  const section = (title: string, groups: ReportGroup[]) => {
    lines.push(`## ${title}`, '')
    if (!groups.length) { lines.push('_（暂无内容）_', ''); return }
    groups.forEach((g) => {
      lines.push(`### ${g.name}`, '')
      if (!g.items.length) lines.push('_（暂无内容）_', '')
      g.items.forEach((i) => lines.push(`- ${i.text}`))
      lines.push('')
    })
  }
  section('一、本周工作内容', report.work)
  section('二、下周工作计划', report.plan)
  return lines.join('\n').trimEnd() + '\n'
}
