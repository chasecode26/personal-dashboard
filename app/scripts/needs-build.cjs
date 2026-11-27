/**
 * 判断是否需要重新构建前端产物。
 * dist/ 不入库，源码改动后必须重新构建；仅判断 dist\index.html 是否存在会导致
 * 改了源码却一直运行旧产物（曾因此排查了半天"改动不生效"）。
 *
 * 退出码（调用方务必区分，异常码不能被当成"产物最新"）：
 *   0  = 需要构建
 *   10 = 产物是最新的，可直接启动
 *   20 = 检查过程出错，应中止启动并报错
 * 用 10/20 而不是 1/2，是为了和 node 自身崩溃的退出码 1 区分开：
 * 脚本语法错误时 node 直接以 1 退出，若"最新"也用 1 就会被误判为可直接启动。
 */
const fs = require('fs')
const path = require('path')

const EXIT_BUILD_NEEDED = 0
const EXIT_UP_TO_DATE = 10
const EXIT_CHECK_FAILED = 20

const root = path.join(__dirname, '..')
const distIndex = path.join(root, 'dist', 'index.html')

// 覆盖 build:web 的全部输入（tsc -b && vite build && fix-dist-module.cjs）
const WATCH_DIRS = ['src', 'public']
const WATCH_FILES = ['index.html', 'package.json', 'vite.config.ts', 'tsconfig.json', 'scripts/fix-dist-module.cjs']

function newestMtime(target) {
  // 用 lstat 不跟随符号链接：源码目录里若有目录链接，跟随会无限递归
  const stat = fs.lstatSync(target)
  if (stat.isSymbolicLink() || !stat.isDirectory()) return stat.mtimeMs
  let newest = 0
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    newest = Math.max(newest, newestMtime(path.join(target, entry.name)))
  }
  return newest
}

try {
  if (!fs.existsSync(distIndex)) process.exit(EXIT_BUILD_NEEDED)

  const builtAt = fs.statSync(distIndex).mtimeMs
  let newest = 0
  for (const dir of WATCH_DIRS) {
    const full = path.join(root, dir)
    if (fs.existsSync(full)) newest = Math.max(newest, newestMtime(full))
  }
  for (const file of WATCH_FILES) {
    const full = path.join(root, file)
    if (fs.existsSync(full)) newest = Math.max(newest, newestMtime(full))
  }

  process.exit(newest > builtAt ? EXIT_BUILD_NEEDED : EXIT_UP_TO_DATE)
} catch (err) {
  // 读不到源码目录时不能当作"最新"，否则会带着旧产物启动且毫无提示
  console.error('[needs-build] 检查失败：', err.message)
  process.exit(EXIT_CHECK_FAILED)
}
