import Card from './Card'
import type { CardBackground } from '../hooks/useCardBackgrounds'
import type { JiraIssue, JiraBoardData } from '../hooks/useJira'

type Mode = 'todo' | 'bugs' | 'done'

function timeAgo(iso: string) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  if (isNaN(diff)) return ''
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  return `${d} 天前`
}

function IssueRow({ issue, onOpen }: { issue: JiraIssue; onOpen: (url: string) => void }) {
  const cat = issue.type === 'Bug' || issue.type.includes('缺陷')
  return (
    <div className="jira-issue" onClick={() => issue.url && onOpen(issue.url)} title={`${issue.key} · 点击在浏览器打开`}>
      <span className={`ji-mark ${cat ? 'bug' : 'task'}`}>{cat ? '◆' : '■'}</span>
      <div className="ji-body">
        <div className="ji-line"><span className="ji-key">{issue.key}</span><span className="ji-sum">{issue.summary}</span></div>
        <div className="ji-meta">
          <span className="ji-status">{issue.status}</span>
          {issue.priority && <span className="ji-prio">{issue.priority}</span>}
          <span className="ji-ago">{timeAgo(issue.updated || issue.resolved)}</span>
        </div>
      </div>
    </div>
  )
}

function Column({ mode, title, subtitle, issues, onOpen }: {
  mode: Mode; title: string; subtitle: string; issues: JiraIssue[]; onOpen: (url: string) => void
}) {
  return (
    <div className={`jira-col ${mode}`}>
      <div className="jc-head">
        <span className="jc-dot" />
        <div className="jc-title">{title}<span className="jc-count">{issues.length}</span></div>
        <div className="jc-sub">{subtitle}</div>
      </div>
      <div className="jc-list">
        {issues.length === 0 && <div className="jc-empty">暂无{title}</div>}
        {issues.map((it) => <IssueRow key={it.key} issue={it} onOpen={onOpen} />)}
      </div>
    </div>
  )
}

interface Props {
  bg?: CardBackground
  onEditBg?: (id: string) => void
  board: JiraBoardData | null
  loading: boolean
  error: string
  projectKey: string
  onRefresh: () => void
  onConfig: () => void
  onReport: () => void
}

export default function JiraBoardCard({ bg, onEditBg, board, loading, error, projectKey, onRefresh, onConfig, onReport }: Props) {
  const openExternal = (url: string) => {
    const nexus = (window as any).nexus
    if (nexus?.openExternal) nexus.openExternal(url)
    else window.open(url, '_blank')
  }
  const synced = board?.syncedAt ? new Date(board.syncedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <Card id="jira" className="jira-card" bg={bg} onEditBg={onEditBg}>
      <div className="hd">
        <div>
          <div className="eyebrow">JIRA · 研发工作台{projectKey ? ` · ${projectKey}` : ''}</div>
          <h3><span className="dot" />我的工作追踪</h3>
        </div>
        <div className="jira-actions">
          {synced && !loading && <span className="jira-synced">同步于 {synced}</span>}
          <span className="jira-act" title="生成本周周报" onClick={onReport}>▤ 周报</span>
          <span className="jira-act" title="刷新 Jira 数据" onClick={onRefresh}>↻ 刷新</span>
          <span className="jira-act" title="配置 Jira 连接" onClick={onConfig}>⚙ 配置</span>
        </div>
      </div>

      {loading && <div className="jira-state">正在从 Jira 拉取数据…</div>}
      {!loading && error && (
        <div className="jira-state err">加载失败：{error}<span className="jira-link" onClick={onConfig}>检查配置</span></div>
      )}
      {!loading && !error && !board && (
        <div className="jira-empty-config">
          <div className="jec-icon">◇</div>
          <div className="jec-title">还没有连接 Jira</div>
          <div className="jec-desc">配置地址与 API Token 后，这里会显示你名下的待办任务、待修 BUG 和今日完成。</div>
          <button className="jec-btn" onClick={onConfig}>连接 Jira</button>
        </div>
      )}
      {!loading && board && (
        <div className="jira-cols">
          <Column mode="todo" title="待办任务" subtitle="分配给我的 · 未完成" issues={board.todo} onOpen={openExternal} />
          <Column mode="bugs" title="待修 BUG" subtitle="缺陷优先处理" issues={board.bugs} onOpen={openExternal} />
          <Column mode="done" title="今日完成" subtitle="今天已解决" issues={board.done} onOpen={openExternal} />
        </div>
      )}
    </Card>
  )
}
