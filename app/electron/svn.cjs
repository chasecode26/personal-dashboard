const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')
const { app } = require('electron')

// SVN 配置存到用户数据目录，凭证不进项目代码
function configPath() {
  return path.join(app.getPath('userData'), 'svn-config.json')
}

function normalizeUrl(raw) {
  let s = String(raw || '').trim().replace(/\/+$/, '')
  if (s && !/^https?:\/\//i.test(s)) s = 'http://' + s // 本地部署默认 http
  return s
}

function deriveName(url) {
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean)
    return decodeURIComponent(seg[seg.length - 1] || '仓库')
  } catch {
    return '仓库'
  }
}

function loadConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath(), 'utf8'))
    const repos = Array.isArray(cfg.repos)
      ? cfg.repos.map((r) => ({
          name: String((r && r.name) || '').trim() || deriveName(r && r.url),
          url: normalizeUrl(r && r.url),
        })).filter((r) => r.url)
      : []
    return {
      repos,
      username: cfg.username || '',
      password: cfg.password || '',
      ignoreCert: cfg.ignoreCert === true,
      limit: Math.min(Math.max(Number(cfg.limit) || 20, 1), 100),
      authorFilter: String(cfg.authorFilter || '').trim(),
    }
  } catch {
    return null
  }
}

function saveConfig(cfg) {
  const clean = {
    repos: Array.isArray(cfg.repos)
      ? cfg.repos.map((r) => ({ name: String((r && r.name) || '').trim(), url: normalizeUrl(r && r.url) })).filter((r) => r.url)
      : [],
    username: cfg.username || '',
    password: cfg.password || '',
    ignoreCert: cfg.ignoreCert === true,
    limit: Math.min(Math.max(Number(cfg.limit) || 20, 1), 100),
    authorFilter: String(cfg.authorFilter || '').trim(),
  }
  fs.mkdirSync(path.dirname(configPath()), { recursive: true })
  fs.writeFileSync(configPath(), JSON.stringify(clean, null, 2), { encoding: 'utf8', mode: 0o600 })
  return clean
}

function clearConfig() {
  try { fs.unlinkSync(configPath()) } catch {}
}

// 原生 HTTP(S) 请求：支持 http 内网地址、自签名证书忽略、Basic 认证、重定向跟随
function rawRequest(cfg, fullUrl, options, redirects) {
  options = options || {}
  redirects = redirects || 0
  return new Promise((resolve) => {
    let u
    try { u = new URL(fullUrl) } catch (e) {
      resolve({ ok: false, status: 0, error: '地址格式无效：' + e.message }); return
    }
    const isHttps = u.protocol === 'https:'
    const mod = isHttps ? https : http
    const headers = {
      'User-Agent': 'NEXUS-Dashboard/0.1',
      'Accept-Encoding': 'identity',
      ...(options.headers || {}),
    }
    if (cfg.username) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${cfg.username}:${cfg.password || ''}`, 'utf8').toString('base64')
    }
    const req = mod.request({
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: (u.pathname || '/') + u.search,
      method: options.method || 'GET',
      headers,
      rejectUnauthorized: isHttps ? !cfg.ignoreCert : true,
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
        res.resume()
        let next = res.headers.location
        if (!/^https?:\/\//.test(next)) next = u.protocol + '//' + u.host + (next.startsWith('/') ? '' : '/') + next
        resolve(rawRequest(cfg, next, options, redirects + 1))
        return
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, text })
      })
    })
    req.setTimeout(15000, () => req.destroy(new Error('请求超时（15 秒）')))
    req.on('error', (e) => resolve({ ok: false, status: 0, error: String(e && e.message || e) }))
    if (options.body) req.write(options.body)
    req.end()
  })
}

// svn log 的底层 DAV REPORT 请求体
function logReportXml(limit) {
  return '<?xml version="1.0" encoding="utf-8"?>' +
    '<log-report xmlns="svn:">' +
    '<start-revision>HEAD</start-revision>' +
    '<end-revision>0</end-revision>' +
    '<limit>' + limit + '</limit>' +
    '<discover-changed-paths/>' +
    '<strict-node-history/>' +
    '<include-merged-revisions/>' +
    '</log-report>'
}

function xmlDecode(s) {
  return String(s == null ? '' : s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function pick(block, tag) {
  const m = block.match(new RegExp('<(?:svn:)?' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:svn:)?' + tag + '>'))
  return m ? xmlDecode(m[1]).trim() : ''
}

// 解析 REPORT 响应 XML 为提交记录数组（正则解析，避免引入额外 XML 依赖）
function parseLogReport(xml) {
  const items = xml.match(/<(?:svn:)?log-item(?:\s[^>]*)?>[\s\S]*?<\/(?:svn:)?log-item>/g) || []
  return items.map((item) => {
    const pm = item.match(/<(?:svn:)?(?:changed-paths|paths)(?:\s[^>]*)?>([\s\S]*?)<\/(?:svn:)?(?:changed-paths|paths)>/)
    const pathsBlock = pm ? pm[1] : ''
    const paths = []
    const re = /<(?:svn:)?path\s+action="([^"]+)"\s*>([\s\S]*?)<\/(?:svn:)?path>/g
    let mm
    while ((mm = re.exec(pathsBlock)) !== null) {
      paths.push({ action: mm[1], path: xmlDecode(mm[2]).trim() })
    }
    const rawDate = pick(item, 'date')
    const date = rawDate ? rawDate.replace(/(\.\d{3})\d+(Z|[+-]\d{2}:?\d{2})$/, '$1$2') : ''
    return {
      revision: Number(pick(item, 'revision')) || 0,
      author: pick(item, 'author'),
      date,
      message: pick(item, 'msg'),
      paths,
    }
  })
}

function requestLog(cfg, repo, limit) {
  const url = repo.url.replace(/\/+$/, '') + '/'
  return rawRequest(cfg, url, {
    method: 'REPORT',
    body: logReportXml(limit),
    headers: { 'Content-Type': 'text/xml' },
  })
}

function errMessage(cfg, r) {
  if (r.status === 401 || r.status === 403) return '认证失败：账号或密码错误（部分服务需开启 Basic 认证）'
  if (r.status === 404) return '仓库路径不存在（HTTP 404）：检查地址是否包含正确仓库名，如 http://host/svn/项目名'
  if (r.status === 405 || r.status === 501) return '服务不支持 REPORT 请求：确认这是 SVN 的 http(s) 仓库地址，svn:// 协议暂不支持'
  if (r.status === 0) return `无法连接：${r.error || '网络不通、地址错误或证书问题（可尝试勾选忽略证书）'}`
  return `请求失败（HTTP ${r.status}）`
}

async function testConnection(cfg) {
  if (!cfg.repos.length) return { ok: false, msg: '请至少填写一个仓库地址' }
  if (!cfg.username) return { ok: false, msg: '请填写 SVN 用户名' }
  const repo = cfg.repos[0]
  const r = await requestLog(cfg, repo, 1)
  if (!r.ok) return { ok: false, msg: errMessage(cfg, r) }
  const commits = parseLogReport(r.text)
  const latest = commits[0]
  return {
    ok: true,
    msg: `连接成功：${repo.name}${latest ? ' · 最新 r' + latest.revision : ' · 暂无提交记录'}`,
  }
}

async function fetchLogs(cfg) {
  const groups = await Promise.all(cfg.repos.map(async (repo) => {
    try {
      const r = await requestLog(cfg, repo, cfg.limit)
      if (!r.ok) return { name: repo.name, url: repo.url, commits: [], error: errMessage(cfg, r) }
      let commits = parseLogReport(r.text)
      if (cfg.authorFilter) commits = commits.filter((c) => c.author.indexOf(cfg.authorFilter) >= 0)
      return { name: repo.name, url: repo.url, commits, error: '' }
    } catch (e) {
      return { name: repo.name, url: repo.url, commits: [], error: String(e && e.message || e) }
    }
  }))
  const total = groups.reduce((n, g) => n + g.commits.length, 0)
  return { groups, counts: { repos: groups.length, commits: total }, syncedAt: new Date().toISOString() }
}

module.exports = {
  loadConfig,
  saveConfig,
  clearConfig,
  testConnection,
  fetchLogs,
}
