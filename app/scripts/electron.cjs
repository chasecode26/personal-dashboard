/**
 * Electron 启动器
 * 清除可能被宿主环境注入的 ELECTRON_RUN_AS_NODE，
 * 确保 electron.exe 以桌面应用模式（而非纯 Node 模式）启动。
 */
const { spawn } = require('child_process')
const path = require('path')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const electronPath = require('electron')
let args = process.argv.slice(2)
// --dev：开发模式，连 Vite 服务器 5173（由 dev:app 脚本传入）
if (args.includes('--dev')) {
  env.NEXUS_DEV = '1'
  args = args.filter((a) => a !== '--dev')
}
// 未指定入口时，默认加载项目根目录（读取 package.json 的 main）
if (args.length === 0) args.push(path.join(__dirname, '..'))

const child = spawn(electronPath, args, {
  stdio: 'inherit',
  windowsHide: false,
  env,
})

child.on('close', (code, signal) => {
  if (code === null) {
    console.error('Electron exited with signal', signal)
    process.exit(1)
  }
  process.exit(code)
})

const forward = (sig) => process.on(sig, () => child.kill(sig))
forward('SIGINT')
forward('SIGTERM')
