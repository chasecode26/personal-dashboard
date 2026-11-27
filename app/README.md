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

**一键启动（免命令行）**：仓库根目录双击 `启动应用.vbs`（无黑窗）或 `一键启动.bat`（保留控制台可看报错）。
脚本会自动判断 `dist` 是否过期（`scripts/needs-build.cjs` 比对源码 mtime），过期才重新构建，
所以改完代码直接双击即可，不会再出现「改了没效果、跑的还是旧产物」。

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
>
> **踩坑提示 3**：部分 Windows 环境（含低权限沙箱）下 Electron 沙箱与系统冲突，
> 启动器已默认追加 `--no-sandbox`，不加会以 `0x80000003` 直接崩溃且无任何日志。

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
| **天气（真实数据）** | ✅ | wttr.in + Open-Meteo 免 Key API，城市搜索/经纬度/摄氏华氏，10 分钟自动刷新，Hero 顶部联动 |
| 常用网站跳转 | ✅ | 点击走 `open:external` 打开系统默认浏览器 |
| **专注计时（番茄钟）** | ✅ | 15/25/45/60 分钟预设、暂停/继续/结束、标签、刷新不丢，会话本地持久化 |
| **本周任务完成分布** | ✅ | 基于任务真实完成时间统计（周一~周日），累计/日均实时计算，非静态数据 |
| **通知中心** | ✅ | 专注完成、Jira 待办/BUG/完成数变化、SVN 新提交自动提醒；应用内收件箱 + 可选系统桌面通知 |
| **周报生成** | ✅ | 本周工作/下周计划两大区块，按项目分组，仅含工作内容（过滤学习/生活），可编辑 + 一键复制 |
| Dock 工具图标 | ✅ | 终端/代码/文件夹真实打开、tooltip 提示、美化提示气泡、通知未读角标、周报入口 |
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

Jira 卡片下方新增「代码动态」窄卡（宽 520px），连接后**按项目（提交路径的二级目录，如 `2.软件研发/14.贵货武装押运平台`）分组**显示最近的提交记录：版本号 `r123`、提交说明、作者、时间、变更文件数（+新增/~修改/-删除），鼠标悬停可看完整变更路径。默认只看当前账号自己的提交，点卡片标题栏的「只看我 / 看全部」切换范围。

**配置步骤：**
1. 点击 SVN 卡片右上角「⚙ 配置」（未连接时点「连接 SVN」）
2. 填仓库地址：每个仓库下按提交路径二级目录再分项目组，点「+ 添加仓库」可加多个
   - http(s) 仓库填完整内网地址，如 `http://192.168.1.10:8080/svn/项目名`
   - svnserve 仓库填 `svn://192.168.1.10/仓库名`（需本机安装 svn 命令行）
   - 项目名留空则自动取地址末段作为分组标题
   - 地址不带协议时默认补 `http://`
3. 填用户名 + 密码（SVN 登录账号）；用户名同时用于「只看我」过滤
4. 内网自签名 HTTPS 证书：勾选「忽略 SSL 证书错误」
5. 每个项目显示条数（默认 20）；默认只看自己的提交，卡片上可切「看全部」，另有「只看某作者」选填过滤
6. 点「测试连接」确认，再点「保存并加载」

**实现原理：**
- `http(s)://` 仓库走 SVN DAV `REPORT` 协议（即 `svn log` 的底层协议），**无需本机安装 SVN 客户端**；原生 http/https 请求支持内网地址、自签名证书忽略、Basic 认证、重定向跟随
- `svn://` 仓库（svnserve 默认 3690 端口）通过本机 `svn log --xml -v` 命令行读取，需安装 SVN 客户端；启动脚本会自动探测 `SVN_BIN` 环境变量或 PATH 中的 svn
- 提交按路径二级目录分组；多项目提交会拆到各项目组分别展示
- 凭证只存本机 `%APPDATA%/nexus-personal-dashboard/svn-config.json`（权限 600），不进代码、不上传

**后续增强（未实现）：** 项目分组的折叠/排序、提交记录搜索、点击查看 diff、提交频率统计图表。

## 三·补2、天气（真实数据）

天气卡与 Hero 顶部的天气均为实时数据，不再使用静态假数据。

**数据源（均免 Key）：**
- 天气主体（温度/体感/湿度/风速/天气码/紫外线/未来 6 小时趋势）：`wttr.in`，支持中文城市名与经纬度查询
- 空气质量（PM2.5 / US AQI）：`Open-Meteo` air-quality API
- 城市搜索（配置弹窗）：`Open-Meteo` geocoding API

**配置步骤：**
1. 点击天气卡右上角「⚙」或 Hero 顶部天气区域，打开设置
2. 搜索城市（中文/拼音）并点选，自动填入经纬度（推荐，定位最准）；也可只填城市名
3. 选温度单位（摄氏/华氏）；默认开启「按 IP 自动定位当前城市」，城市留空即用当前网络出口所在城市（简体中文）
4. 点「保存并加载」

**机制：**
- 定位优先级：手动经纬度 > 手动城市名 > IP 自动定位（默认开启，城市留空时按当前网络出口定位，返回简体中文城市名）
- 天气码映射为中文描述与对应图标（晴/多云/雨/雪/雾/雷等）
- 启动后拉取一次，每 10 分钟自动刷新，窗口重新聚焦也刷新
- 配置存本机 `%APPDATA%/nexus-personal-dashboard/weather-config.json`（权限 600），不入库
- 网络失败时卡片显示明确的错误态与「重试 / 设置城市」，不再显示假数据

## 三·补3、专注计时与真实任务统计

**专注计时（番茄钟）：**
- 点击 Dock 时钟图标或「专注时长」统计卡打开面板；运行中图标呼吸高亮
- 预设 15/25/45 分钟，可暂停/继续/提前结束，支持标签（编码/学习/阅读/其他）
- 计时基于绝对结束时间计算，窗口刷新不丢；完成或结束后写入本地会话记录
- 今日专注时长统计卡、面板「今日已专注 X 分钟」均来自真实会话记录

**本周任务完成分布：**
- 勾选任务时记录 `completedAt` 时间戳，柱状图按周一~周日真实归集
- 累计/日均（按本周已过天数）实时计算；无完成记录时显示引导而非假数据
- 任务取消勾选会清除 `completedAt`，统计同步回退

## 三·补4、通知中心

Dock 铃铛打开右侧收件箱，未读数以红色角标显示。所有消息来自真实事件，不再有"P1 开放"占位。

**通知来源：**
- **专注**：番茄钟自然到点（`专注完成`）或提前结束且满 1 分钟（`专注已结束`），附带标签与实际分钟数
- **Jira**：每 5 分钟轮询，对比待办数 / BUG 数 / 今日完成数的变化，只在新变化时提醒（首次连接只建快照，不打扰）；点击通知可在浏览器打开对应 issue
- **SVN**：每 5 分钟轮询，**按仓库各自的最大 revision 对比**（跨仓库版本号不连续也不会漏报），新增提交按项目汇总；点击可打开发生变化的仓库

**收件箱功能：**
- 按「今天 / 更早」分组，显示来源标签与相对时间（刚刚 / N 分钟前 / N 小时前 / 昨天 / 日期）
- 单条删除、全部标为已读、一键清空；点击有链接的通知直接跳转并处理已读
- 底部开关控制是否弹出系统桌面通知；关闭后消息仍会存入收件箱
- 系统通知被点击时会唤起窗口并自动打开收件箱

**实现要点：**
- 通知数据走 `NotificationRepository`（localStorage），与任务/专注仓储同一抽象，最多保留 100 条
- 系统通知走 Electron `Notification` IPC；Windows 下设置 `AppUserModelID`，否则通知可能归入 PowerShell 而不弹出
- 系统不支持通知时 IPC 返回 `{ ok:false }`，应用内收件箱不受影响

## 三·补5、周报生成

点击 Dock 的「周报」图标，或 Jira 卡片头部的「▤ 周报」打开面板。面板按本周（周一~周日）聚合真实数据，分两大区块展示，每个区块下按项目分组、逐条列出详细内容。**周报只体现工作内容，学习/生活类任务不进入周报。**

**数据来源与分组规则：**

| 区块 | 来源 | 分组方式 |
|---|---|---|
| 一、本周工作内容 | Jira 本周完成（`resolutiondate >= startOfWeek()`） | 按 Jira 项目（project key / 名称） |
| | SVN 本周提交（按提交时间过滤） | 按仓库名 |
| | 本地已完成任务（`category === 'work'` 且按 `completedAt`） | 归入「本地工作」 |
| 二、下周工作计划 | Jira 当前未完成事项（任务 + BUG） | 按 Jira 项目 |
| | 本地未完成任务（`category === 'work'`） | 归入「本地工作」 |

**面板能力：**
- 每条内容可直接点击修改，带来源标签（Jira / SVN / 本地 / 手动）；Jira 条目和 SVN 仓库可点击 ↗ 打开原始链接
- 可新增项目、新增条目、删除项目或条目；修改即时存为草稿，刷新不丢
- 「一键复制」：面板头部和底部固定栏各有一个复制按钮，点击后全文写入剪贴板，按钮短暂显示「✓ 已复制」并弹 toast；`file://` 下自动降级到 `execCommand`，可直接粘贴到任意周报系统
- 导出结构：`# 周报（周区间）` → `## 一、本周工作内容` / `## 二、下周工作计划` → `### 项目名` → `- 条目`
- 「↻ 重新聚合」从数据源重新生成（会覆盖手动修改，需确认）
- 草稿按周一日期分 key（`nexus.weekly-report.v1.<YYYY-MM-DD>`），每周互不干扰；已有草稿不会被自动生成覆盖
- Jira / SVN 未连接时不会被卡住：面板显示来源状态，用可用来源生成周报

## 四、数据存储

- **桌面版**：主进程写 `store.json`，经 IPC 读写，键名前缀 `nexus.`
  - 目录按顺序探测，取第一个可写的：Electron `userData`（通常为 `%APPDATA%/nexus-personal-dashboard/`） → `%LOCALAPPDATA%/nexus-personal-dashboard/` → `app/userdata/`
  - 写入是原子的（先写 `.tmp` 再 rename），不会产生半截文件
  - 文件整体损坏（JSON 解析失败/结构不是对象）时会**先备份原文**到 `store.json.corrupt-<时间戳>`，再把主文件重建为空对象继续，界面顶部提示备份路径
  - 单个键的值损坏时（例如内部 JSON 坏），渲染层解析失败会调 `store:quarantine`：主进程把该键原文备份到 `store.json.corrupt-隔离-<键名>-<时间戳>`，再从磁盘摘掉该键；界面顶部提示"已丢弃损坏项（原文已备份保留）"，该项按默认值显示且不做播种；用户改动该项写回合法值即完成修复，原文始终可从备份找回
  - 浏览器预览（`npm run dev` / 直接开 `dist/index.html`）回退到 `localStorage`，数据不会跨会话保存，界面会红底提示
- **键名**
  - 任务：`nexus.tasks.v1`（含 `completedAt`）
  - 专注会话：`nexus.focus.v1`；进行中的计时：`nexus.focus.active.v1`
  - 通知：`nexus.notifications.v1`；系统通知开关：`nexus.notify.system.v1`
  - 周报草稿：`nexus.weekly-report.v1.<周一日期>`（按周隔离）
  - 主题：`nexus-theme`
  - 卡片背景：`nexus-card-bgs.v1`
- **未来（P1）**：换 SQLite。数据层已抽象为 `TaskRepository` / `FocusRepository` / `NotificationRepository` 接口，
  只需在 `createXxxRepository()` 里替换实现，业务组件零改动。

## 五、目录结构

```
app/
├── electron/
│   ├── main.cjs          # 主进程：窗口、托盘、IPC（含 Jira/SVN/天气/通知/周报 handlers）
│   ├── jira.cjs          # Jira API 服务：配置存储/鉴权/搜索/端点回退
│   ├── svn.cjs           # SVN 服务：REPORT 协议取 log/XML 解析/多仓库分组
│   ├── weather.cjs       # 天气服务：wttr.in + Open-Meteo、城市搜索、天气码映射、配置存储
│   ├── store.cjs         # 本地数据存储：可写目录探测、原子写、损坏备份
│   ├── userData.cjs      # userData 目录定位（Electron 内/外通用）
│   └── preload.cjs       # 预加载：安全暴露 API
├── scripts/
│   ├── electron.cjs      # 启动 Electron（透传 --no-sandbox）
│   ├── needs-build.cjs   # 判断 dist 是否过期（退出码 0/10/20）
│   └── fix-dist-module.cjs # 构建后把 module script 降级为 defer，兼容 file://
├── src/
│   ├── App.tsx           # 主界面（13 张卡片 + Jira/SVN/天气模块）
│   ├── components/       # Card / Icons / JiraBoard / JiraConfigModal / SvnCard / SvnConfigModal / WeatherConfigModal / FocusPanel / NotificationPanel / WeeklyReportPanel
│   ├── data/             # repository.ts（任务/专注）/ notifications.ts + notificationRepository.ts（通知）/ weeklyReport.ts（周报聚合+Markdown）
│   ├── hooks/            # useTheme / useCardBackgrounds / useJira / useSvn / useWeather / useFocus / useNotifications / useWeeklyReport
│   ├── styles.css        # 界面样式（从原型提取）
│   └── extra.css         # Electron 桌面端补充样式
├── public/assets/        # 风景插画（构建时复制进 dist）
├── assets/icon.png       # 应用图标
└── package.json
```

## 六、下一步（P1）

1. ~~天气接实时 API（免 Key）~~ ✅ 已完成（wttr.in + Open-Meteo）
2. ~~常用网站接 `open:external` 打开系统浏览器~~ ✅ 已完成
3. ~~专注计时器（番茄钟）~~ ✅ 已完成
4. ~~本周任务完成分布接真实数据~~ ✅ 已完成
5. 任务/专注仓储换 SQLite（electron IPC + better-sqlite3）
6. 学习/健康数据接入（iOS HealthKit → 伴侣 App → 云端同步）；今日学习/热量/收支/健康步数目前仍为静态数据
7. 进程占用读取（原生模块，需额外编译）
8. Jira 增强：缓存与离线回退、可配置 JQL、单 issue 快捷操作
9. SVN 增强：分组折叠/排序、提交搜索、查看 diff、提交频率统计图表
10. ~~通知中心（专注结束提醒、Jira/SVN 变更提醒）~~ ✅ 已完成（含系统桌面通知）
11. ~~周报生成（本周工作 + 下周计划，按项目分组）~~ ✅ 已完成（仅工作内容 + 可编辑 + 一键复制）

## 七、已知限制

- 已接真实数据：天气（wttr.in + Open-Meteo）、Jira、SVN、专注时长、本周任务完成分布、通知（专注/Jira/SVN 事件）、周报；仍为静态数据：健康步数/心率/睡眠、今日学习时长、热量、收支、进程占用、今日日程，待后续接真实数据源
- Jira / SVN 变更提醒依赖 5 分钟轮询，未配置数据源时不会产生通知；系统桌面通知是否可弹出取决于操作系统权限设置
- 周报内容首次生成后以手动草稿为准，数据源刷新不会自动覆盖，需点「重新聚合」；Jira 本周完成按 `resolutiondate` 统计，若团队使用非标准工作流（完成态不写 resolutiondate）可能漏统计
- Jira 查询当前固定为「分配给我」，筛选条件暂不可在界面自定义（代码里可改）
- `http(s)://` 仓库需服务端开启 DAV `REPORT`（标准 SVN over HTTP 均支持）；`svn://` 仓库需本机安装 svn 命令行，启动脚本会自动探测 `SVN_BIN` 或 PATH 中的 svn
- 无边框窗口在 Linux 下拖拽行为可能与 Windows 略有差异
- 打包需图标 `.ico`（Windows）/ `.icns`（macOS），当前用 PNG 占位
