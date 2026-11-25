const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('nexus', {
  platform: () => ipcRenderer.invoke('app:platform'),
  version: () => ipcRenderer.invoke('app:version'),
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),
  openExternal: (url) => ipcRenderer.send('open:external', url),
  dockOpen: (kind) => ipcRenderer.invoke('dock:open', kind),
  jiraConfig: () => ipcRenderer.invoke('jira:config'),
  jiraSave: (cfg) => ipcRenderer.invoke('jira:save', cfg),
  jiraClear: () => ipcRenderer.invoke('jira:clear'),
  jiraTest: (cfg) => ipcRenderer.invoke('jira:test', cfg),
  jiraBoard: () => ipcRenderer.invoke('jira:board'),
  jiraWeekly: () => ipcRenderer.invoke('jira:weekly'),
  svnConfig: () => ipcRenderer.invoke('svn:config'),
  svnSave: (cfg) => ipcRenderer.invoke('svn:save', cfg),
  svnClear: () => ipcRenderer.invoke('svn:clear'),
  svnTest: (cfg) => ipcRenderer.invoke('svn:test', cfg),
  svnLogs: () => ipcRenderer.invoke('svn:logs'),
  weatherConfig: () => ipcRenderer.invoke('weather:config'),
  weatherSave: (cfg) => ipcRenderer.invoke('weather:save', cfg),
  weatherClear: () => ipcRenderer.invoke('weather:clear'),
  weatherCurrent: () => ipcRenderer.invoke('weather:current'),
  weatherSearch: (kw) => ipcRenderer.invoke('weather:search', kw),
  notifyShow: (payload) => ipcRenderer.invoke('notify:show', payload),
  // 系统通知被点击时，主进程让渲染进程打开通知中心；返回取消订阅函数
  onNotifyOpen: (cb) => {
    const listener = () => cb()
    ipcRenderer.on('notify:open', listener)
    return () => ipcRenderer.removeListener('notify:open', listener)
  },
  isElectron: true,
})
