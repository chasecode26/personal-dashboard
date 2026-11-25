import { useMemo } from 'react'
import { useNotifications } from '../hooks/useNotifications'
import type { AppNotification, NotificationKind } from '../data/notifications'

interface Props {
  onClose: () => void
  onOpenUrl: (url: string) => void
}

const KIND_META: Record<NotificationKind, { icon: string; label: string; color: string; bg: string }> = {
  focus: { icon: 'i-clock', label: '专注', color: 'var(--bl)', bg: 'rgba(90,169,255,.14)' },
  jira: { icon: 'i-code', label: 'Jira', color: 'var(--am)', bg: 'rgba(255,207,92,.16)' },
  svn: { icon: 'i-folder', label: 'SVN', color: 'var(--gr)', bg: 'rgba(57,230,160,.14)' },
  system: { icon: 'i-bell', label: '系统', color: 'var(--pu)', bg: 'rgba(155,123,255,.14)' },
}

const pad = (n: number) => String(n).padStart(2, '0')

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts)
  if (diff < 60_000) return '刚刚'
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))} 小时前`
  const d = new Date(ts)
  if (diff < 48 * 60 * 60_000) return `昨天 ${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${d.getMonth() + 1}-${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function NotificationPanel({ onClose, onOpenUrl }: Props) {
  const notifications = useNotifications()
  const { items, unreadCount, todayCount, systemEnabled } = notifications

  const groups = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const today = items.filter((n) => n.createdAt >= start)
    const earlier = items.filter((n) => n.createdAt < start)
    return [
      { label: '今天', items: today },
      { label: '更早', items: earlier },
    ].filter((g) => g.items.length > 0)
  }, [items])

  return (
    <div className="n-mask" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="n-panel">
        <div className="n-hd">
          <div>
            <div className="modal-eyebrow">INBOX · 通知中心</div>
            <div className="modal-title">消息 <span className="n-unread-title">{unreadCount} 条未读</span></div>
          </div>
          <span className="modal-x" onClick={onClose}>✕</span>
        </div>

        <div className="n-actions">
          <span onClick={notifications.markAllRead} aria-disabled={unreadCount === 0}>全部标为已读</span>
          <span onClick={notifications.clear} aria-disabled={items.length === 0}>清空</span>
          <span className="n-actions-today">今日 {todayCount} 条</span>
        </div>

        <div className="n-list">
          {groups.length === 0 && (
            <div className="n-empty">
              <svg><use href="#i-bell" /></svg>
              <b>暂无通知</b>
              <span>专注结束、Jira / SVN 有新变化时<br />会在这里提醒你</span>
            </div>
          )}
          {groups.map((g) => (
            <div className="n-group" key={g.label}>
              <div className="n-group-label">{g.label}</div>
              {g.items.map((n) => {
                const meta = KIND_META[n.kind] || KIND_META.system
                return (
                  <div
                    key={n.id}
                    className={`n-item ${n.read ? '' : 'unread'}`}
                    title={n.actionUrl ? (n.actionLabel || '点击打开') : undefined}
                    onClick={() => {
                      notifications.markRead(n.id)
                      if (n.actionUrl) onOpenUrl(n.actionUrl)
                    }}
                  >
                    <div className="n-ico" style={{ color: meta.color, background: meta.bg }}>
                      <svg><use href={`#${meta.icon}`} /></svg>
                    </div>
                    <div className="n-content">
                      <div className="n-line">
                        <b>{n.title}</b>
                        {!n.read && <i className="n-dot" />}
                      </div>
                      <div className="n-body">{n.body}</div>
                      <div className="n-meta"><span style={{ color: meta.color }}>{meta.label}</span><span>{timeAgo(n.createdAt)}</span></div>
                    </div>
                    <span className="n-del" title="删除这条" onClick={(e) => { e.stopPropagation(); notifications.remove(n.id) }}>×</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="n-foot">
          <div className="n-setting" onClick={() => notifications.toggleSystemEnabled(!systemEnabled)}>
            <span>系统桌面通知</span>
            <span className={`n-switch ${systemEnabled ? 'on' : ''}`}><i /></span>
          </div>
          <div className="n-hint">关闭后消息仍会保存在这里，只是不弹系统通知</div>
        </div>
      </div>
    </div>
  )
}
