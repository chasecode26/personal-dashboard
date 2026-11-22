const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require('electron')
const { exec } = require('child_process')
const jira = require('./jira.cjs')
const svn = require('./svn.cjs')
const weather = require('./weather.cjs')
const path = require('path')
const fs = require('fs')

// 项目根目录：开发模式为 app/，打包后取 app.asar 所在目录
function projectRoot() {
  return app.isPackaged ? path.dirname(app.getAppPath()) : app.getAppPath()
}

// 默认加载打包好的本地 dist；只有显式 NEXUS_DEV=1 时才连 Vite 开发服务器
const isDev = process.env.NEXUS_DEV === '1'
let mainWindow = null
let tray = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    transparent: false,
    backgroundColor: '#f2f6f1',
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  const distIndex = path.join(__dirname, '..', 'dist', 'index.html')
  if (!isDev && !fs.existsSync(distIndex)) {
    mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
      '<div style="font-family:sans-serif;padding:60px;color:#1e3027">' +
      '<h2>找不到界面文件</h2><p>请先执行 <code>npm run build:web</code> 生成 dist，再启动应用。</p></div>'
    ))
    return
  }

  const url = isDev
    ? 'http://127.0.0.1:5173'
    : 'file://' + distIndex
  mainWindow.loadURL(url)

  // 开发模式打开调试器，方便排查；同时把渲染进程错误打到控制台
  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('[NEXUS] 页面加载失败:', code, desc, url)
  })
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png')
  if (!fs.existsSync(iconPath)) return
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  const menu = Menu.buildFromTemplate([
    { label: '显示工作台', click: () => mainWindow && mainWindow.show() },
    { label: '关于', click: () => shell.openExternal('https://github.com') },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ])
  tray.setToolTip('NEXUS 工作台')
  tray.setContextMenu(menu)
  tray.on('click', () => mainWindow && mainWindow.show())
}

app.whenReady().then(() => {
  createWindow()
  createTray()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// 窗口控制
ipcMain.on('win:minimize', () => mainWindow && mainWindow.minimize())
ipcMain.on('win:maximize', () => {
  if (!mainWindow) return
  if (mainWindow.isMaximized()) mainWindow.unmaximize()
  else mainWindow.maximize()
})
ipcMain.on('win:close', () => mainWindow && mainWindow.close())

// 打开外部链接（系统默认浏览器）
ipcMain.on('open:external', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url)
})

// Dock 工具：打开文件夹 / 终端 / 代码编辑器
ipcMain.handle('dock:open', async (_e, kind) => {
  const root = projectRoot()
  try {
    if (kind === 'folder') {
      await shell.openPath(root)
      return { ok: true }
    }
    if (kind === 'terminal') {
      const cwd = root.replace(/"/g, '')
      if (process.platform === 'win32') exec(`start cmd /K "cd /d "${cwd}""`)
      else if (process.platform === 'darwin') exec(`open -a Terminal "${cwd}"`)
      else exec(`x-terminal-emulator --working-directory="${cwd}"`)
      return { ok: true }
    }
    if (kind === 'code') {
      const cwd = root.replace(/"/g, '')
      exec(`code "${cwd}"`, (err) => {
        // VS Code 未安装时退回打开文件管理器
        if (err) shell.openPath(root)
      })
      return { ok: true }
    }
    return { ok: false, msg: 'unknown kind' }
  } catch (err) {
    return { ok: false, msg: String(err && err.message || err) }
  }
})

// ===== Jira 集成 =====
ipcMain.handle('jira:config', () => jira.loadConfig())
ipcMain.handle('jira:save', (_e, cfg) => jira.saveConfig(cfg))
ipcMain.handle('jira:clear', () => jira.clearConfig())
ipcMain.handle('jira:test', (_e, cfg) => jira.testConnection(cfg))
ipcMain.handle('jira:board', async () => {
  const cfg = jira.loadConfig()
  if (!cfg || !cfg.baseUrl || !cfg.token) throw new Error('Jira 尚未配置')
  return jira.fetchBoard(cfg)
})

// ===== SVN 提交记录集成 =====
ipcMain.handle('svn:config', () => svn.loadConfig())
ipcMain.handle('svn:save', (_e, cfg) => svn.saveConfig(cfg))
ipcMain.handle('svn:clear', () => svn.clearConfig())
ipcMain.handle('svn:test', (_e, cfg) => svn.testConnection(cfg))
ipcMain.handle('svn:logs', async () => {
  const cfg = svn.loadConfig()
  if (!cfg || !cfg.repos || !cfg.repos.length) throw new Error('SVN 尚未配置')
  return svn.fetchLogs(cfg)
})

// ===== 天气集成 =====
ipcMain.handle('weather:config', () => weather.loadConfig())
ipcMain.handle('weather:save', (_e, cfg) => weather.saveConfig(cfg))
ipcMain.handle('weather:clear', () => weather.clearConfig())
ipcMain.handle('weather:current', async () => weather.fetchWeather(weather.loadConfig()))
ipcMain.handle('weather:search', async (_e, keyword) => weather.searchCity(keyword))

// 平台信息
ipcMain.handle('app:platform', () => process.platform)
ipcMain.handle('app:version', () => app.getVersion())
