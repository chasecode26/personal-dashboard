/**
 * 本地存储适配层。
 * Electron 下 file:// 页面的 localStorage 不落盘，统一改走主进程 IPC 写 JSON 文件；
 * 浏览器环境（npm run dev）无 window.nexus，回退到 localStorage。
 * 对外接口与 localStorage 一致（同步语义），调用方无需改读写逻辑。
 */
export interface StoreDumpResult {
  ok: boolean
  data: Record<string, string>
  notice?: string
}

interface NexusStoreApi {
  isElectron?: boolean
  storeDump?: () => Promise<StoreDumpResult>
  storeSet?: (key: string, value: string) => Promise<boolean>
  storeQuarantine?: (key: string) => Promise<boolean>
}

function getStoreApi(): NexusStoreApi | undefined {
  return (window as unknown as { nexus?: NexusStoreApi }).nexus
}

function isElectronStore(a?: NexusStoreApi): boolean {
  return Boolean(a?.isElectron && a.storeDump)
}

// Electron 下主进程启动时一次性下发全部数据到缓存，保证渲染层同步读无竞态；
// 写入时先更新缓存（界面立即生效）再异步落盘。
const cache = new Map<string, string>()
// 文件整体读不出来（无权限等）：此时只能只读，任何写入都会覆盖用户原始数据
let readable = true
// 需要告知用户的数据异常（例如"文件已损坏，原文已备份"），由界面展示
let notice = ''
let ready = false
// 提示变化订阅者：后置（面板挂载时才读）发现的损坏也要能弹出来
const noticeListeners = new Set<(text: string) => void>()
// 已隔离的键：隔离是异步 IPC，避免 readJson 多次命中时重复备份
const quarantined = new Set<string>()

function setNotice(text: string): void {
  if (!text || text === notice) return
  notice = text
  noticeListeners.forEach((l) => l(text))
}

/** 订阅数据异常提示；返回取消订阅函数 */
export function onStoreNotice(listener: (text: string) => void): () => void {
  noticeListeners.add(listener)
  return () => noticeListeners.delete(listener)
}

/**
 * 用户关闭横幅时清空已提示文案。
 * setNotice 按文案去重，不清的话同类错误再次发生就不会广播，界面静默。
 */
export function clearNotice(): void {
  notice = ''
}

export async function preloadStore(): Promise<void> {
  if (ready) return
  const a = getStoreApi()
  if (isElectronStore(a)) {
    try {
      const res = await a!.storeDump!()
      readable = res?.ok !== false
      if (!readable) {
        console.error('[NEXUS] 本地数据文件读取失败，本次会话只读、不保存以免覆盖原始数据')
        setNotice('本地数据读取失败 · 本次改动不会保存，请检查磁盘权限')
      } else if (res?.notice) {
        console.warn('[NEXUS]', res.notice)
        setNotice(res.notice)
      }
      Object.entries(res?.data || {}).forEach(([k, v]) => {
        if (typeof v === 'string') cache.set(k, v)
      })
    } catch (err) {
      readable = false
      console.error('[NEXUS] 本地存储加载失败，本次会话只读、不保存以免覆盖原始数据：', err)
      setNotice('本地数据读取失败 · 本次改动不会保存，请检查磁盘权限')
    }
  }
  ready = true
}

/** 磁盘数据是否可信可写；false 时调用方不应播种默认值 */
export function isStoreReadable(): boolean {
  return readable
}

/** 本地数据异常的用户可读说明，空串表示无异常 */
export function getStoreNotice(): string {
  return notice
}

/**
 * 标记某个键内容已损坏：通知主进程把磁盘原文备份并隔离该键，
 * 随后的写入（默认值回填 / 用户改动）不会抹掉原文。
 * 主进程按类型检测不到"值是合法字符串但内部 JSON 坏"的情况，必须靠渲染层解析时发现。
 */
export function markCorrupt(key: string): void {
  if (quarantined.has(key)) return
  quarantined.add(key)
  const a = getStoreApi()
  if (isElectronStore(a) && typeof a!.storeQuarantine === 'function') {
    void a!.storeQuarantine!(key).then((done) => {
      // 只有隔离真的成功才能说"原文已备份保留"；失败时必须改口，不能撒谎
      if (done) {
        console.warn('[NEXUS] 已备份并隔离损坏数据：', key)
        setNotice('部分本地数据已损坏，已丢弃损坏项（原文已备份保留）')
      } else {
        console.error('[NEXUS] 损坏数据隔离失败：', key)
        setNotice('本地数据损坏且备份失败 · 本次改动不会保存，请检查磁盘权限')
      }
    }).catch((err) => {
      console.error('[NEXUS] 损坏数据隔离异常：', key, err)
      setNotice('本地数据损坏且备份失败 · 本次改动不会保存，请检查磁盘权限')
    })
  } else {
    // 浏览器回退无主进程可备份，仍要让用户知道数据异常（首屏已有红底提示）
    setNotice('部分本地数据格式异常，本次使用默认值')
  }
}

export function getItem(key: string): string | null {
  if (isElectronStore(getStoreApi())) return cache.has(key) ? cache.get(key)! : null
  try { return localStorage.getItem(key) } catch { return null }
}

export function setItem(key: string, value: string): void {
  const a = getStoreApi()
  if (isElectronStore(a)) {
    if (!readable) {
      console.error('[NEXUS] 本地数据不可读，已跳过写入以保护原始数据：', key)
      return
    }
    cache.set(key, value)
    a!.storeSet!(key, value).then((ok) => {
      if (ok) return
      console.error('[NEXUS] 本地数据写入失败：', key)
      // 写入失败必须让用户看见，否则表现为"改完重启就没了"
      setNotice('本地数据写入失败 · 本次改动不会保存，请检查磁盘权限')
    }).catch((err) => {
      console.error('[NEXUS] 本地数据写入异常：', key, err)
      setNotice('本地数据写入失败 · 本次改动不会保存，请检查磁盘权限')
    })
    return
  }
  try { localStorage.setItem(key, value) }
  catch (err) { console.warn('[NEXUS] 写入本地存储失败：', err) }
}

export interface StoreReadResult<T> {
  /** 磁盘上是否存在这个键（false 表示从没写过，调用方可以播默认值） */
  found: boolean
  /** 存在但解析失败或结构不符：此时禁止写回，也不能播默认值 */
  corrupt: boolean
  value: T | null
}

/**
 * 读取并解析一个 JSON 键，统一处理"缺失 / 损坏 / 正常"三态。
 * 六个业务模块原来各写一份相同的解析 + markCorrupt + 打日志，容易漏标记导致覆盖原文，
 * 这里收口成一处，保证任何损坏都会触发备份隔离。
 */
export function readJson<T>(
  key: string,
  isValid: (value: unknown) => value is T,
  label: string,
): StoreReadResult<T> {
  const raw = getItem(key)
  if (raw === null) return { found: false, corrupt: false, value: null }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (isValid(parsed)) return { found: true, corrupt: false, value: parsed }
    console.error(`[NEXUS] ${label}格式异常，本次使用默认值（正在备份磁盘原文）`)
  } catch (err) {
    console.error(`[NEXUS] ${label}解析失败，本次使用默认值（正在备份磁盘原文）：`, err)
  }
  // markCorrupt 内部异步发起隔离，成功后才由 storeQuarantine 的回调提示"已备份"
  markCorrupt(key)
  return { found: true, corrupt: true, value: null }
}
