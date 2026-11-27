import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { preloadStore, getStoreNotice, isStoreReadable, onStoreNotice, clearNotice } from './data/store'
import './styles.css'
import './extra.css'

const root = document.getElementById('root')!
// 与 index.html 中 #boot-splash 的 opacity .35s 淡出对齐，600ms 为 transitionend 未触发时的兜底
const SPLASH_REMOVE_FALLBACK_MS = 600

// 主进程发现本地数据损坏/不可写时，必须让用户看见，否则表现为"改完重启就没了"
const WARN_COLORS = { error: '#c0392b', warn: '#b9770e' } as const
let warnBar: HTMLDivElement | null = null

function showDataWarning(text: string, background: string) {
  if (!warnBar) {
    warnBar = document.createElement('div')
    warnBar.style.cssText = `position:fixed;top:0;left:0;right:0;z-index:10000;color:#fff;font:12px/1.5 "Microsoft YaHei",sans-serif;text-align:center;padding:7px 34px 7px 12px`
    const close = document.createElement('button')
    close.textContent = '×'
    close.title = '关闭提示'
    close.style.cssText = `position:absolute;right:8px;top:4px;background:transparent;border:none;color:#fff;font-size:16px;cursor:pointer;line-height:1`
    close.onclick = () => {
      warnBar?.remove()
      warnBar = null
      // 必须清掉已提示文案，否则同类错误再次发生时 setNotice 去重会拦下广播
      clearNotice()
    }
    warnBar.appendChild(document.createElement('span'))
    warnBar.appendChild(close)
    document.body.appendChild(warnBar)
  }
  warnBar.style.background = background
  const label = warnBar.firstElementChild as HTMLElement
  label.textContent = text
}

// 环境自检：浏览器直接打开时给醒目提示（file:// 下 localStorage 不落盘，数据不会保存）
const nxEnv = (window as unknown as { nexus?: { isElectron?: boolean } }).nexus
if (!nxEnv?.isElectron) {
  showDataWarning('浏览器预览 · 数据不会保存！请双击「启动应用.vbs」打开桌面版', WARN_COLORS.error)
}

// 先等主进程下发本地数据缓存，再渲染，避免首屏读到空存储重新播种
preloadStore().then(() => {
  if (nxEnv?.isElectron) {
    if (!isStoreReadable()) showDataWarning(getStoreNotice(), WARN_COLORS.error)
    else if (getStoreNotice()) showDataWarning(getStoreNotice(), WARN_COLORS.warn)
    // 后置读取（面板挂载时才解析）发现的损坏同样要弹出来，不能只在首屏查一次
    onStoreNotice((text) => showDataWarning(
      text,
      text.includes('失败') ? WARN_COLORS.error : WARN_COLORS.warn,
    ))
  }

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )

  // 首屏内容渲染完成后淡出启动动画（等一帧，确保首屏已绘制）
  requestAnimationFrame(() => {
    const splash = document.getElementById('boot-splash')
    root.classList.add('ready')
    if (splash) {
      splash.classList.add('hidden')
      splash.addEventListener('transitionend', () => splash.remove(), { once: true })
      // transitionend 未触发时兜底移除，避免动画层残留遮挡交互
      window.setTimeout(() => splash.remove(), SPLASH_REMOVE_FALLBACK_MS)
    }
  })
})
