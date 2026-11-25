import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  notifRepo,
  getSystemNotifyEnabled,
  setSystemNotifyEnabled,
  type AppNotification,
  type NotificationInput,
} from '../data/notifications'

export function useNotifications() {
  const [items, setItems] = useState<AppNotification[]>(() => notifRepo.list())
  const [systemEnabled, setSystemEnabledState] = useState<boolean>(() => getSystemNotifyEnabled())

  useEffect(() => notifRepo.subscribe(setItems), [])

  /** 推送一条通知：应用内入库 +（可选）弹系统通知 */
  const notify = useCallback((input: NotificationInput) => {
    const item = notifRepo.add(input)
    // 每次读开关，避免闭包拿到旧值
    if (getSystemNotifyEnabled()) {
      const api = (window as any).nexus
      if (api?.isElectron && typeof api.notifyShow === 'function') {
        api.notifyShow({ title: input.title, body: input.body }).catch(() => {})
      }
    }
    return item
  }, [])

  const toggleSystemEnabled = useCallback((enabled: boolean) => {
    setSystemNotifyEnabled(enabled)
    setSystemEnabledState(enabled)
  }, [])

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items])
  const todayCount = useMemo(() => {
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    return items.filter((n) => n.createdAt >= start).length
  }, [items])

  return {
    items,
    unreadCount,
    todayCount,
    systemEnabled,
    notify,
    toggleSystemEnabled,
    // 必须包装一层：直接返回实例方法会丢失 this，导致仓储内部调用 read/write 失败
    markRead: (id: string) => notifRepo.markRead(id),
    markAllRead: () => notifRepo.markAllRead(),
    remove: (id: string) => notifRepo.remove(id),
    clear: () => notifRepo.clear(),
  }
}
