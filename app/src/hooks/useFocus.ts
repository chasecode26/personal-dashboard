import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { focusRepo, todayFocusMinutes, type FocusSession } from '../data/repository'
import * as store from '../data/store'

const KEY_ACTIVE = 'nexus.focus.active.v1'

export type FocusStatus = 'idle' | 'running' | 'paused'

export interface ActiveFocus {
  status: FocusStatus
  totalSeconds: number     // 本轮总时长
  remainingSeconds: number // 剩余秒数（基于 endAt 计算，刷新不漂）
  endAt: number | null     // 运行时的结束时间戳
  label: string
}

export interface FocusEvents {
  onComplete?: (minutes: number, label: string) => void
  onStop?: (minutes: number, label: string) => void
}

const DEFAULT_ACTIVE: ActiveFocus = {
  status: 'idle',
  totalSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  endAt: null,
  label: '编码',
}

function readActive(): ActiveFocus {
  // 解析失败后每秒的 writeActive 会把默认值写回，必须由 readJson 标记为只读
  const res = store.readJson(
    KEY_ACTIVE,
    (v): v is ActiveFocus => Boolean(v) && ['idle', 'running', 'paused'].includes((v as ActiveFocus).status),
    '专注状态',
  )
  return res.value || { ...DEFAULT_ACTIVE }
}

function writeActive(a: ActiveFocus) {
  store.setItem(KEY_ACTIVE, JSON.stringify(a))
}

export function useFocus(events?: FocusEvents) {
  const [active, setActive] = useState<ActiveFocus>(() => readActive())
  const [sessions, setSessions] = useState<FocusSession[]>(() => focusRepo.list())
  const activeRef = useRef(active)
  activeRef.current = active
  // 回调用 ref 保存，避免计时器闭包拿到旧函数
  const eventsRef = useRef(events)
  eventsRef.current = events

  useEffect(() => focusRepo.subscribe(setSessions), [])

  // 到点自动完成并记录会话（避免重复：用 endAt + 状态判断）
  const complete = useCallback(() => {
    const a = activeRef.current
    if (a.status !== 'running') return
    const minutes = Math.max(1, Math.round(a.totalSeconds / 60))
    focusRepo.add({
      startedAt: Date.now() - a.totalSeconds * 1000,
      endedAt: Date.now(),
      minutes,
      label: a.label || '专注',
    })
    const done: ActiveFocus = { ...a, status: 'idle', remainingSeconds: a.totalSeconds, endAt: null }
    setActive(done)
    writeActive(done)
    eventsRef.current?.onComplete?.(minutes, a.label || '专注')
    return minutes
  }, [])

  // 每秒重算剩余时间（running 时基于 endAt），到点则完成
  useEffect(() => {
    const tick = () => {
      const a = activeRef.current
      if (a.status !== 'running' || !a.endAt) return
      const remaining = Math.max(0, Math.ceil((a.endAt - Date.now()) / 1000))
      if (remaining <= 0) { complete(); return }
      const next = { ...a, remainingSeconds: remaining }
      setActive(next)
      writeActive(next)
    }
    const t = window.setInterval(tick, 1000)
    tick()
    return () => window.clearInterval(t)
  }, [complete])

  const start = useCallback((minutes?: number, label?: string) => {
    const mins = minutes && minutes > 0 ? minutes : Math.round(activeRef.current.totalSeconds / 60)
    const total = mins * 60
    const next: ActiveFocus = {
      status: 'running',
      totalSeconds: total,
      remainingSeconds: total,
      endAt: Date.now() + total * 1000,
      label: label ?? activeRef.current.label,
    }
    setActive(next); writeActive(next)
    return next
  }, [])

  const pause = useCallback(() => {
    const a = activeRef.current
    if (a.status !== 'running') return
    const remaining = a.endAt ? Math.max(0, Math.ceil((a.endAt - Date.now()) / 1000)) : a.remainingSeconds
    const next = { ...a, status: 'paused' as const, remainingSeconds: remaining, endAt: null }
    setActive(next); writeActive(next)
  }, [])

  const resume = useCallback(() => {
    const a = activeRef.current
    if (a.status !== 'paused') return
    const next: ActiveFocus = {
      ...a,
      status: 'running',
      endAt: Date.now() + a.remainingSeconds * 1000,
    }
    setActive(next); writeActive(next)
  }, [])

  // 提前结束：按已专注的时长（总-剩余）记录，不足 1 分钟按 1 分钟
  const stop = useCallback(() => {
    const a = activeRef.current
    if (a.status === 'idle') return
    const remaining = a.status === 'running' && a.endAt
      ? Math.max(0, Math.ceil((a.endAt - Date.now()) / 1000))
      : a.remainingSeconds
    const elapsedSec = a.totalSeconds - remaining
    const minutes = Math.max(1, Math.round(elapsedSec / 60))
    if (elapsedSec >= 60) {
      focusRepo.add({
        startedAt: Date.now() - elapsedSec * 1000,
        endedAt: Date.now(),
        minutes,
        label: a.label || '专注',
      })
      eventsRef.current?.onStop?.(minutes, a.label || '专注')
    }
    const next: ActiveFocus = { ...a, status: 'idle', remainingSeconds: a.totalSeconds, endAt: null }
    setActive(next); writeActive(next)
    return minutes
  }, [])

  const setPreset = useCallback((minutes: number) => {
    const a = activeRef.current
    if (a.status !== 'idle') return
    const next: ActiveFocus = { ...a, totalSeconds: minutes * 60, remainingSeconds: minutes * 60, label: a.label }
    setActive(next); writeActive(next)
  }, [])

  const setLabel = useCallback((label: string) => {
    const next = { ...activeRef.current, label }
    setActive(next); writeActive(next)
  }, [])

  const todayMinutes = useMemo(() => todayFocusMinutes(sessions), [sessions])
  const progress = active.totalSeconds ? (active.totalSeconds - active.remainingSeconds) / active.totalSeconds : 0
  const mmss = useMemo(() => {
    const m = Math.floor(active.remainingSeconds / 60)
    const s = active.remainingSeconds % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }, [active.remainingSeconds])

  return {
    active, sessions, todayMinutes, progress, mmss,
    start, pause, resume, stop, setPreset, setLabel,
    isRunning: active.status === 'running',
  }
}
