# NEXUS 个人全能工作台（Electron 桌面端）

把工作、生活、学习、健康聚合到一个桌面工作台。React + TypeScript + Vite + Electron。

## 一、快速开始

### 环境要求
- Node.js 20 LTS 或更高（本机已验证 Node 22）
- npm 10（Node 自带）

### 安装依赖
```bash
cd personal-dashboard/app
npm install
```

> 国内网络若 Electron 二进制下载慢，先设镜像再装：
> ```bash
> npm config set electron_mirror https://npmmirror.com/mirrors/electron/
> npm install
> ```

### 正常运行（推荐）
```bash
npm run build:web    # 首次 / 改完代码后，构建出 dist
npm run electron     # 启动桌面窗口（加载本地 dist，不需要开发服务器）
```
Electron 默认直接加载打包好的 `dist/index.html`，**不会白屏，也不需要另开终端**。
如果 dist 不存在，窗口会给出明确提示而不是空白。

### 开发热更新（改代码时用）
一条命令同时起 Vite 开发服务器 + Electron（需 concurrently、wait-on）：
```bash
npm run dev:app
```
此模式通过 `--dev` 参数让 Electron 连 `http://127.0.0.1:5173`，改代码即时刷新。

> **踩坑提示 1**：如果某些 IDE/终端环境注入了 `ELECTRON_RUN_AS_NODE=1`，
> Electron 会被当成纯 Node 运行并报 `app is undefined`。
> 本项目已用 `scripts/electron.cjs` 启动器自动清除该变量。
>
> **踩坑提示 2**：直接 `npm run electron` 白屏，多半是 dist 没构建（先跑 `npm run build:web`），
> 或误开了 `NEXUS_DEV=1`。默认不要设这个变量。

### 只看界面（不启动 Electron）
前端构建后可用浏览器直接看，适合快速确认视觉：
```bash
npm run build:web
cd dist && python -m http.server 5180
# 浏览器打开 http://127.0.0.1:5180
```

### 打包成安装包（C 端一键安装）
```bash
npm run dist
# 产物在 release/ 目录：Windows 出 Setup.exe，macOS 出 dmg
```

## 二、当前进度（P0 完成）

| 模块 | 状态 | 说明 |
|---|---|---|
| 桌面窗口 | ✅ | 无边框、可拖拽、托盘图标、最小化/最大化/关闭 |
| 顶部栏 + 侧边导航 | ✅ | 实时时钟、6 色主题切换（记忆） |
| 风景 Hero 横幅 | ✅ | 治愈系插画 + 问候语 + 日期 |
| 5 个概览统计卡 | ✅ | 环形进度，任务卡数据联动 |
| 13 张功能卡片 | ✅ | 天气/本周/健康/任务/学习/进程/日程/心情/语录/工具/网站/DIY |
| 任务清单 | ✅ | 勾选/筛选/新增/删除，进度条联动，localStorage 持久化 |
| 今日心情 | ✅ | 5 种心情可切换，文案联动 |
| **卡片自定义背景** | ✅ | 预设图/渐变/本地上传/URL + 遮罩强度 + 文字明暗，逐卡持久化 |
| 常用网站跳转 | ⏳ | 原型阶段，P1 接 `open:external` 打开系统浏览器 |
| Dock 工具图标 | ✅ | 终端/代码/文件夹真实打开、tooltip 提示、美化提示气泡 |
| **Jira 研发工作台** | ✅ | 真实 API 接入，待办任务/待修 BUG/今日完成三列，配置面板 + 测试连接 |
| **SVN 提交记录** | ✅ | 真实数据接入，按项目分组展示最近提交，窄卡片，配置面板 + 测试连接 |

## 三、Jira 配置（真实数据）

工作台顶部新增「我的工作追踪」卡片，连接后显示你名下的**待办任务 / 待修 BUG / 今日完成**，点击条目在浏览器打开对应 issue。

**配置步骤：**
1. 点击 Jira 卡片右上角「⚙ 配置」（未连接时点「连接 Jira」）
2. 选择部署类型（**默认本地部署 / Server**）：
   - **本地部署 / Server**：地址填完整内网地址，如 `http://192.168.1.10:8080`，装在子路径就带上 `/jira`
   - **Jira Cloud**：地址填 `your-company.atlassian.net`，账号填 Atlassian 邮箱
3. 本地部署选认证方式：
   - **账号密码**：填 Jira 用户名 + 密码（老版本可用）
   - **Personal Access Token**：仅填 PAT Token（新版本推荐，若账号密码 Basic 认证被禁用必须用这个）
4. 内网自签名 HTTPS 证书：勾选「忽略 SSL 证书错误」
5. 项目 Key 选填（如 `DEV`），留空则查所有项目
6. 点「测试连接」确认，再点「保存并加载」

**查询逻辑**（JQL，写入 `electron/jira.cjs`）：
- 待办：`assignee = currentUser() AND statusCategory != Done AND issuetype != Bug`
- BUG：`assignee = currentUser() AND statusCategory != Done AND issuetype = Bug`
- 今日完成：`assignee = currentUser() AND statusCategory = Done AND resolutiondate >= startOfDay()`

**兼容与存储：**
- 请求层用原生 http/https：支持 `http://` 内网地址、自签名证书（忽略证书开关）、自动跟随重定向
- 本地部署直接走 v2 API（`/rest/api/2/myself`、`/rest/api/2/search`）；Cloud 先试新版 `POST /search/jql`，失败退回旧版
- 认证：Server 支持账号密码（Basic）与 PAT（Bearer），Cloud 用邮箱 + API Token
- 凭证只存本机 `%APPDATA%/nexus-personal-dashboard/jira-config.json`（权限 600），不进代码、不上传

## 三·补、SVN 提交记录（真实数据）

Jira 卡片下方新增「代码动态」窄卡（宽 520px），连接后**按项目（仓库）分组**显示每个仓库最近的提交记录：版本号 `r123`、提交说明、作者、时间、变更文件数（+新增/~修改/-删除），鼠标悬停可看完整变更路径。

**配置步骤：**
1. 点击 SVN 卡片右上角「⚙ 配置」（未连接时点「连接 SVN」）
2. 填仓库地址：每个仓库即一个项目分组，点「+ 添加仓库」可加多个
   - 填完整内网地址，如 `http://192.168.1.10:8080/svn/项目名`
   - 项目名留空则自动取地址末段作为分组标题
   - 地址不带协议时默认补 `http://`
3. 填用户名 + 密码（SVN 登录账号）
4. 内网自签名 HTTPS 证书：勾选「忽略 SSL 证书错误」
5. 每个项目显示条数（默认 20）、只看某作者（选填，过滤出自己的提交）
6. 点「测试连接」确认，再点「保存并加载」

**实现原理：**
- 采用 SVN 的 HTTP(S) DAV `REPORT` 协议（即 `svn log` 的底层协议），**无需本机安装 SVN 客户端**
- 原生 http/https 请求：支持 `http://` 内网地址、自签名证书忽略、Basic 账号密码认证、重定向跟随
- 仅支持 `http(s)://` 仓库；`svn://` 协议（svnserve 默认 3690 端口）暂不支持
- 凭证只存本机 `%APPDATA%/nexus-personal-dashboard/svn-config.json`（权限 600），不进代码、不上传

**后续增强（未实现）：** 按项目分组的折叠/排序、提交记录搜索、点击查看 diff、提交频率统计图表。

## 四、数据存储

- **当前（P0）**：`localStorage`，键名前缀 `nexus.`
  - 任务：`nexus.tasks.v1`
  - 主题：`nexus-theme`
  - 卡片背景：`nexus-card-bgs.v1`
- **未来（P1）**：换 SQLite。数据层已抽象为 `TaskRepository` 接口（`src/data/repository.ts`），
  只需在 `createTaskRepository()` 里替换实现，业务组件零改动。

## 五、目录结构

```
app/
├── electron/
│   ├── main.cjs          # 主进程：窗口、托盘、IPC（含 Jira/SVN handlers）
│   ├── jira.cjs          # Jira API 服务：配置存储/鉴权/搜索/端点回退
│   ├── svn.cjs           # SVN 服务：REPORT 协议取 log/XML 解析/多仓库分组
│   └── preload.cjs       # 预加载：安全暴露 API
├── src/
│   ├── App.tsx           # 主界面（13 张卡片 + Jira/SVN 模块）
│   ├── components/       # Card / Icons / JiraBoard / JiraConfigModal / SvnCard / SvnConfigModal
│   ├── data/repository.ts# 数据仓储抽象层
│   ├── hooks/            # useTheme / useCardBackgrounds / useJira / useSvn
│   ├── styles.css        # 界面样式（从原型提取）
│   └── extra.css         # Electron 桌面端补充样式
├── public/assets/        # 风景插画（构建时复制进 dist）
├── assets/icon.png       # 应用图标
└── package.json
```

## 六、下一步（P1）

1. 天气接 Open-Meteo 实时 API（免 Key）
2. 常用网站/工具接 `open:external` 打开系统浏览器
3. 任务仓储换 SQLite（electron IPC + better-sqlite3）
4. 学习/健康数据接入（iOS HealthKit → 伴侣 App → 云端同步）
5. 进程占用读取（原生模块，需额外编译）
6. Jira 增强：缓存与离线回退、可配置 JQL、单 issue 快捷操作
7. SVN 增强：分组折叠/排序、提交搜索、查看 diff、提交频率统计图表

## 七、已知限制

- 天气、健康、学习、进程数据目前是原型静态数据，P1 起逐步接真实数据源（Jira、SVN 已接真实数据）
- Jira 查询当前固定为「分配给我」，筛选条件暂不可在界面自定义（代码里可改）
- SVN 仅支持 `http(s)://` 仓库，`svn://` 协议暂不支持；需服务端开启 DAV `REPORT`（标准 SVN over HTTP 均支持）
- 无边框窗口在 Linux 下拖拽行为可能与 Windows 略有差异
- 打包需图标 `.ico`（Windows）/ `.icns`（macOS），当前用 PNG 占位
