import { useState } from 'react'
import type { SvnConfig, SvnRepo } from '../hooks/useSvn'

interface Props {
  current: SvnConfig | null
  empty: SvnConfig
  onSave: (cfg: SvnConfig) => void
  onClear: () => void
  onTest: (cfg: SvnConfig) => Promise<{ ok: boolean; msg: string }>
  onClose: () => void
}

function normalizeUrl(raw: string) {
  let s = String(raw || '').trim().replace(/\/+$/, '')
  if (s && !/^https?:\/\//i.test(s)) s = 'http://' + s
  return s
}

function deriveName(url: string) {
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean)
    return decodeURIComponent(seg[seg.length - 1] || '仓库')
  } catch { return '仓库' }
}

export default function SvnConfigModal({ current, empty, onSave, onClear, onTest, onClose }: Props) {
  const init: SvnConfig = current || { ...empty, repos: [{ name: '', url: '' }] }
  const [repos, setRepos] = useState<SvnRepo[]>(init.repos.length ? init.repos.map((r) => ({ ...r })) : [{ name: '', url: '' }])
  const [username, setUsername] = useState(init.username)
  const [password, setPassword] = useState(init.password)
  const [ignoreCert, setIgnoreCert] = useState(init.ignoreCert)
  const [limit, setLimit] = useState(init.limit || 20)
  const [authorFilter, setAuthorFilter] = useState(init.authorFilter || '')
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const [err, setErr] = useState('')

  const cleanRepos = (): SvnRepo[] => repos
    .map((r) => ({ name: (r.name || '').trim() || deriveName(normalizeUrl(r.url)), url: normalizeUrl(r.url) }))
    .filter((r) => r.url)

  const buildCfg = (): SvnConfig => ({
    repos: cleanRepos(), username: username.trim(), password,
    ignoreCert, limit: Math.min(Math.max(Number(limit) || 20, 1), 100), authorFilter: authorFilter.trim(),
  })

  const setRepo = (i: number, key: keyof SvnRepo, val: string) => {
    setRepos((prev) => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r))
  }

  const doTest = async () => {
    setTesting(true); setTestMsg(''); setErr('')
    try {
      const cfg = buildCfg()
      if (!cfg.repos.length) { setErr('请至少填写一个仓库地址'); return }
      if (!cfg.username) { setErr('请填写 SVN 用户名'); return }
      const r = await onTest(cfg)
      setTestMsg(r.msg)
      if (!r.ok) setErr(r.msg)
    } catch (e: any) {
      setErr(String(e?.message || e))
    } finally {
      setTesting(false)
    }
  }

  const doSave = () => {
    const cfg = buildCfg()
    if (!cfg.repos.length) { setErr('请至少填写一个仓库地址'); return }
    if (!cfg.username) { setErr('请填写 SVN 用户名'); return }
    onSave(cfg)
  }

  return (
    <div className="modal-mask" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal svn-modal">
        <div className="modal-hd">
          <div>
            <div className="modal-eyebrow">INTEGRATION · 集成配置</div>
            <div className="modal-title">连接 SVN</div>
          </div>
          <span className="modal-x" onClick={onClose}>×</span>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>仓库地址 <span className="opt">每个仓库即一个项目分组</span></label>
            {repos.map((r, i) => (
              <div className="svn-repo-row" key={i}>
                <input className="svn-repo-name" value={r.name} onChange={(e) => setRepo(i, 'name', e.target.value)} placeholder="项目名（选填）" />
                <input className="svn-repo-url" value={r.url} onChange={(e) => setRepo(i, 'url', e.target.value)} placeholder="http://192.168.1.10/svn/项目名" />
                <span className="svn-repo-del" title="移除仓库" onClick={() => setRepos((p) => p.filter((_, idx) => idx !== i))}>×</span>
              </div>
            ))}
            <span className="svn-add" onClick={() => setRepos((p) => [...p, { name: '', url: '' }])}>+ 添加仓库</span>
            <div className="field-hint">本地部署填完整内网地址，如 http://192.168.1.10:8080/svn/项目名。项目名留空则自动取地址末段。svn:// 协议暂不支持。</div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>用户名</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="你的 SVN 账号" />
            </div>
            <div className="field">
              <label>密码</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>每个项目显示条数</label>
              <input type="number" min={1} max={100} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
            </div>
            <div className="field">
              <label>只看作者 <span className="opt">选填</span></label>
              <input value={authorFilter} onChange={(e) => setAuthorFilter(e.target.value)} placeholder="如你的账号，过滤出自己的提交" />
            </div>
          </div>

          <label className="check-row">
            <input type="checkbox" checked={ignoreCert} onChange={(e) => setIgnoreCert(e.target.checked)} />
            <span>忽略 SSL 证书错误（内网使用自签名证书时勾选）</span>
          </label>

          <div className="token-help">
            采用 SVN 的 HTTP(S) 协议读取提交记录（即 svn log 的底层协议），无需本机安装 SVN 客户端。凭证仅保存在本机，不会上传。
          </div>

          {testMsg && <div className={`test-msg ${err ? 'bad' : 'good'}`}>{testMsg}</div>}
          {err && !testMsg && <div className="test-msg bad">{err}</div>}
        </div>

        <div className="modal-ft">
          {current && <button className="btn-ghost danger" onClick={onClear}>断开连接</button>}
          <button className="btn-ghost" onClick={doTest} disabled={testing}>{testing ? '测试中…' : '测试连接'}</button>
          <button className="btn-primary" onClick={doSave}>保存并加载</button>
        </div>
      </div>
    </div>
  )
}
