import { useEffect, useMemo, useState } from 'react'
import Icons from './components/Icons'
import Card from './components/Card'
import { taskRepo, type Task, type TaskCategory } from './data/repository'
import { useTheme, THEMES } from './hooks/useTheme'
import { useCardBackgrounds, type CardBackground } from './hooks/useCardBackgrounds'
import { useJira } from './hooks/useJira'
import JiraBoardCard from './components/JiraBoard'
import JiraConfigModal from './components/JiraConfigModal'
import { useSvn } from './hooks/useSvn'
import SvnCard from './components/SvnCard'
import SvnConfigModal from './components/SvnConfigModal'

const base = import.meta.env.BASE_URL
const HERO_IMG = `url('${base}assets/hero-landscape.png')`
const POSTER_IMG = `url('${base}assets/scenery-poster.png')`

const NAV = [
  { id: 'grid', title: '总览' }, { id: 'check', title: '任务' },
  { id: 'cal', title: '日程' }, { id: 'tool', title: '工具' },
  { id: 'book', title: '学习' }, { id: 'heart', title: '健康' },
  { id: 'set', title: '设置' },
]

const CATEGORY_LABEL: Record<TaskCategory, string> = { work: '工作', life: '生活', study: '学习' }
const CATEGORY_CLASS: Record<TaskCategory, string> = { work: 't-work', life: 't-life', study: 't-study' }
const PRIORITY_CLASS = { high: 'p-h', medium: 'p-m', low: 'p-l' } as const

const MOODS = [
  { emoji: '😄', label: '开心', note: '状态不错！今天完成了重要的任务，继续保持良好的节奏。' },
  { emoji: '🙂', label: '平静', note: '心如止水，按部就班。平稳的一天也值得被记录。' },
  { emoji: '💪', label: '充实', note: '能量满满！每一件事都在推进，这种感觉很棒。' },
  { emoji: '😌', label: '放松', note: '给自己松松弦，休息也是生产力的一部分。' },
  { emoji: '🥱', label: '疲惫', note: '有点累了，早点休息，明天再继续加油。' },
]

const WEEK = [
  { day: '一', v: 6 }, { day: '二', v: 9 }, { day: '三', v: 7 },
  { day: '四', v: 12 }, { day: '五', v: 8 }, { day: '六', v: 5 }, { day: '日', v: 0 },
]

export default function App() {
  const { theme, setTheme } = useTheme()
  const { get: getBg, set: setBg } = useCardBackgrounds()
  const jira = useJira()
  const [jiraConfigOpen, setJiraConfigOpen] = useState(false)
  const svn = useSvn()
  const [svnConfigOpen, setSvnConfigOpen] = useState(false)

  const [tasks, setTasks] = useState<Task[]>(() => taskRepo.list())
  const [filter, setFilter] = useState<'all' | TaskCategory>('all')
  const [newTask, setNewTask] = useState('')
  const [mood, setMood] = useState(0)
  const [nav, setNav] = useState('grid')
  const [themeOpen, setThemeOpen] = useState(false)
  const [bgEditor, setBgEditor] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2400)
  }

  const dockOpen = async (kind: 'terminal' | 'code' | 'folder') => {
    const api = (window as any).nexus
    if (!api?.isElectron) { showToast('请在桌面客户端中使用'); return }
    const r = await api.dockOpen(kind)
    if (r?.ok) showToast({ terminal: '已打开终端', code: '已打开代码编辑器', folder: '已打开文件管理器' }[kind]!)
    else showToast('打开失败：' + (r?.msg || '未知错误'))
  }

  useEffect(() => taskRepo.subscribe(setTasks), [])
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  // Jira 配置就绪后自动拉一次数据
  useEffect(() => {
    if (jira.ready && jira.config?.baseUrl && jira.config?.token) jira.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jira.ready, jira.config])
  // SVN 配置就绪后自动拉一次提交记录
  useEffect(() => {
    if (svn.ready && svn.config && svn.config.repos.length > 0) svn.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svn.ready, svn.config])

  // 图片路径变量注入到根元素，供所有卡片的背景图引用（兼容 dev / file:// 打包）
  useEffect(() => {
    document.documentElement.style.setProperty('--hero-img', HERO_IMG)
    document.documentElement.style.setProperty('--poster-img', POSTER_IMG)
  }, [])

  const doneCount = tasks.filter((t) => t.done).length
  const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0
  const visibleTasks = tasks.filter((t) => filter === 'all' || t.category === filter)

  const heroDate = useMemo(() => {
    const wd = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()]
    const p = (n: number) => String(n).padStart(2, '0')
    return `${now.getFullYear()}.${p(now.getMonth() + 1)}.${p(now.getDate())} ${wd}`
  }, [now])

  const clock = useMemo(() => {
    const p = (n: number) => String(n).padStart(2, '0')
    return `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`
  }, [now])

  const greeting = now.getHours() < 6 ? '夜深了' : now.getHours() < 12 ? '早上好' : now.getHours() < 18 ? '下午好' : '晚上好'

  const cardProps = (id: string, className = '') => ({
    id,
    className,
    bg: getBg(id),
    onEditBg: setBgEditor,
  })

  return (
    <>
      <Icons />
      <div className="scan" />

      <div className="topbar">
        <div className="brand">
          <div className="mark"><i /></div>
          <div><h1>NEXUS</h1><small>PERSONAL COMMAND</small></div>
        </div>
        <div className="search">
          <svg width="15" height="15" style={{ stroke: 'currentColor', fill: 'none', strokeWidth: 1.8 }}><use href="#i-search" /></svg>
          <input placeholder="搜索任务、网站、工具…" />
          <span className="kbd">Ctrl K</span>
        </div>
        <div className="top-right">
          <div className="sysdot"><i /> ONLINE</div>
          <div className="sysdot" style={{ marginLeft: 10 }}><i style={{ background: 'var(--bl)' }} /> {clock}</div>
          <div className="theme-wrap">
            <div className="theme-btn" title="切换主题色调" onClick={() => setThemeOpen((v) => !v)}>
              <svg><use href="#i-palette" /></svg>
            </div>
            {themeOpen && (
              <div className="theme-panel" style={{ display: 'block' }}>
                <div className="tp-title">THEME · 主题色调</div>
                <div className="tp-colors">
                  {THEMES.map((t) => (
                    <span
                      key={t.key}
                      title={t.label}
                      data-t={t.key}
                      className={theme === t.key ? 'on' : ''}
                      style={{ background: t.color }}
                      onClick={() => setTheme(t.key)}
                    />
                  ))}
                </div>
                <div className="tp-hint">点击色块实时切换强调色</div>
              </div>
            )}
          </div>
          <div className="avatar">LC</div>
        </div>
      </div>

      <div className="shell">
        <aside className="sidebar">
          {NAV.map((n, i) => (
            <div
              key={n.id}
              className={`nav ${nav === n.id ? 'on' : ''}`}
              style={i === NAV.length - 1 ? { marginTop: 'auto' } : undefined}
              title={n.title}
              onClick={() => setNav(n.id)}
            >
              <svg><use href={`#i-${n.id}`} /></svg>
            </div>
          ))}
          <div className="side-note">未来的你 · 会感谢现在努力的自己</div>
        </aside>

        <main className="main">
          <div className="hero">
            <div className="hero-in">
              <div className="hp">WELCOME BACK · {greeting}，蓝海深</div>
              <h1>个人全能工作台</h1>
              <div className="sub">把生活、学习、工作、健康都搬进一个地方。</div>
              <div className="callig">更自由</div>
              <div className="hero-meta">
                <div className="hm"><div className="ico"><svg><use href="#i-sun" /></svg></div><span>深圳 · 晴 <b>26°</b></span></div>
                <div className="hm"><div className="ico"><svg><use href="#i-cal" /></svg></div><span id="heroDate">{heroDate}</span></div>
              </div>
            </div>
          </div>

          <div className="stats">
            <StatRing color="var(--cy)" value={`${doneCount}/${tasks.length}`} label="今日待办" pct={progress} />
            <StatRing color="var(--pu)" value={<>95<span style={{ fontSize: 11 }}>min</span></>} label="今日学习" pct={75} />
            <StatRing color="var(--am)" value="-320" label="今日热量 kcal" pct={30} />
            <StatRing color="var(--gr)" value={<span style={{ color: 'var(--gr)' }}>+2,860</span>} label="今日收支 ¥" pct={80} />
            <StatRing color="var(--bl)" value="4.2h" label="专注时长" pct={60} />
          </div>

          <div className="dev-row">
            <div className="dev-jira">
              <JiraBoardCard
                bg={getBg('jira')}
                onEditBg={setBgEditor}
                board={jira.board}
                loading={jira.loading}
                error={jira.error}
                projectKey={jira.config?.projectKey || ''}
                onRefresh={jira.refresh}
                onConfig={() => setJiraConfigOpen(true)}
              />
            </div>
            <div className="dev-svn">
              <SvnCard
                bg={getBg('svn')}
                onEditBg={setBgEditor}
                logs={svn.logs}
                loading={svn.loading}
                error={svn.error}
                onRefresh={svn.refresh}
                onConfig={() => setSvnConfigOpen(true)}
              />
            </div>
          </div>

          <div className="grid">
            <Card {...cardProps('weather', 'w-card')}>
              <div className="w-bg" />
              <div className="w-in">
                <div className="eyebrow" style={{ color: '#d6e4f7' }}>WEATHER · 实时天气</div>
                <div className="w-temp">26<sup>°C</sup></div>
                <div className="w-desc"><div className="c">晴间多云 · 深圳南山区</div><div className="s">体感 28° · 空气优 · 适宜外出<br />今天也是适合出发的好天气</div></div>
                <div className="w-meta">
                  <div><div className="k">湿度</div><div className="v">62%</div></div>
                  <div><div className="k">风速</div><div className="v">3.2km/h</div></div>
                  <div><div className="k">紫外线</div><div className="v" style={{ color: 'var(--am)' }}>中等</div></div>
                  <div><div className="k">PM2.5</div><div className="v" style={{ color: 'var(--gr)' }}>18</div></div>
                </div>
                <div className="chart-lbl">未来 6 小时温度趋势</div>
                <svg className="linechart" viewBox="0 0 400 48" preserveAspectRatio="none">
                  <polyline className="ln" points="0,38 66,32 133,28 200,31 266,20 333,14 400,18" />
                  <circle cx="333" cy="14" r="3.5" />
                </svg>
              </div>
            </Card>

            <Card {...cardProps('week', 'week-card pu')}>
              <div className="hd"><div><div className="eyebrow">WEEKLY · 任务完成分布</div><h3><span className="dot" />本周工作</h3></div><span className="more">周报 ›</span></div>
              <div className="bars">
                {WEEK.map((d) => (
                  <div className={`bar ${d.day === '六' ? 'today' : ''}`} key={d.day}>
                    <div className="vl">{d.v}</div>
                    <div className="col" style={{ height: `${Math.max(d.v / 12 * 100, 4)}%`, ...(d.v === 0 ? { opacity: .4 } : {}) }} />
                    <div className="day">{d.day}</div>
                  </div>
                ))}
              </div>
              <div className="week-foot"><span>本周累计完成 <b>47</b> 项</span><span>日均 <b>7.8</b> 项</span></div>
            </Card>

            <Card {...cardProps('health', 'sport-card gr')}>
              <div className="hd"><div><div className="eyebrow">HEALTH · 今日活动</div><h3><span className="dot" />健康数据</h3></div><span className="more">数据同步 ›</span></div>
              <div className="ring-wrap">
                <div className="ring-big">
                  <svg viewBox="0 0 124 124"><circle className="bg" cx="62" cy="62" r="52" /><circle className="fg" cx="62" cy="62" r="52" /></svg>
                  <div className="mid"><b>8,560</b><span>/ 10,000 步</span></div>
                </div>
                <div className="health-metrics">
                  <div className="hm-item"><em style={{ color: 'var(--rd)' }}>♥</em><div className="v">72</div><div className="k">心率 bpm</div></div>
                  <div className="hm-item"><em style={{ color: 'var(--pu)' }}>☾</em><div className="v">7h32</div><div className="k">睡眠</div></div>
                  <div className="hm-item"><em style={{ color: 'var(--am)' }}>✦</em><div className="v">412</div><div className="k">消耗 kcal</div></div>
                </div>
              </div>
              <div className="health-chart">
                <div className="chart-lbl" style={{ color: 'var(--tx3)' }}>近 6 小时活动趋势</div>
                <svg className="spark" viewBox="0 0 400 42" preserveAspectRatio="none">
                  <polyline className="ln" points="0,34 57,30 114,32 171,22 228,26 285,14 342,20 400,8" />
                  <circle cx="400" cy="8" r="3" fill="var(--gr)" />
                </svg>
              </div>
              <div className="sport-note"><i /> 数据来自 iPhone 健康 · 2 分钟前同步</div>
            </Card>

            <Card {...cardProps('tasks', 'task-card')}>
              <div className="hd">
                <div><div className="eyebrow">TASKS · 今日任务清单</div><h3><span className="dot" />待办事项</h3></div>
                <div className="tabs">
                  {(['all', 'work', 'life', 'study'] as const).map((c) => (
                    <span key={c} className={`tab ${filter === c ? 'on' : ''}`} onClick={() => setFilter(c)}>
                      {c === 'all' ? '全部' : CATEGORY_LABEL[c]}
                    </span>
                  ))}
                </div>
              </div>
              <div className="task-list">
                {visibleTasks.length === 0 && <div style={{ color: 'var(--tx3)', fontSize: 12, padding: '14px 0' }}>暂无任务</div>}
                {visibleTasks.map((t) => (
                  <div className={`task ${t.done ? 'done' : ''}`} key={t.id} data-c={t.category}>
                    <div className="cb" onClick={() => taskRepo.toggle(t.id)}>
                      <svg><use href="#i-check" /></svg>
                    </div>
                    <div className="tt">{t.title}</div>
                    <span className={`tag ${CATEGORY_CLASS[t.category]}`}>{CATEGORY_LABEL[t.category]}</span>
                    <span className={`prio ${PRIORITY_CLASS[t.priority]}`} />
                    <span className="task-del" title="删除" onClick={() => taskRepo.remove(t.id)}>×</span>
                  </div>
                ))}
              </div>
              <div className="task-add">
                <input
                  value={newTask}
                  placeholder="添加新任务，回车确认…"
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTask.trim()) {
                      taskRepo.add({ title: newTask.trim(), category: filter === 'all' ? 'work' : filter, priority: 'medium' })
                      setNewTask('')
                    }
                  }}
                />
                <button onClick={() => {
                  if (newTask.trim()) {
                    taskRepo.add({ title: newTask.trim(), category: filter === 'all' ? 'work' : filter, priority: 'medium' })
                    setNewTask('')
                  }
                }}>+</button>
              </div>
              <div className="prog"><i style={{ width: `${progress}%` }} /></div>
            </Card>

            <Card {...cardProps('study', 'study-card pu')}>
              <div className="hd"><div><div className="eyebrow">LEARNING · 成长追踪</div><h3><span className="dot" />学习情况</h3></div><span className="more">详情 ›</span></div>
              <div className="study-top">
                <div><div className="big">95<small> min</small></div><div className="lbl">今日学习</div></div>
                <div><div className="big" style={{ color: 'var(--cy)' }}>12<small> 天</small></div><div className="lbl">连续打卡</div></div>
                <div className="streak"><b>86%</b><div className="lbl">本周目标</div></div>
              </div>
              <div className="skill">
                <SkillRow name="Rust 系统编程" val="12/24 节" pct={50} grad="linear-gradient(90deg,var(--pu),var(--cy))" />
                <SkillRow name="算法与数据结构" val="3/8 节" pct={38} grad="linear-gradient(90deg,var(--bl),var(--cy))" />
                <SkillRow name="读书计划" val="1/2 本" pct={50} grad="linear-gradient(90deg,var(--am),var(--rd))" />
              </div>
            </Card>

            <Card {...cardProps('apps', 'apps-card rd')}>
              <div className="hd"><div><div className="eyebrow">PROCESS · 当前占用</div><h3><span className="dot" />运行中的软件</h3></div><span className="more">6 个</span></div>
              <AppRow ab="VS" name="Visual Studio Code" color="var(--bl)" bg="rgba(90,169,255,.14)" w={62} pct="18%" />
              <AppRow ab="Ch" name="Chrome" color="var(--am)" bg="rgba(255,207,92,.14)" w={85} pct="24%" />
              <AppRow ab="Fg" name="Figma" color="var(--pu)" bg="rgba(155,123,255,.14)" w={40} pct="9%" />
              <AppRow ab="Tm" name="Terminal" color="var(--gr)" bg="rgba(57,230,160,.14)" w={22} pct="4%" />
              <AppRow ab="Nx" name="NEXUS 工作台" color="var(--cy)" bg="rgba(45,226,230,.14)" w={30} pct="7%" />
            </Card>

            <Card {...cardProps('schedule', 'schedule-card am')}>
              <div className="hd"><div><div className="eyebrow">SCHEDULE · 今日日程</div><h3><span className="dot" />时间线</h3></div><span className="more">全天 ›</span></div>
              <div className="tl">
                <TlItem time="09:00" name="晨会 & 需求同步" desc="团队 · 已参加" done />
                <TlItem time="10:30" name="与设计师沟通改版方案" desc="会议 · 已完成" done />
                <TlItem time="14:00" name="产品需求评审会" desc="会议 · 待开始" />
                <TlItem time="16:00" name="学习计划执行" desc="专注 · Rust 系统编程" />
                <TlItem time="19:30" name="健身 · 胸+三头" desc="生活 · 已安排" />
              </div>
            </Card>

            <Card {...cardProps('mood', 'mood-card am')}>
              <div className="hd"><div><div className="eyebrow">MOOD & GOAL · 状态</div><h3><span className="dot" />今日心情</h3></div><span className="more">记录 ›</span></div>
              <div className="moods">
                {MOODS.map((m, i) => (
                  <div className={`mood ${mood === i ? 'on' : ''}`} key={m.label} onClick={() => setMood(i)}>{m.emoji}<span>{m.label}</span></div>
                ))}
              </div>
              <div className="mood-note">{MOODS[mood].note}</div>
              <div className="goal">
                <div className="eyebrow">我的目标 · 本周</div>
                <GoalRow name="阅读 · 12/24 本" pct="50%" w={50} color="var(--gr)" />
                <GoalRow name="科研项目 · 3/8 项" pct="38%" w={38} color="var(--am)" />
                <GoalRow name="英语打卡 · 5/7 天" pct="71%" w={71} color="var(--cy)" />
              </div>
            </Card>

            <Card {...cardProps('quote', 'quote-card')}>
              <div className="quote-bg" />
              <div className="quote-in">
                <div className="eyebrow" style={{ color: '#d6e4f7' }}>DAILY QUOTE</div>
                <div className="qt">慢一点也没关系，<br />只要一直在前进。</div>
                <div className="qa">— 致 一直在努力的你</div>
              </div>
            </Card>

            <Card {...cardProps('tools', 'tools-card am')}>
              <div className="hd"><div><div className="eyebrow">TOOLS · 常用工具</div><h3><span className="dot" />快捷启动</h3></div><span className="more">编辑 ›</span></div>
              <div className="tools-grid">
                <Tool ab="VS" name="VS Code" c="var(--bl)" /><Tool ab="T" name="终端" c="var(--gr)" />
                <Tool ab="F" name="Figma" c="var(--pu)" /><Tool ab="DB" name="数据库" c="var(--am)" />
                <Tool ab="SS" name="截图" c="var(--cy)" /><Tool ab="G" name="Git" c="var(--rd)" />
                <Tool ab="N" name="笔记" c="var(--tx2)" /><Tool ab="C" name="计算" c="var(--gr)" />
              </div>
            </Card>

            <Card {...cardProps('sites', 'sites-card')}>
              <div className="hd"><div><div className="eyebrow">BOOKMARKS · 常用网站</div><h3><span className="dot" />一键直达</h3></div><span className="more">管理 ›</span></div>
              <Site ab="G" name="GitHub" sub="代码仓库" cnt="128" c="var(--tx)" />
              <Site ab="J" name="掘金" sub="技术文章" cnt="96" c="var(--am)" />
              <Site ab="S" name="Stack Overflow" sub="问答" cnt="74" c="var(--bl)" />
              <Site ab="N" name="Notion" sub="知识库" cnt="63" c="var(--pu)" />
            </Card>

            <Card {...cardProps('diy', 'diy-card')}>
              <div className="hd"><div><div className="eyebrow">DIY · 自定义卡片</div><h3><span className="dot" />我的桌面组件</h3></div><span className="more" onClick={() => alert('DIY 卡片编辑将在 P4 开放')}>自定义 ›</span></div>
              <div className="diy-grid">
                <div className="note"><div className="nt">✎ 灵感速记</div><div className="nb">把突然冒出来的好点子记在这里</div></div>
                <div className="note"><div className="nt">📌 本周重点</div><div className="nb">1. 工作台 P0 落地<br />2. 需求文档评审</div></div>
                <div className="note note-add" onClick={() => alert('新增卡片将在 P4 开放')}><div className="nt">＋ 添加卡片</div><div className="nb">自定义你的桌面</div></div>
              </div>
            </Card>
          </div>
        </main>
      </div>

      <div className="dock">
        <div className="di" title="打开终端" data-tip="打开终端" onClick={() => dockOpen('terminal')}><svg><use href="#i-term" /></svg></div>
        <div className="di" title="打开代码编辑器 (VS Code)" data-tip="代码编辑器" onClick={() => dockOpen('code')}><svg><use href="#i-code" /></svg></div>
        <div className="di" title="打开文件管理器" data-tip="文件管理器" onClick={() => dockOpen('folder')}><svg><use href="#i-folder" /></svg></div>
        <div className="di" title="专注计时（P1 开放）" data-tip="专注计时" onClick={() => showToast('专注计时将在 P1 开放')}><svg><use href="#i-clock" /></svg></div>
        <div className="dock-sep" />
        <div className="di" title="通知中心（P1 开放）" data-tip="通知中心" onClick={() => showToast('暂无新通知 · 通知中心将在 P1 开放')}><svg><use href="#i-bell" /></svg></div>
        <div className="di" title="设置 · 切换主题色调" data-tip="设置" onClick={() => setThemeOpen((v) => !v)}><svg><use href="#i-set" /></svg></div>
        {typeof window !== 'undefined' && (window as any).nexus?.isElectron && (
          <>
            <div className="dock-sep" />
            <div className="di" title="最小化窗口" data-tip="最小化" onClick={() => (window as any).nexus.minimize()}><svg viewBox="0 0 24 24"><path d="M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg></div>
            <div className="di" title="最大化 / 还原窗口" data-tip="最大化" onClick={() => (window as any).nexus.maximize()}><svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg></div>
            <div className="di di-close" title="关闭窗口" data-tip="关闭" onClick={() => (window as any).nexus.close()}><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg></div>
          </>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}

      {bgEditor && (
        <BgModal
          cardId={bgEditor}
          current={getBg(bgEditor)}
          onSave={(cfg) => { setBg(bgEditor, cfg); setBgEditor(null) }}
          onClear={() => { setBg(bgEditor, null); setBgEditor(null) }}
          onClose={() => setBgEditor(null)}
        />
      )}

      {jiraConfigOpen && (
        <JiraConfigModal
          current={jira.config}
          onTest={jira.test}
          onSave={async (cfg) => {
            await jira.save(cfg)
            setJiraConfigOpen(false)
            showToast('Jira 配置已保存，正在加载数据…')
          }}
          onClear={async () => { await jira.clear(); setJiraConfigOpen(false); showToast('已断开 Jira 连接') }}
          onClose={() => setJiraConfigOpen(false)}
        />
      )}

      {svnConfigOpen && (
        <SvnConfigModal
          current={svn.config}
          empty={svn.EMPTY_CONFIG}
          onTest={svn.test}
          onSave={async (cfg) => {
            await svn.save(cfg)
            setSvnConfigOpen(false)
            showToast('SVN 配置已保存，正在加载提交记录…')
          }}
          onClear={async () => { await svn.clear(); setSvnConfigOpen(false); showToast('已断开 SVN 连接') }}
          onClose={() => setSvnConfigOpen(false)}
        />
      )}
    </>
  )
}

function StatRing({ color, value, label, pct }: { color: string; value: React.ReactNode; label: string; pct: number }) {
  const circumference = 107
  const offset = circumference * (1 - pct / 100)
  return (
    <div className="stat">
      <div className="ring">
        <svg width="42" height="42"><circle className="bg" cx="21" cy="21" r="17" /><circle className="fg" cx="21" cy="21" r="17" stroke={color} strokeDasharray={circumference} strokeDashoffset={offset} /></svg>
        <b>{pct}%</b>
      </div>
      <div><div className="v">{value}</div><div className="l">{label}</div></div>
    </div>
  )
}

function SkillRow({ name, val, pct, grad }: { name: string; val: string; pct: number; grad: string }) {
  return <><div className="row"><span>{name}</span><b>{val}</b></div><div className="track"><i style={{ width: `${pct}%`, background: grad }} /></div></>
}

function AppRow({ ab, name, color, bg, w, pct }: { ab: string; name: string; color: string; bg: string; w: number; pct: string }) {
  return <div className="app"><div className="ai" style={{ background: bg, color }}>{ab}</div><div className="an">{name}</div><div className="meter"><i style={{ width: `${w}%`, background: color }} /></div><span className="pct">{pct}</span></div>
}

function TlItem({ time, name, desc, done }: { time: string; name: string; desc: string; done?: boolean }) {
  return <div className={`tl-item ${done ? 'done' : ''}`}><div className="th"><span className="time">{time}</span><span className="name">{name}</span></div><div className="desc">{desc}</div></div>
}

function GoalRow({ name, pct, w, color }: { name: string; pct: string; w: number; color: string }) {
  return <><div className="row"><span>{name}</span><b>{pct}</b></div><div className="track"><i style={{ width: `${w}%`, background: color }} /></div></>
}

function Tool({ ab, name, c }: { ab: string; name: string; c: string }) {
  return <div className="tool"><div className="ti" style={{ background: 'rgba(53,160,107,.12)', color: c }}>{ab}</div><div className="tn">{name}</div></div>
}

function Site({ ab, name, sub, cnt, c }: { ab: string; name: string; sub: string; cnt: string; c: string }) {
  return <div className="site"><div className="fav" style={{ background: 'rgba(53,160,107,.14)', color: c }}>{ab}</div><div className="sn">{name}<small>{sub}</small></div><span className="cnt">{cnt}</span></div>
}

function BgModal({ cardId, current, onSave, onClear, onClose }: {
  cardId: string
  current?: CardBackground
  onSave: (cfg: CardBackground) => void
  onClear: () => void
  onClose: () => void
}) {
  const base = import.meta.env.BASE_URL
  const presets = [
    { label: '山水横幅', img: `url('${base}assets/hero-landscape.png')`, css: `url('${base}assets/hero-landscape.png')` },
    { label: '湖畔竖图', img: `url('${base}assets/scenery-poster.png')`, css: `url('${base}assets/scenery-poster.png')` },
    { label: '抹茶绿', img: 'linear-gradient(135deg,#a8d8b9,#4f9e74)', css: 'linear-gradient(135deg,#a8d8b9,#4f9e74)' },
    { label: '薄荷绿', img: 'linear-gradient(135deg,#bfe3d2,#6bb99a)', css: 'linear-gradient(135deg,#bfe3d2,#6bb99a)' },
    { label: '暖阳橙', img: 'linear-gradient(135deg,#f7d9a6,#e0964f)', css: 'linear-gradient(135deg,#f7d9a6,#e0964f)' },
    { label: '暮光紫', img: 'linear-gradient(135deg,#c9c4f0,#817bd6)', css: 'linear-gradient(135deg,#c9c4f0,#817bd6)' },
  ]

  const [img, setImg] = useState<string>(current?.img || '')
  const [mask, setMask] = useState<number>(current?.mask ?? 45)
  const [maskType, setMaskType] = useState<'dark' | 'light'>(current?.maskType || 'dark')
  const [url, setUrl] = useState('')

  return (
    <div className="bg-modal open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-box">
        <div className="bg-head">
          <div><div className="bg-title">卡片背景设置</div><div className="bg-sub">当前卡片：{cardId}</div></div>
          <span className="bg-close" onClick={onClose}>✕</span>
        </div>
        <div className="bg-label">预设背景 · 风景 / 渐变</div>
        <div className="bg-presets">
          {presets.map((p) => (
            <div key={p.label} title={p.label}
              className={`bp ${img === p.img ? 'on' : ''}`}
              style={{ background: p.css }}
              onClick={() => setImg(p.img)}
            />
          ))}
        </div>
        <div className="bg-label">自定义图片 · 本地 / 网络</div>
        <div className="bg-row">
          <label className="bg-upload">上传图片<input type="file" accept="image/*" hidden onChange={(e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const r = new FileReader()
            r.onload = () => { setImg(`url("${r.result}")`); setUrl('') }
            r.readAsDataURL(f)
          }} /></label>
          <input type="text" value={url} placeholder="粘贴图片 URL" onChange={(e) => setUrl(e.target.value)} />
          <button onClick={() => { if (url.trim()) { setImg(`url("${url.trim().replace(/"/g, '')}")`) } }}>应用</button>
        </div>
        <div className="bg-label">遮罩与文字</div>
        <div className="bg-ctl"><span>遮罩强度</span><input type="range" min="0" max="85" value={mask} onChange={(e) => setMask(+e.target.value)} /><b>{mask}%</b></div>
        <div className="bg-ctl">
          <span>文字配色</span>
          <div className="bg-switch">
            <span className={maskType === 'dark' ? 'on' : ''} onClick={() => setMaskType('dark')}>深色遮罩 · 白字</span>
            <span className={maskType === 'light' ? 'on' : ''} onClick={() => setMaskType('light')}>浅色遮罩 · 深字</span>
          </div>
        </div>
        <div className="bg-foot">
          <button className="bg-clear" onClick={onClear}>清除背景</button>
          <button className="bg-save" onClick={() => {
            if (!img) { alert('请先选择或上传一张背景图'); return }
            onSave({ img, mask, maskType })
          }}>应用背景</button>
        </div>
      </div>
    </div>
  )
}
