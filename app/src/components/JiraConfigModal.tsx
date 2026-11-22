import { useState } from 'react'
import type { JiraConfig } from '../hooks/useJira'

interface Props {
  current: JiraConfig | null
  onSave: (cfg: JiraConfig) => void
  onClear: () => void
  onTest: (cfg: JiraConfig) => Promise<{ ok: boolean; msg: string }>
  onClose: () => void
}

const PRESETS = [
  { label: '本地部署 / Server', value: 'server', hint: 'http://192.168.1.10:8080 或 http://host/jira' },
  { label: 'Jira Cloud', value: 'cloud', hint: 'your-company.atlassian.net' },
]

function normalizeUrl(raw: string, mode: 'cloud' | 'server') {
  let s = raw.trim()
  if (/^https?:\/\//i.test(s)) return s.replace(/\/+$/, '')
  // 本地部署或明确是 IP / localhost：默认 http；域名形式默认 https（Cloud）
  if (mode === 'server' || /^(localhost|127\.|\d+\.\d+\.\d+\.\d+)/i.test(s)) s = 'http://' + s
  else s = 'https://' + s
  return s.replace(/\/+$/, '')
}

export default function JiraConfigModal({ current, onSave, onClear, onTest, onClose }: Props) {
  const [mode, setMode] = useState<'cloud' | 'server'>(current?.mode || 'server')
  const [baseUrl, setBaseUrl] = useState(current?.baseUrl || '')
  const [email, setEmail] = useState(current?.email || '')
  const [token, setToken] = useState(current?.token || '')
  const [projectKey, setProjectKey] = useState(current?.projectKey || '')
  const [authType, setAuthType] = useState<'basic' | 'pat'>(current?.authType || 'basic')
  const [ignoreCert, setIgnoreCert] = useState<boolean>(current?.ignoreCert || false)
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const [err, setErr] = useState('')

  const cfg: JiraConfig = { mode, baseUrl, email, token, projectKey, authType, ignoreCert }
  const isServer = mode === 'server'

  const doTest = async () => {
    setTesting(true); setTestMsg(''); setErr('')
    try {
      const normalized = normalizeUrl(baseUrl, mode)
      const r = await onTest({ ...cfg, baseUrl: normalized })
      setTestMsg(r.msg)
      if (!r.ok) setErr(r.msg)
    } catch (e: any) {
      setErr(String(e?.message || e))
    } finally {
      setTesting(false)
    }
  }

  const doSave = () => {
    if (!baseUrl.trim() || !token.trim() || (!isServer && !email.trim()) || (isServer && authType === 'basic' && !email.trim())) {
      setErr('地址、账号、凭证为必填项'); return
    }
    onSave({ ...cfg, baseUrl: normalizeUrl(baseUrl, mode) })
  }

  return (
    <div className="modal-mask" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal jira-modal">
        <div className="modal-hd">
          <div>
            <div className="modal-eyebrow">INTEGRATION · 集成配置</div>
            <div className="modal-title">连接 Jira</div>
          </div>
          <span className="modal-x" onClick={onClose}>×</span>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>部署类型</label>
            <div className="seg">
              {PRESETS.map((p) => (
                <span key={p.value} className={`seg-item ${mode === p.value ? 'on' : ''}`} onClick={() => setMode(p.value as any)}>{p.label}</span>
              ))}
            </div>
            <div className="field-hint">示例：{PRESETS.find((p) => p.value === mode)?.hint}</div>
          </div>

          <div className="field">
            <label>Jira 访问地址</label>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={isServer ? 'http://192.168.1.10:8080' : 'your-company.atlassian.net'} />
            <div className="field-hint">本地部署填完整内网地址；如果 Jira 装在子路径，要带上，例如 http://host:8080/jira</div>
          </div>

          {isServer && (
            <div className="field">
              <label>认证方式</label>
              <div className="seg">
                <span className={`seg-item ${authType === 'basic' ? 'on' : ''}`} onClick={() => setAuthType('basic')}>账号密码</span>
                <span className={`seg-item ${authType === 'pat' ? 'on' : ''}`} onClick={() => setAuthType('pat')}>Personal Access Token</span>
              </div>
            </div>
          )}

          <div className="field-row">
            {(authType === 'basic' || !isServer) && (
              <div className="field">
                <label>{isServer ? '用户名' : 'Atlassian 邮箱'}</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={isServer ? '你的 Jira 用户名' : 'you@company.com'} />
              </div>
            )}
            <div className="field">
              <label>{isServer ? (authType === 'pat' ? 'PAT Token' : '密码') : 'API Token'}</label>
              <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="••••••••••••" />
            </div>
          </div>

          {isServer && authType === 'basic' && (
            <div className="token-help">
              部分新版本 Jira 默认禁用了「账号密码」的 Basic 认证。如果测试连接提示认证失败，请改用 Personal Access Token：在 Jira → 头像 → 个人访问令牌 中生成。
            </div>
          )}

          <div className="field">
            <label>项目 Key <span className="opt">选填</span></label>
            <input value={projectKey} onChange={(e) => setProjectKey(e.target.value)} placeholder="例如 DEV，留空则查询所有项目" />
            <div className="field-hint">只显示某个项目时填写，如 DEV、PROJ</div>
          </div>

          {isServer && (
            <label className="check-row">
              <input type="checkbox" checked={ignoreCert} onChange={(e) => setIgnoreCert(e.target.checked)} />
              <span>忽略 SSL 证书错误（内网使用自签名证书时勾选）</span>
            </label>
          )}

          {!isServer && (
            <div className="token-help">
              在 Atlassian 账户设置 → Security → API tokens 生成令牌，粘贴到这里。凭证仅保存在本机，不会上传。
            </div>
          )}

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
