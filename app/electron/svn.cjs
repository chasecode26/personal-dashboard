const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')
const { app } = require('electron')
const { execFile } = require('child_process')
const { userDataDir } = require('./userData.cjs')

// SVN 配置存到用户数据目录，凭证不进项目代码
function configPath() {
  return path.join(userDataDir(app), 'svn-config.json')
}

function normalizeUrl(raw) {
  let s = String(raw || '').trim().replace(/\/+$/, '')
  if (s && !/^(?:https?|svn):\/\//i.test(s)) s = 'http://' + s // 本地部署默认 http；svn:// 原样保留
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
  if (/^svn:\/\//i.test(repo.url)) return requestSvnCliLog(cfg, repo, limit)
  const url = repo.url.replace(/\/+$/, '') + '/'
  return rawRequest(cfg, url, {
    method: 'REPORT',
    body: logReportXml(limit),
    headers: { 'Content-Type': 'text/xml' },
  })
}

function errMessage(cfg, r) {
  if (r.cli) return r.error
  if (r.status === 401 || r.status === 403) return '认证失败：账号或密码错误（部分服务需开启 Basic 认证）'
  if (r.status === 404) return '仓库路径不存在（HTTP 404）：检查地址是否包含正确仓库名，如 http://host/svn/项目名'
  if (r.status === 405 || r.status === 501) return '服务不支持 REPORT 请求：确认这是 SVN 的 http(s) 仓库地址（svn:// 请用本机 svn 命令行）'
  if (r.status === 0) return `无法连接：${r.error || '网络不通、地址错误或证书问题（可尝试勾选忽略证书）'}`
  return `请求失败（HTTP ${r.status}）`
}

// svn log --xml 的解析：结构与 DAV REPORT 不同（logentry、revision 是属性、path 带多属性），
// 单独解析成与 parseLogReport 一致的提交记录结构，供上层统一消费。
function parseSvnCliLog(xml) {
  const items = xml.match(/<logentry[\s\S]*?<\/logentry>/g) || []
  return items.map((item) => {
    const rev = item.match(/\brevision="(\d+)"/)
    const pm = item.match(/<paths>([\s\S]*?)<\/paths>/)
    const pathsBlock = pm ? pm[1] : ''
    const paths = []
    const re = /<path\s+([^>]+)>([\s\S]*?)<\/path>/g
    let mm
    while ((mm = re.exec(pathsBlock)) !== null) {
      const action = (mm[1].match(/\baction="([^"]+)"/) || [])[1] || ''
      paths.push({ action, path: xmlDecode(mm[2]).trim() })
    }
    const rawDate = pick(item, 'date')
    const date = rawDate ? rawDate.replace(/(\.\d{3})\d+(Z|[+-]\d{2}:?\d{2})$/, '$1$2') : ''
    return {
      revision: Number(rev && rev[1]) || 0,
      author: pick(item, 'author'),
      date,
      message: pick(item, 'msg'),
      paths,
    }
  })
}

// svn 可执行文件：优先环境变量 SVN_BIN，其次 PATH 里的 svn，再按常见安装位置兜底。
// 不硬编码本机路径到业务代码，换机可通过 SVN_BIN 指向自定义位置。
function svnBinary() {
  const fromEnv = process.env.SVN_BIN
  const candidates = [
    fromEnv,
    'svn',
    path.join(process.env.ProgramFiles || '', 'TortoiseSVN\\bin\\svn.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'TortoiseSVN\\bin\\svn.exe'),
  ]
  for (const bin of candidates) {
    if (!bin) continue
    if (bin === 'svn' || fs.existsSync(bin)) return bin
  }
  return 'svn'
}

// svn:// 协议：复用本机 svn 命令行（--non-interactive --no-auth-cache，密码不落缓存）。
// 命令行未安装时给出明确指引，不猜测原因。
function runSvn(cfg, args) {
  return new Promise((resolve) => {
    let child
    try {
      child = execFile(svnBinary(), args.concat([
        '--non-interactive', '--no-auth-cache',
        '--username', cfg.username, '--password', cfg.password || '',
      ]), { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
        // svn 认证失败时 exit=1 但 stdout 仍有 XML 头，必须按 stderr 判断，
        // 否则会把认证失败当成连接成功返回。
        if (err) {
          const msg = String(stderr || err.message || err).trim()
          resolve({ ok: false, cli: true, error: /authentication error|password incorrect|username not found|E170001/i.test(msg)
            ? '认证失败：SVN 账号或密码错误'
            : /not found|ENOENT|not recognized|spawn EPERM/i.test(msg)
              ? '无法启动 svn 命令行：' + msg
              : msg })
          return
        }
        resolve({ ok: true, cli: true, text: stdout })
      })
    } catch (e) {
      resolve({ ok: false, cli: true, error: '无法启动 svn 命令行：' + String(e && e.message || e) })
      return
    }
    // execFile 回调已处理 spawn 失败；此处空 handler 仅兜住 error 事件，避免未捕获异常。
    child.on('error', () => {})
  })
}

// svn log --xml -v：用专门的 CLI 解析器处理，结构与 HTTP DAV REPORT 不同
async function requestSvnCliLog(cfg, repo, limit) {
  return runSvn(cfg, ['log', '--xml', '-v', '-l', String(limit), repo.url])
}

// 一次提交可能涉及多个项目（二级目录）。按路径归属拆成多条，并保留完整 paths 供 tooltip 查看。
// 第二级目录取名（如 2.软件研发/14.贵货武装押运平台）才是项目名；一级是分类，不分。
function splitByProject(commits) {
  const groups = new Map()
  for (const c of commits) {
    const projects = new Set()
    for (const p of c.paths) {
      const seg = String(p.path || '').split('/').filter(Boolean)
      if (seg.length >= 2) projects.add(seg.slice(0, 2).join('/'))
    }
    if (!projects.size) projects.add('未分组')
    for (const project of projects) {
      if (!groups.has(project)) groups.set(project, [])
      groups.get(project).push({ ...c })
    }
  }
  return Array.from(groups.entries()).map(([project, commits]) => ({
    name: project,
    commits,
  }))
}

async function testConnection(cfg) {
  if (!cfg.repos.length) return { ok: false, msg: '请至少填写一个仓库地址' }
  if (!cfg.username) return { ok: false, msg: '请填写 SVN 用户名' }
  const repo = cfg.repos[0]
  const r = await requestLog(cfg, repo, 1)
  if (!r.ok) return { ok: false, msg: errMessage(cfg, r) }
  const commits = r.cli ? parseSvnCliLog(r.text) : parseLogReport(r.text)
  const latest = commits[0]
  return {
    ok: true,
    msg: `连接成功：${repo.name}${latest ? ' · 最新 r' + latest.revision : ' · 暂无提交记录'}`,
  }
}

// 拉取提交记录。默认只看当前账号自己的提交（options.all=false）；卡片切到「看全部」时传 all=true。
// 按提交路径的二级目录（项目）分组，便于在卡片上周报里区分不同项目。
async function fetchLogs(cfg, options) {
  const showAll = Boolean(options && options.all)
  const myName = String(cfg.username || '').trim().toLowerCase()
  const byRepo = await Promise.all(cfg.repos.map(async (repo) => {
    try {
      const r = await requestLog(cfg, repo, cfg.limit)
      if (!r.ok) return { repo, commits: [], error: errMessage(cfg, r) }
      let commits = r.cli ? parseSvnCliLog(r.text) : parseLogReport(r.text)
      if (!showAll && myName) commits = commits.filter((c) => String(c.author || '').toLowerCase() === myName)
      if (cfg.authorFilter) commits = commits.filter((c) => c.author.indexOf(cfg.authorFilter) >= 0)
      return { repo, commits, error: '' }
    } catch (e) {
      return { repo, commits: [], error: String(e && e.message || e) }
    }
  }))
  const groups = []
  for (const { repo, commits, error } of byRepo) {
    if (error) {
      groups.push({ name: repo.name, url: repo.url, commits: [], error })
      continue
    }
    for (const g of splitByProject(commits)) {
      // groupId 必须全组唯一：同仓库拆出的多组若共用 url，周报 id 与通知基线都会冲突
      groups.push({ ...g, url: repo.url, groupId: `${repo.url}#${g.name}` })
    }
  }
  const total = groups.reduce((n, g) => n + g.commits.length, 0)
  return {
    groups,
    counts: { repos: cfg.repos.length, commits: total },
    authorsOnly: !showAll,
    syncedAt: new Date().toISOString(),
  }
}

module.exports = {
  loadConfig,
  saveConfig,
  clearConfig,
  testConnection,
  fetchLogs,
}
