const path = require('path')

// 用户数据目录：打包/Icon 启动下用 userData，普通 node 子进程下回退到 APPDATA，
// 便于无 GUI 环境直接调用 jira.cjs / svn.cjs 做接入验证。
function userDataDir(app) {
  if (app && typeof app.getPath === 'function') {
    try { return app.getPath('userData') } catch {}
  }
  return path.join(process.env.APPDATA || process.env.HOME || '.', 'nexus-personal-dashboard')
}

module.exports = { userDataDir }
