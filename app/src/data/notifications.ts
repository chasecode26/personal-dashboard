/**
 * 通知仓储
 * ------------------------------------------------------------------
 * 应用内通知统一持久化（Electron 下落盘 JSON，浏览器回退 localStorage），最多保留 100 条；
 * 系统通知（Electron Notification）由主进程负责，仓储只管数据与开关。
 */
import * as store from './store'
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
  // store.getItem 内部已捕获异常，浏览器回退失败时返回 null
  return store.getItem(KEY_SYSTEM) !== '0'
}

export function setSystemNotifyEnabled(enabled: boolean): void {
  store.setItem(KEY_SYSTEM, enabled ? '1' : '0')
}
