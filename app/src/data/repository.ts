/**
 * 数据仓储抽象层
 * ------------------------------------------------------------------
 * 目标：业务组件只依赖 TaskRepository 接口，不关心底层存储实现。
 * 当前实现：LocalStorageRepository（零原生依赖，P0 快速跑通）
 * 未来切换：SqliteRepository（better-sqlite3 / electron IPC）
 *          只需在 createRepository() 里替换实例，组件代码零改动。
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
}

export interface TaskRepository {
  list(): Task[]
  add(task: Omit<Task, 'id' | 'createdAt' | 'done'>): Task
  toggle(id: string): void
  remove(id: string): void
  subscribe(listener: (tasks: Task[]) => void): () => void
}

const KEY_TASKS = 'nexus.tasks.v1'

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

  add(input: Omit<Task, 'id' | 'createdAt' | 'done'>): Task {
    const task: Task = { ...input, id: uid(), createdAt: Date.now(), done: false }
    const next = [...this.read(), task]
    this.write(next)
    return task
  }

  toggle(id: string): void {
    this.write(this.read().map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  remove(id: string): void {
    this.write(this.read().filter((t) => t.id !== id))
  }

  subscribe(listener: (tasks: Task[]) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

/** 仓储工厂：将来切换 SQLite 只改这里 */
export function createTaskRepository(): TaskRepository {
  return new LocalStorageTaskRepository()
}

export const taskRepo = createTaskRepository()
