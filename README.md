# wkeelilist · wkeeli 在线服务列表

列出服务器（阿里云 8.133.209.25 + 百度云 dev 机 180.76.180.249）上运行的全部公网服务，并显示实时在线状态。

- 访问地址：<https://wkeeli.cn/lst/>
- 技术栈：Python 3 + Flask（后端）· Vue 3 + Vite（前端，`frontend/`，无第三方 UI 库）
- 风格：极简、灰色单主题（遵循 `开发约束/前端约束_前端` 的 Vue 版规范）

## 功能

- 所有服务统一归在「服务」下展示，点击在当前页跳转（Ctrl / ⌘ + 点击可开新标签）
- 后端每 60 秒探测一次各服务，前端显示圆点状态
  - ● 在线：HTTP 2xx / 3xx
  - ◐ 需登录：HTTP 401 / 403，或已知需登录的服务返回登录页
  - ○ 异常：HTTP 5xx 或连接失败（附带状态码）
- 固定灰色单主题（背景 `#3a3f47` / 正文 `#f2f3f5`），无主题切换按钮、不读写 localStorage、不处理 `?theme=`
- 右侧实时显示两台服务器（阿里云 / dev）的 CPU 利用率与内存占用（后端每 10 秒采样）

## 访问控制

- **整站统一 Basic Auth**：`wkeeli.cn` 站点级一道账号密码（用户名 `wkeeli`，密码只在服务器端配置，bcrypt 哈希不入库）。浏览器访问任意页面输入一次，同域所有子页面自动带凭据，不再逐个弹窗。
- 原先 `/jd/`、`/record/`、`/job/`、`/paotui/` 各自的 Basic Auth 弹窗已移除，改由站点级统一入口接管。
- **例外**：`/pc2mb/` 跳过全站认证，直接进入应用自带的账号密码登录页（避免同一服务登录两次）。
- **改配置注意**：服务器上可能同时有其他会话/脚本在改 Caddyfile，替换凭据后务必再确认一次文件内容并 `caddy reload`，避免被旧快照覆盖。
- **服务器本机请求免认证**：Caddy 用 `@not_local`（`not remote_ip 127.0.0.1 ::1 <服务器公网 IP> 10.0.0.0/8 172.16.0.0/12`）让本机发起的请求跳过认证，保证 `/lst/api/services` 的状态探测和 JobDeck 取数正常；外部访问仍需登录。
- **应用内登录保留**：supersys、Schedul、计划、Supercut、pc2mb、vtodo 各自的登录页，以及 Architecture / 面试复盘的应用内 Basic Auth，会在站点登录后继续要求应用登录（个人数据敏感服务不放开）。
- **子域名**：`dsh.wkeeli.cn`、`attu.wkeeli.cn`、`redis.wkeeli.cn` 仍各自独立认证。
- 配置备份：服务器 `/etc/caddy/Caddyfile.bak-siteauth-*`；可复用片段见 [`deploy/Caddyfile.site-auth.snippet`](deploy/Caddyfile.site-auth.snippet)。

## 项目结构

```
app.py                    Flask 应用：页面 + /api/services + /api/host + 后台状态探测/主机采样
services.json             服务清单（改这个文件即可增删服务）
frontend/                 Vue 3 + Vite 前端源码
  src/App.vue             页面根组件（页头 + 内容区 + 侧栏）
  src/components/         ServiceList.vue / HostPanel.vue
  src/style.css           灰色单主题设计变量与基础排版
  dist/                   构建产物（npm run build，git 忽略）
deploy/                   服务器部署文件（systemd 单元、Caddy 片段、同步脚本）
static/                   Flask 运行时静态目录（由 dist 部署而来，git 忽略）
template/                 旧版纯静态模板（历史产物）
```

## 本地运行

```bash
# 1) 后端（Flask，提供 /api/services 与 /api/host）
python -m venv .venv
.venv/Scripts/pip install flask          # macOS/Linux: .venv/bin/pip
.venv/Scripts/python app.py              # http://127.0.0.1:8330

# 2) 前端（Vue 开发模式，/api 已代理到 127.0.0.1:8330）
cd frontend
npm install
npm run dev                              # http://127.0.0.1:5173
```

生产构建：`cd frontend && npm run build`，产物在 `frontend/dist/`。

## 增删服务

编辑 `services.json` 中对应分组的 `services` 数组，字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 唯一标识，用于匹配探测结果 |
| `name` | 服务名 |
| `description` | 一句话说明 |
| `url` | 访问地址（点击跳转） |
| `auth` | 是否需要登录 |
| `probe_url` | 可选，探测地址；默认使用 `url` |
| `hidden` | 可选，`true` 时只在 `/api/services` 输出、不在列表页显示（供 JobDeck 等消费方使用） |

服务端每次请求都会重新读取该文件，修改后无需重启（探测则会在下个 60 秒周期生效）。

## 部署

### 1. 服务器初始化（一次性）

```bash
ssh aliyun
mkdir -p /opt/wkeelilist/static
python3 -m venv /opt/wkeelilist/.venv
/opt/wkeelilist/.venv/bin/pip install flask gunicorn
cp deploy/wkeelilist.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now wkeelilist
```

### 2. Caddy 路由

在 `/etc/caddy/Caddyfile` 的 `wkeeli.cn { ... }` 块内加入 `deploy/Caddyfile.snippet` 的内容，然后：

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

### 3. 发布更新

```bash
bash deploy/deploy.sh
```

脚本会自动 `npm run build` 构建 Vue 前端，再把 `frontend/dist/` 与后端文件同步到服务器。

## 状态判定说明

探测由服务器发起：401/403 说明服务本身可达（只是要登录），因此标记为「需登录」而不是「异常」；
`/pw/` 这类只接受特定路径的 API 根路径返回 404/400 同样视为「在线」。
