import { useFocus } from '../hooks/useFocus'

interface Props {
  onClose: () => void
}

const PRESETS = [15, 25, 45, 60]
const LABELS = ['编码', '学习', '阅读', '其他']

export default function FocusPanel({ onClose }: Props) {
  const focus = useFocus()
  const { active, isRunning, mmss, progress, todayMinutes } = focus
  const R = 52
  const C = 2 * Math.PI * R

  return (
    <div className="focus-mask" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="focus-panel">
        <div className="focus-hd">
          <div>
            <div className="modal-eyebrow">FOCUS · 专注计时</div>
            <div className="modal-title">番茄钟</div>
          </div>
          <span className="modal-x" onClick={onClose}>✕</span>
        </div>

        <div className="focus-body">
          <div className={`focus-ring ${isRunning ? 'running' : ''}`}>
            <svg viewBox="0 0 124 124">
              <circle className="bg" cx="62" cy="62" r={R} />
              <circle className="fg" cx="62" cy="62" r={R}
                strokeDasharray={C}
                strokeDashoffset={C * (1 - progress)} />
            </svg>
            <div className="focus-ring-mid">
              <b>{mmss}</b>
              <span>{active.status === 'running' ? '专注中' : active.status === 'paused' ? '已暂停' : '准备开始'}</span>
            </div>
          </div>

          <div className="focus-label">专注内容</div>
          <div className="focus-labels">
            {LABELS.map((l) => (
              <span key={l} className={`focus-label-chip ${active.label === l ? 'on' : ''}`}
                onClick={() => focus.setLabel(l)}>{l}</span>
            ))}
          </div>

          <div className="focus-label">时长（分钟）</div>
          <div className="focus-presets">
            {PRESETS.map((m) => (
              <span key={m} className={`focus-preset ${Math.round(active.totalSeconds / 60) === m && active.status === 'idle' ? 'on' : ''}`}
                aria-disabled={active.status !== 'idle'}
                onClick={() => { if (active.status === 'idle') focus.setPreset(m) }}>{m}</span>
            ))}
          </div>

          <div className="focus-actions">
            {active.status === 'idle' && (
              <button className="btn-primary focus-big" onClick={() => focus.start()}>开始专注</button>
            )}
            {active.status === 'running' && (
              <>
                <button className="btn-ghost focus-big" onClick={focus.pause}>暂停</button>
                <button className="btn-ghost danger focus-big" onClick={focus.stop}>结束</button>
              </>
            )}
            {active.status === 'paused' && (
              <>
                <button className="btn-primary focus-big" onClick={focus.resume}>继续</button>
                <button className="btn-ghost danger focus-big" onClick={focus.stop}>结束</button>
              </>
            )}
          </div>

          <div className="focus-foot">
            今日已专注 <b>{todayMinutes}</b> 分钟 · 共 {focus.sessions.length} 次记录
          </div>
        </div>
      </div>
    </div>
  )
}
