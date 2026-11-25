import type { Task } from '../data/repository'
import {
  useWeeklyReport,
} from '../hooks/useWeeklyReport'
import type { ReportGroup, ReportSource } from '../data/weeklyReport'

interface Props {
  tasks: Task[]
  onClose: () => void
  onOpenUrl: (url: string) => void
  showToast: (msg: string) => void
}

type Section = 'work' | 'plan'

const SOURCE_LABEL: Record<ReportSource, string> = {
  jira: 'Jira',
  svn: 'SVN',
  local: '本地',
  manual: '手动',
}

export default function WeeklyReportPanel({ tasks, onClose, onOpenUrl, showToast }: Props) {
  const wr = useWeeklyReport(tasks)
  const { report, weekLabel, loading, error, markdown, hasJira, hasSvn } = wr

  const copyMarkdown = async () => {
    if (!report) return
    try {
      await navigator.clipboard.writeText(markdown)
    } catch {
      // file:// 下 Clipboard API 可能受限，退回 execCommand
      const ta = document.createElement('textarea')
      ta.value = markdown
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      if (!ok) { showToast('复制失败，请检查剪贴板权限'); return }
    }
    showToast('周报 Markdown 已复制到剪贴板')
  }

  const regenerate = async () => {
    if (!window.confirm('重新聚合会覆盖你手动修改的内容，确定继续吗？')) return
    await wr.regenerate()
    showToast('已从 Jira / SVN / 本地任务重新生成周报')
  }

  return (
    <div className="wr-mask" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="wr-panel">
        <div className="wr-hd">
          <div>
            <div className="modal-eyebrow">WEEKLY REPORT · 周报生成</div>
            <div className="modal-title">工作周报 <span className="wr-week">{weekLabel}</span></div>
          </div>
          <div className="wr-hd-actions">
            <button className="btn-ghost wr-btn" onClick={regenerate} disabled={loading}>↻ 重新聚合</button>
            <button className="btn-primary wr-btn" onClick={copyMarkdown} disabled={!report}>复制 Markdown</button>
            <span className="modal-x" onClick={onClose}>✕</span>
          </div>
        </div>

        <div className="wr-status">
          <span>数据来源：<b className={hasJira ? 'ok' : 'off'}>Jira {hasJira ? '已连接' : '未连接'}</b> · <b className={hasSvn ? 'ok' : 'off'}>SVN {hasSvn ? '已连接' : '未连接'}</b> · <b>本地任务 {tasks.length} 项</b></span>
          {loading && <span className="wr-loading">正在加载数据源…</span>}
          {error && !loading && <span className="wr-err">{error}</span>}
        </div>

        <div className="wr-body">
          {!report ? (
            <div className="wr-loading-full">{loading ? '正在生成周报…' : '暂无周报数据'}</div>
          ) : (
            <>
              <SectionBlock
                section="work"
                title="一、本周工作内容"
                subtitle="来自 Jira 本周完成、SVN 本周提交、本地已完成任务"
                groups={report.work}
                wr={wr}
                onOpenUrl={onOpenUrl}
              />
              <SectionBlock
                section="plan"
                title="二、下周工作计划"
                subtitle="来自 Jira 未完成事项、本地待办任务"
                groups={report.plan}
                wr={wr}
                onOpenUrl={onOpenUrl}
              />
            </>
          )}
        </div>

        <div className="wr-foot">
          {report && (
            <span>
              {report.edited ? '已手动编辑' : '自动生成'} · 更新于 {new Date(report.generatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} · 内容自动保存
            </span>
          )}
          <span className="wr-foot-hint">点击文字直接修改 · 复制后可粘贴到任意周报系统</span>
        </div>
      </div>
    </div>
  )
}

function SectionBlock({
  section, title, subtitle, groups, wr, onOpenUrl,
}: {
  section: Section
  title: string
  subtitle: string
  groups: ReportGroup[]
  wr: ReturnType<typeof useWeeklyReport>
  onOpenUrl: (url: string) => void
}) {
  return (
    <div className={`wr-section wr-${section}`}>
      <div className="wr-section-hd">
        <div><h2>{title}</h2><span>{subtitle}</span></div>
        <span className="wr-add-group" onClick={() => wr.addGroup(section)}>+ 添加项目</span>
      </div>
      <div className="wr-groups">
        {groups.length === 0 && <div className="wr-empty">暂无内容，点击「添加项目」手动补充</div>}
        {groups.map((g) => (
          <div className="wr-group" key={g.id}>
            <div className="wr-group-hd">
              <input
                className="wr-group-name"
                value={g.name}
                placeholder="项目名称"
                onChange={(e) => wr.renameGroup(section, g.id, e.target.value)}
              />
              <span className="wr-group-count">{g.items.length} 项</span>
              <span className="wr-group-del" title="删除该项目" onClick={() => wr.removeGroup(section, g.id)}>×</span>
            </div>
            <div className="wr-items">
              {g.items.length === 0 && <div className="wr-empty-group">暂无内容，点击「+ 添加一条」补充</div>}
              {g.items.map((item) => (
                <div className="wr-item" key={item.id}>
                  <span className={`wr-src src-${item.source}`}>{SOURCE_LABEL[item.source]}</span>
                  <input
                    value={item.text}
                    placeholder="输入工作内容…"
                    onChange={(e) => wr.updateItem(section, g.id, item.id, e.target.value)}
                  />
                  {item.url && <span className="wr-link" title="打开来源" onClick={() => onOpenUrl(item.url!)}>↗</span>}
                  <span className="wr-item-del" title="删除这条" onClick={() => wr.removeItem(section, g.id, item.id)}>×</span>
                </div>
              ))}
              <div className="wr-add-item" onClick={() => wr.addItem(section, g.id)}>+ 添加一条</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
