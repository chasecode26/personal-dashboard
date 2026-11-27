const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')
const { app } = require('electron')
const { userDataDir } = require('./userData.cjs')

// Jira 配置存到用户数据目录，不进项目代码，避免 token 泄露
function configPath() {
  return path.join(userDataDir(app), 'jira-config.json')
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8')
    const cfg = JSON.parse(raw)
    return {
      baseUrl: (cfg.baseUrl || '').replace(/\/+$/, ''),
      email: cfg.email || '',            // Cloud=邮箱, Server=用户名
      token: cfg.token || '',            // Cloud=API Token, Server=密码或 PAT
      projectKey: (cfg.projectKey || '').trim().toUpperCase(),
      mode: cfg.mode === 'server' ? 'server' : 'cloud',
      authType: cfg.authType === 'pat' ? 'pat' : 'basic', // server: basic(账号密码) | pat
      ignoreCert: cfg.ignoreCert === true,                 // 本地自签名证书
    }
  } catch {
    return null
  }
}

function saveConfig(cfg) {
  const clean = {
    baseUrl: (cfg.baseUrl || '').replace(/\/+$/, ''),
    email: cfg.email || '',
    token: cfg.token || '',
    projectKey: (cfg.projectKey || '').trim().toUpperCase(),
    mode: cfg.mode === 'server' ? 'server' : 'cloud',
    authType: cfg.authType === 'pat' ? 'pat' : 'basic',
    ignoreCert: cfg.ignoreCert === true,
  }
  fs.mkdirSync(path.dirname(configPath()), { recursive: true })
  fs.writeFileSync(configPath(), JSON.stringify(clean, null, 2), { encoding: 'utf8', mode: 0o600 })
  return clean
}

function clearConfig() {
  try { fs.unlinkSync(configPath()) } catch {}
}

function authHeader(cfg) {
  // 本地 Server + PAT：Bearer Token
  if (cfg.mode === 'server' && cfg.authType === 'pat') {
    return 'Bearer ' + cfg.token
  }
  // 其余（Cloud API Token / Server 账号密码）：Basic base64(user:pass)
  return 'Basic ' + Buffer.from(`${cfg.email}:${cfg.token}`, 'utf8').toString('base64')
}

// 原生 http/https 请求：支持 http 内网地址、自签名证书忽略、重定向跟随
function doRequest(cfg, fullUrl, options, redirects) {
  return new Promise((resolve) => {
    let u
    try { u = new URL(fullUrl) } catch (e) {
      resolve({ ok: false, status: 0, error: '地址格式无效：' + e.message }); return
    }
    const isHttps = u.protocol === 'https:'
    const mod = isHttps ? https : http
    const bodyStr = options.body ? JSON.stringify(options.body) : null
    const headers = {
      Authorization: authHeader(cfg),
      Accept: 'application/json',
      'User-Agent': 'NEXUS-Dashboard/0.1',
      ...(options.headers || {}),
    }
    if (bodyStr) {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = Buffer.byteLength(bodyStr)
    }
    const req = mod.request({
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers,
      rejectUnauthorized: isHttps ? !cfg.ignoreCert : true,
    }, (res) => {
      // 跟随重定向（本地 Jira 常见 http -> https 或加斜杠）
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
        res.resume()
        let next = res.headers.location
        if (!/^https?:\/\//.test(next)) next = u.protocol + '//' + u.host + (next.startsWith('/') ? '' : '/') + next
        resolve(doRequest(cfg, next, options, redirects + 1))
        return
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let data = null
        try { data = text ? JSON.parse(text) : null } catch { data = null }
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data, text })
      })
    })
    req.setTimeout(15000, () => req.destroy(new Error('请求超时（15 秒）')))
    req.on('error', (e) => resolve({ ok: false, status: 0, error: String(e && e.message || e) }))
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

function request(cfg, urlPath, options = {}) {
  return doRequest(cfg, cfg.baseUrl + urlPath, options, 0)
}

function credentialsOK(cfg) {
  if (!cfg.baseUrl || !cfg.token) return false
  // PAT 只需 token；basic/cloud 还需账号
  if (cfg.mode === 'server' && cfg.authType === 'pat') return true
  return Boolean(cfg.email)
}

// 校验配置：调用 myself 接口确认能否鉴权
async function testConnection(cfg) {
  if (!credentialsOK(cfg)) {
    return { ok: false, msg: cfg.mode === 'server' && cfg.authType === 'pat'
      ? '请填写地址和 PAT Token'
      : '请填写地址、账号和凭证' }
  }
  // Server 直接走 v2；Cloud 先 v3 再退 v2
  let r
  if (cfg.mode === 'server') {
    r = await request(cfg, '/rest/api/2/myself')
  } else {
    r = await request(cfg, '/rest/api/3/myself')
    if (!r.ok && (r.status === 404 || r.status === 0)) r = await request(cfg, '/rest/api/2/myself')
  }
  if (r.ok && r.data) {
    return { ok: true, msg: `连接成功：${r.data.displayName || r.data.name || '已认证'}`, user: r.data }
  }
  let msg
  if (r.status === 401 || r.status === 403) {
    msg = cfg.mode === 'server' && cfg.authType === 'basic'
      ? '认证失败：账号或密码错误；若你的 Jira 禁用了账号密码 Basic 认证，请切换为 PAT 方式'
      : '认证失败：请检查账号与凭证是否正确'
  } else if (r.status === 0) {
    msg = `无法连接：${r.error || '网络不通、地址错误，或证书问题（可尝试勾选忽略证书）'}`
  } else if (r.status === 404) {
    msg = `接口不存在（HTTP 404）：请确认地址是否带正确的上下文路径，例如 http://host:8080/jira`
  } else {
    msg = `连接失败（HTTP ${r.status}）${r.text ? '：' + r.text.slice(0, 120) : ''}`
  }
  return { ok: false, msg }
}

// 统一搜索：Server 直接 v2；Cloud 新端点 POST /search/jql 优先，失败回退旧 GET /search
async function search(cfg, jql, fields) {
  let r
  if (cfg.mode === 'server') {
    const qs = new URLSearchParams({ jql, fields: fields.join(','), maxResults: '50' })
    r = await request(cfg, '/rest/api/2/search?' + qs.toString())
  } else {
    const payload = { jql, fields, maxResults: 50 }
    r = await request(cfg, '/rest/api/3/search/jql', { method: 'POST', body: payload })
    if (!r.ok && (r.status === 404 || r.status === 405 || r.status === 410 || r.status === 400)) {
      const qs = new URLSearchParams({ jql, fields: fields.join(','), maxResults: '50' })
      r = await request(cfg, '/rest/api/2/search?' + qs.toString())
    }
  }
  if (!r.ok) {
    throw new Error(r.status ? `HTTP ${r.status} ${(r.text || '').slice(0, 100)}` : (r.error || '网络错误'))
  }
  return (r.data && r.data.issues) || []
}

function projClause(cfg) {
  return cfg.projectKey ? `project = ${cfg.projectKey} AND ` : ''
}

// 看板/周报的类型口径：缺陷单独进 BUG 列；待办与完成只认这三类，史诗等不显示。
// JQL 用的是服务端实际配置的中文字面量（本机验证 issuetype = 缺陷 / in (任务, 故事, 发布记录) 可用）。
const WORK_ITEM_TYPES = '任务, 故事, 发布记录'
const BUG_TYPE = '缺陷'

// 把 Jira issue 映射成渲染层需要的精简结构（字段做兼容，避免不同版本字段缺失报错）
function mapIssue(it, baseUrl) {
  const f = it.fields || {}
  return {
    key: it.key || '',
    summary: f.summary || '（无标题）',
    type: (f.issuetype && f.issuetype.name) || '任务',
    typeIcon: (f.issuetype && f.issuetype.iconUrl) || '',
    status: (f.status && f.status.name) || '',
    statusCategory: (f.status && f.status.statusCategory && f.status.statusCategory.key) || 'undefined',
    priority: (f.priority && f.priority.name) || '',
    priorityIcon: (f.priority && f.priority.iconUrl) || '',
    assignee: (f.assignee && f.assignee.displayName) || '未分配',
    updated: f.updated || '',
    resolved: f.resolutiondate || '',
    project: (f.project && f.project.key) || (it.key || '').split('-')[0] || 'OTHER',
    projectName: (f.project && f.project.name) || '',
    url: baseUrl + '/browse/' + (it.key || ''),
  }
}

// 拉取三类数据：待办任务、待修 BUG、今日完成
async function fetchBoard(cfg) {
  const proj = projClause(cfg)
  const fields = ['summary', 'issuetype', 'status', 'priority', 'assignee', 'updated', 'resolutiondate', 'project']
  const jqls = {
    todo: `${proj}assignee = currentUser() AND statusCategory != Done AND issuetype in (${WORK_ITEM_TYPES}) ORDER BY updated DESC`,
    bugs: `${proj}assignee = currentUser() AND statusCategory != Done AND issuetype = ${BUG_TYPE} ORDER BY priority DESC, updated DESC`,
    done: `${proj}assignee = currentUser() AND statusCategory = Done AND resolutiondate >= startOfDay() AND issuetype in (${WORK_ITEM_TYPES}) ORDER BY resolutiondate DESC`,
  }
  const [todo, bugs, done] = await Promise.all([
    search(cfg, jqls.todo, fields).catch(() => []),
    search(cfg, jqls.bugs, fields).catch(() => []),
    search(cfg, jqls.done, fields).catch(() => []),
  ])
  return {
    todo: todo.slice(0, 30).map((it) => mapIssue(it, cfg.baseUrl)),
    bugs: bugs.slice(0, 30).map((it) => mapIssue(it, cfg.baseUrl)),
    done: done.slice(0, 30).map((it) => mapIssue(it, cfg.baseUrl)),
    counts: { todo: todo.length, bugs: bugs.length, done: done.length },
    syncedAt: new Date().toISOString(),
  }
}

// 周报数据：本周已完成（含详细的解决时间）+ 当前未完成（用于下周计划）
// 与 fetchBoard 分开查询，避免"今日完成"口径不够用，也避免面板依赖看板是否已加载
async function fetchWeekly(cfg) {
  const proj = projClause(cfg)
  const fields = ['summary', 'issuetype', 'status', 'priority', 'assignee', 'updated', 'resolutiondate', 'project']
  const jqls = {
    completed: `${proj}assignee = currentUser() AND statusCategory = Done AND resolutiondate >= startOfWeek() AND issuetype in (${WORK_ITEM_TYPES}) ORDER BY resolutiondate DESC`,
    planned: `${proj}assignee = currentUser() AND statusCategory != Done AND issuetype in (${WORK_ITEM_TYPES}) ORDER BY updated DESC`,
  }
  const [completed, planned] = await Promise.all([
    search(cfg, jqls.completed, fields).catch(() => []),
    search(cfg, jqls.planned, fields).catch(() => []),
  ])
  return {
    completed: completed.slice(0, 100).map((it) => mapIssue(it, cfg.baseUrl)),
    planned: planned.slice(0, 100).map((it) => mapIssue(it, cfg.baseUrl)),
    syncedAt: new Date().toISOString(),
  }
}

module.exports = {
  loadConfig,
  saveConfig,
  clearConfig,
  testConnection,
  fetchBoard,
  fetchWeekly,
}
