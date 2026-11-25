/**
 * 通知仓储
 * ------------------------------------------------------------------
 * 应用内通知统一持久化到 localStorage，最多保留 100 条；
 * 系统通知（Electron Notification）由主进程负责，仓储只管数据与开关。
 */
import { createNotificationRepository } from './notificationRepository'

export type NotificationKind = 'focus' | 'jira' | 'svn' | 'system'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  createdAt: number
  read: boolean
  actionUrl?: string   // 点击后可在系统浏览器打开（如 Jira issue / SVN 仓库）
  actionLabel?: string
}

export type NotificationInput = Pick<AppNotification, 'kind' | 'title' | 'body'> &
  Partial<Pick<AppNotification, 'actionUrl' | 'actionLabel'>>

export const notifRepo = createNotificationRepository()

const KEY_SYSTEM = 'nexus.notify.system.v1'

export function getSystemNotifyEnabled(): boolean {
  try {
    return localStorage.getItem(KEY_SYSTEM) !== '0'
  } catch {
    return true
  }
}

export function setSystemNotifyEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(KEY_SYSTEM, enabled ? '1' : '0')
  } catch {}
}
