/**
 * 通知仓储实现（Electron 下落盘 JSON，浏览器回退 localStorage）
 * 与 TaskRepository / FocusRepository 保持同一抽象风格。
 */
import * as store from './store'
import type { AppNotification, NotificationInput } from './notifications'

const KEY = 'nexus.notifications.v1'
const MAX_ITEMS = 100

export interface NotificationRepository {
  list(): AppNotification[]
  add(input: NotificationInput): AppNotification
  markRead(id: string): void
  markAllRead(): void
  remove(id: string): void
  clear(): void
  subscribe(listener: (items: AppNotification[]) => void): () => void
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

class StoreNotificationRepository implements NotificationRepository {
  private listeners = new Set<(items: AppNotification[]) => void>()

  private read(): AppNotification[] {
    const res = store.readJson(KEY, Array.isArray, '通知')
    if (res.corrupt || !res.found || !res.value) return []
    return res.value as AppNotification[]
  }

  private write(items: AppNotification[]) {
    store.setItem(KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
    this.listeners.forEach((l) => l(items))
  }

  list(): AppNotification[] {
    return this.read()
  }

  add(input: NotificationInput): AppNotification {
    const item: AppNotification = {
      id: uid(),
      kind: input.kind,
      title: input.title,
      body: input.body,
      createdAt: Date.now(),
      read: false,
      actionUrl: input.actionUrl,
      actionLabel: input.actionLabel,
    }
    this.write([item, ...this.read()])
    return item
  }

  markRead(id: string): void {
    this.write(this.read().map((n) => n.id === id ? { ...n, read: true } : n))
  }

  markAllRead(): void {
    this.write(this.read().map((n) => n.read ? n : { ...n, read: true }))
  }

  remove(id: string): void {
    this.write(this.read().filter((n) => n.id !== id))
  }

  clear(): void {
    this.write([])
  }

  subscribe(listener: (items: AppNotification[]) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

export function createNotificationRepository(): NotificationRepository {
  return new StoreNotificationRepository()
}
