/**
 * 数据仓储抽象层
 * ------------------------------------------------------------------
 * 目标：业务组件只依赖仓储接口，不关心底层存储实现。
 * 当前实现：LocalStorageRepository（零原生依赖，P0 快速跑通）
 * 未来切换：SqliteRepository（better-sqlite3 / electron IPC）
 *          只需在 createXxxRepository() 里替换实例，组件代码零改动。
 */

export type TaskCategory = 'work' | 'life' | 'study'
export type Priority = 'high' | 'medium' | 'low'

export interface Task {
  id: string
  title: string
  category: TaskCategory
  priority: Priority
  done: boolean
  createdAt: number
  completedAt?: number   // 完成时刻的时间戳（用于本周完成分布统计）
}

/** 专注会话：一次完成的番茄钟 */
export interface FocusSession {
  id: string
  startedAt: number      // 开始时刻
  endedAt: number        // 结束时刻
  minutes: number        // 实际专注分钟数
  label: string          // 专注标签（如"编码/学习"）
}

export interface TaskRepository {
  list(): Task[]
  add(task: Omit<Task, 'id' | 'createdAt' | 'done' | 'completedAt'>): Task
  toggle(id: string): void
  remove(id: string): void
  subscribe(listener: (tasks: Task[]) => void): () => void
}

export interface FocusRepository {
  list(): FocusSession[]
  add(session: Omit<FocusSession, 'id'>): FocusSession
  remove(id: string): void
  clear(): void
  subscribe(listener: (sessions: FocusSession[]) => void): () => void
}

const KEY_TASKS = 'nexus.tasks.v1'
const KEY_FOCUS = 'nexus.focus.v1'

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

class LocalStorageTaskRepository implements TaskRepository {
  private listeners = new Set<(t: Task[]) => void>()

  private read(): Task[] {
    try {
      const raw = localStorage.getItem(KEY_TASKS)
      if (!raw) return this.seed()
      return JSON.parse(raw) as Task[]
    } catch {
      return this.seed()
    }
  }

  private seed(): Task[] {
    const now = Date.now()
    const seeds: Array<[string, TaskCategory, Priority]> = [
      ['完成 NEXUS 工作台原型设计', 'work', 'high'],
      ['Review 支付模块 PR #238', 'work', 'medium'],
      ['刷 2 道 LeetCode 中等题', 'study', 'medium'],
      ['晚上健身 · 胸+三头', 'life', 'low'],
      ['整理本周迭代需求文档', 'work', 'low'],
      ['给家里打个电话', 'life', 'low'],
    ]
    return seeds.map(([title, category, priority], i) => ({
      id: uid() + i,
      title,
      category,
      priority,
      done: false,
      createdAt: now + i,
    }))
  }

  private write(tasks: Task[]) {
    localStorage.setItem(KEY_TASKS, JSON.stringify(tasks))
    this.listeners.forEach((l) => l(tasks))
  }

  list(): Task[] {
    return this.read()
  }

  add(input: Omit<Task, 'id' | 'createdAt' | 'done' | 'completedAt'>): Task {
    const task: Task = { ...input, id: uid(), createdAt: Date.now(), done: false }
    const next = [...this.read(), task]
    this.write(next)
    return task
  }

  toggle(id: string): void {
    this.write(this.read().map((t) => {
      if (t.id !== id) return t
      const done = !t.done
      return { ...t, done, completedAt: done ? Date.now() : undefined }
    }))
  }

  remove(id: string): void {
    this.write(this.read().filter((t) => t.id !== id))
  }

  subscribe(listener: (tasks: Task[]) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

class LocalStorageFocusRepository implements FocusRepository {
  private listeners = new Set<(s: FocusSession[]) => void>()

  private read(): FocusSession[] {
    try {
      const raw = localStorage.getItem(KEY_FOCUS)
      return raw ? JSON.parse(raw) as FocusSession[] : []
    } catch {
      return []
    }
  }

  private write(sessions: FocusSession[]) {
    localStorage.setItem(KEY_FOCUS, JSON.stringify(sessions))
    this.listeners.forEach((l) => l(sessions))
  }

  list(): FocusSession[] {
    return this.read()
  }

  add(input: Omit<FocusSession, 'id'>): FocusSession {
    const session: FocusSession = { ...input, id: uid() }
    this.write([...this.read(), session])
    return session
  }

  remove(id: string): void {
    this.write(this.read().filter((s) => s.id !== id))
  }

  clear(): void {
    this.write([])
  }

  subscribe(listener: (sessions: FocusSession[]) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

/** 仓储工厂：将来切换 SQLite 只改这里 */
export function createTaskRepository(): TaskRepository {
  return new LocalStorageTaskRepository()
}
export function createFocusRepository(): FocusRepository {
  return new LocalStorageFocusRepository()
}

export const taskRepo = createTaskRepository()
export const focusRepo = createFocusRepository()

// ===== 统计工具 =====

/** 取周一 00:00 的时间戳（本地时区） */
export function startOfWeek(d: Date = new Date()): number {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = x.getDay() || 7 // 周日=7
  x.setDate(x.getDate() - day + 1)
  return x.getTime()
}

/** 取今天 00:00 的时间戳 */
export function startOfDay(d: Date = new Date()): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** 本周每天完成任务数（索引 0=周一 … 6=周日），基于 completedAt */
export function weeklyCompletion(tasks: Task[], now: Date = new Date()): { day: string; count: number; isToday: boolean }[] {
  const monday = startOfWeek(now)
  const result = ['一', '二', '三', '四', '五', '六', '日'].map((day, i) => ({
    day,
    count: 0,
    isToday: i === ((now.getDay() || 7) - 1),
  }))
  tasks.forEach((t) => {
    if (!t.done || !t.completedAt) return
    const idx = Math.floor((t.completedAt - monday) / 86400000)
    if (idx >= 0 && idx < 7) result[idx].count++
  })
  return result
}

/** 今日专注分钟数（按会话的 startedAt 归到今天） */
export function todayFocusMinutes(sessions: FocusSession[], now: Date = new Date()): number {
  const today = startOfDay(now)
  return sessions.reduce((sum, s) => {
    if (s.startedAt < today) return sum
    return sum + s.minutes
  }, 0)
}
