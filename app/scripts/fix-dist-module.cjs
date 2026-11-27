/**
 * 构建后处理：Electron 以 file:// 打开 dist/index.html，
 * Chromium 对 file:// 下的 <script type="module"> 强制 CORS 拦截，渲染进程 JS 不执行导致白屏。
 * Vite 产物为单个自包含 bundle（无 import/export），降级为普通 script 即可在 file:// 下正常执行。
 * module 脚本隐含 defer，替换时补上 defer 以保持「DOM 解析完再执行」的语义（否则 head 中同步执行取不到 #root）。
 */
const fs = require('fs')
const path = require('path')

const indexPath = path.join(__dirname, '..', 'dist', 'index.html')
let html = fs.readFileSync(indexPath, 'utf8')
const before = html
html = html
  .replace(/<script([^>]*)>/g, (_m, attrs) => {
    const cleaned = attrs
      .replace(/\s*type="module"/g, ' defer')
      .replace(/\s*crossorigin(?=[\s>])/g, '')
    return '<script' + cleaned + '>'
  })
  .replace(/<link([^>]*)>/g, (_m, attrs) => '<link' + attrs
    .replace(/\s*crossorigin(?=[\s>])/g, '') + '>')
if (html === before) {
  console.log('[fix-dist-module] index.html 无需修改')
} else {
  fs.writeFileSync(indexPath, html, 'utf8')
  console.log('[fix-dist-module] 已降级 module→defer、移除 crossorigin，兼容 file:// 加载')
}
