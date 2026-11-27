const fs = require('fs')
const path = require('path')
const { userDataDir } = require('./userData.cjs')

// 本地业务数据（待办/专注/通知/周报草稿/主题/背景等）统一落盘为 store.json。
// file:// 下渲染进程 localStorage 不落盘，故由主进程写文件持久化。
const STORE_FILE = 'store.json'
const BACKUP_PREFIX = '.corrupt-'

// 候选目录：优先 userData，其次 LOCALAPPDATA，最后应用目录下的 userdata。
// 某些环境（沙箱/受限令牌）下 AppData 目录不可写，必须回退到真正可写的位置，
// 否则每次启动 dump 都为空，界面又退回到内置种子数据。
let cachedDir = null

function candidates(app) {
  const list = []
  try { list.push(userDataDir(app)) } catch { /* userData 取不到就跳过 */ }
  if (process.env.LOCALAPPDATA) list.push(path.join(process.env.LOCALAPPDATA, 'nexus-personal-dashboard'))
  try { list.push(path.join(app.getAppPath(), 'userdata')) } catch { /* appPath 取不到就跳过 */ }
  return list.filter(Boolean)
}

function canWrite(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true })
    const probe = path.join(dir, '.write-probe')
    fs.writeFileSync(probe, 'ok')
    fs.unlinkSync(probe)
    return true
  } catch {
    return false
  }
}

function dataDir(app) {
  if (cachedDir) return cachedDir
  const list = candidates(app)
  for (const dir of list) {
    if (canWrite(dir)) { cachedDir = dir; return dir }
  }
  // 全部不可写时退回首选目录，让写入错误显式暴露而不是静默吞掉
  cachedDir = list[0]
  return cachedDir
}

function storePath(app) {
  return path.join(dataDir(app), STORE_FILE)
}

// 任何疑似损坏都必须先把磁盘原文留档，否则一旦按空数据写回，用户数据就没了。
// 备份名带标签 + 时间戳：同一 key 的损坏在不同时间各留一份，互不覆盖。
function backupCorrupt(file, text, tag) {
  try {
    const bak = `${file}${BACKUP_PREFIX}${tag}-${Date.now()}`
    fs.writeFileSync(bak, text, { encoding: 'utf8' })
    console.error('[NEXUS] 本地数据已损坏，原文已备份到：', bak)
    return bak
  } catch (err) {
    console.error('[NEXUS] 损坏数据备份失败，本次将拒绝写入：', file, err.message)
    return ''
  }
}

function writeAll(app, data) {
  const file = storePath(app)
  // 原子写：先写临时文件再改名，避免中途退出导致 JSON 损坏
  const tmp = file + '.tmp'
  try {
    fs.writeFileSync(tmp, JSON.stringify(data), { encoding: 'utf8' })
    fs.renameSync(tmp, file)
    return true
  } catch (err) {
    console.error('[NEXUS] 写入本地数据文件失败：', file, err.message)
    // 失败后必须清掉临时文件，否则下次 rename 前会留下残骸
    try { fs.unlinkSync(tmp) } catch { /* 临时文件本就不存在，忽略 */ }
    return false
  }
}

// 返回 { ok, data, notice }：
//   ok=false 表示读不出来或备份/隔离失败，本次会话只能只读；
//   notice 非空表示已经处理过损坏（原文已备份），界面需提示用户。
// 必须把"读失败"与"从没写过"区分开，否则渲染层会播种默认值把原文覆盖掉。
// 注：值内部 JSON 损坏由渲染层 readJson 解析时发现并调 quarantine 隔离；
//     非字符串值在这一层直接备份并从磁盘摘掉，不再回传键名给渲染层。
function readAll(app) {
  const file = storePath(app)
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch (err) {
    // 文件不存在是正常首次启动；其余读取失败必须留痕（带路径，便于定位）
    if (err && err.code === 'ENOENT') return { ok: true, data: {}, notice: '' }
    console.error('[NEXUS] 读取本地数据文件失败，本次只读以免覆盖：', file, err.message)
    return { ok: false, data: {}, notice: `读取本地数据失败，本次改动不会保存（${err.message}）` }
  }

  // 整份文件不可解析/不是对象：先备份原文，再把主文件重建为空对象。
  // 重建失败必须返回 ok=false，否则"说能继续写、实际没接管"会让用户误以为数据已保存。
  const corruptAll = (reason, detail) => {
    console.error(`[NEXUS] 本地数据文件${reason}：`, file, detail || '')
    const bak = backupCorrupt(file, text, reason)
    if (!bak) return { ok: false, data: {}, notice: `本地数据文件${reason}且备份失败，本次改动不会保存` }
    if (!writeAll(app, {})) {
      return { ok: false, data: {}, notice: `本地数据文件${reason}，重建失败，本次改动不会保存` }
    }
    return { ok: true, data: {}, notice: `本地数据文件${reason}，原文已备份到 ${bak}` }
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    return corruptAll('JSON解析失败', err.message)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return corruptAll('结构异常')
  }

  // 只把字符串值交给渲染层（缓存是 Map<string,string>）。非字符串值视为损坏：
  // 备份原文后把该键从磁盘摘掉，避免每次启动都重复报同一个错，也防止坏值被当成正常数据。
  const badKeys = Object.keys(parsed).filter((k) => typeof parsed[k] !== 'string')
  const data = {}
  Object.keys(parsed).forEach((k) => {
    if (typeof parsed[k] === 'string') data[k] = parsed[k]
  })
  if (badKeys.length === 0) return { ok: true, data, notice: '' }

  console.error('[NEXUS] 本地数据文件存在非字符串值：', file, badKeys.join(','))
  const bak = backupCorrupt(file, text, '异常键-' + badKeys.join('-'))
  if (!bak) {
    return { ok: false, data, notice: '本地数据存在异常值且备份失败，本次改动不会保存' }
  }
  if (!writeAll(app, data)) {
    return { ok: false, data, notice: '本地数据存在异常值，隔离失败，本次改动不会保存' }
  }
  return {
    ok: true,
    data,
    notice: `本地数据存在异常值（${badKeys.join(',')}），原文已备份到 ${bak}`,
  }
}

// 渲染层解析某个键的值失败时调用（例如值本身是字符串、但内容是坏 JSON——
// 主进程按类型检测不到，只有解析它的渲染层能发现）。
// 立即备份磁盘原文并把该键隔离，保证渲染层随后写入的空数据/默认值不会抹掉原文；
// 用户改动后写回合法值即完成修复。
function quarantine(app, key) {
  const k = safeKey(key)
  if (!k) return false
  const file = storePath(app)
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return false // 读不到就无需隔离（整文件问题由 readAll 处理）
  }
  const bak = backupCorrupt(file, text, '隔离-' + k)
  if (!bak) return false
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return true // 整文件已损坏，原文已备份，交给 readAll 重建
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return true
  delete parsed[k]
  return writeAll(app, parsed)
}

// IPC 参数不可信：key/value 一律限定为字符串，避免污染磁盘文件结构
const MAX_KEY_LENGTH = 256
function safeKey(key) {
  return typeof key === 'string' && key.length <= MAX_KEY_LENGTH && !key.includes('\0') ? key : null
}

function set(app, key, value) {
  const k = safeKey(key)
  if (!k || typeof value !== 'string') return false
  const { ok, data } = readAll(app)
  // 读不出来就拒绝写：否则会用"空 + 这一个键"整文件覆盖掉用户的原始数据
  if (!ok) {
    console.error('[NEXUS] 本地数据文件不可读，已跳过写入以保护原始数据：', key)
    return false
  }
  // 损坏键不做写拦截：原文已备份并隔离，用户写回合法值正是修复路径
  data[k] = value
  return writeAll(app, data)
}

// 一次性返回全部键值，供渲染进程启动时同步缓存，避免异步读导致的首屏竞态。
function dump(app) {
  return readAll(app)
}

module.exports = { set, dump, quarantine }
