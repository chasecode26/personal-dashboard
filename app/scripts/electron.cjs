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
// --no-sandbox：部分 Windows 环境下 Electron 渲染进程沙箱与系统 ACL 冲突，
// 不加会以 0x80000003 (STATUS_ACCESS_VIOLATION) 直接崩溃且不留日志。
// 代价是渲染进程沙箱失效，因此这里只保留 contextIsolation + 预加载白名单作为隔离边界。
let args = ['--no-sandbox', ...process.argv.slice(2)]
// --dev：开发模式，连 Vite 服务器 5173（由 dev:app 脚本传入）
if (args.includes('--dev')) {
  env.NEXUS_DEV = '1'
  args = args.filter((a) => a !== '--dev')
}
// 未指定入口时，默认加载项目根目录（读取 package.json 的 main）。
// 注意要基于过滤后的 args 判断：--dev 已被移除，此时同样需要补入口
if (args.length === 1) args.push(path.join(__dirname, '..'))

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
