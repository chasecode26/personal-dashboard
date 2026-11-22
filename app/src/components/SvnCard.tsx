import Card from './Card'
import type { CardBackground } from '../hooks/useCardBackgrounds'
import type { SvnCommit, SvnGroup, SvnLogData } from '../hooks/useSvn'

function timeAgo(s: string) {
  if (!s) return ''
  const diff = Date.now() - new Date(s).getTime()
  if (isNaN(diff)) return ''
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m}分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}小时前`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}天前`
  return new Date(s).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

const ACTION_LABEL: Record<string, string> = { A: '新增', M: '修改', D: '删除', R: '替换' }

function CommitRow({ c }: { c: SvnCommit }) {
  const adds = c.paths.filter((p) => p.action === 'A').length
  const mods = c.paths.filter((p) => p.action === 'M').length
  const dels = c.paths.filter((p) => p.action === 'D').length
  const tip = c.paths.length
    ? c.paths.map((p) => `[${ACTION_LABEL[p.action] || p.action}] ${p.path}`).join('\n')
    : '无变更路径'
  return (
    <div className="svn-commit" title={tip}>
      <div className="sc-top">
        <span className="sc-rev">r{c.revision}</span>
        <span className="sc-msg">{c.message || '（无提交说明）'}</span>
      </div>
      <div className="sc-meta">
        <span className="sc-author">{c.author || '未知'}</span>
        <span className="sc-time">{timeAgo(c.date)}</span>
        {c.paths.length > 0 && (
          <span className="sc-paths">
            {adds > 0 && <b className="sc-a">+{adds}</b>}
            {mods > 0 && <b className="sc-m">~{mods}</b>}
            {dels > 0 && <b className="sc-d">-{dels}</b>}
          </span>
        )}
      </div>
    </div>
  )
}

function GroupBlock({ group, defaultOpen }: { group: SvnGroup; defaultOpen: boolean }) {
  return (
    <div className="svn-group">
      <div className="sg-head">
        <span className="sg-dot" />
        <span className="sg-name">{group.name}</span>
        <span className="sg-count">{group.commits.length}</span>
        <span className="sg-url" title={group.url}>{group.url.replace(/^https?:\/\//, '')}</span>
      </div>
      {group.error ? (
        <div className="sg-err">{group.error}</div>
      ) : group.commits.length === 0 ? (
        <div className="sg-empty">暂无提交记录</div>
      ) : (
        <div className="sg-list">
          {group.commits.slice(0, defaultOpen ? 12 : 8).map((c) => <CommitRow key={c.revision} c={c} />)}
        </div>
      )}
    </div>
  )
}

interface Props {
  bg?: CardBackground
  onEditBg?: (id: string) => void
  logs: SvnLogData | null
  loading: boolean
  error: string
  onRefresh: () => void
  onConfig: () => void
}

export default function SvnCard({ bg, onEditBg, logs, loading, error, onRefresh, onConfig }: Props) {
  const synced = logs?.syncedAt ? new Date(logs.syncedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''
  const total = logs?.counts?.commits ?? 0

  return (
    <Card id="svn" className="svn-card" bg={bg} onEditBg={onEditBg}>
      <div className="hd">
        <div>
          <div className="eyebrow">SVN · 提交记录</div>
          <h3><span className="dot" />代码动态{total > 0 && <span className="svn-total">{total} 条</span>}</h3>
        </div>
        <div className="svn-actions">
          {synced && !loading && <span className="svn-synced">{synced}</span>}
          <span className="svn-act" title="刷新 SVN 提交记录" onClick={onRefresh}>↻</span>
          <span className="svn-act" title="配置 SVN 连接" onClick={onConfig}>⚙</span>
        </div>
      </div>

      {loading && <div className="svn-state">正在从 SVN 拉取提交记录…</div>}
      {!loading && error && (
        <div className="svn-state err">加载失败：{error}<span className="svn-link" onClick={onConfig}>检查配置</span></div>
      )}
      {!loading && !error && !logs && (
        <div className="svn-empty-config">
          <div className="sec-icon">⌥</div>
          <div className="sec-title">还没有连接 SVN</div>
          <div className="sec-desc">配置仓库地址与账号密码后，这里按项目分组显示最近的提交记录。</div>
          <button className="sec-btn" onClick={onConfig}>连接 SVN</button>
        </div>
      )}
      {!loading && logs && (
        <div className="svn-groups">
          {logs.groups.map((g, i) => <GroupBlock key={g.url + i} group={g} defaultOpen={i === 0} />)}
        </div>
      )}
    </Card>
  )
}
