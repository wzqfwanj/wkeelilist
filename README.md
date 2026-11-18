# wkeelilist · wkeeli 在线服务列表

列出服务器（阿里云 8.133.209.25 + 百度云 dev 机 180.76.180.249）上运行的全部公网服务，并显示实时在线状态。

- 访问地址：<https://wkeeli.cn/lst/>
- 技术栈：Python 3 + Flask（后端）· 原生 HTML / CSS / JS（前端，无依赖）
- 风格：极简、纯黑白、支持明暗两种主题

## 功能

- 按「应用 / 游戏 / 管理台 / 接口」分组展示服务，点击直达
- 后端每 60 秒探测一次各服务，前端显示圆点状态
  - ● 在线：HTTP 2xx / 3xx
  - ◐ 需登录：HTTP 401 / 403，或已知需登录的服务返回登录页
  - ○ 异常：HTTP 5xx 或连接失败（附带状态码）
- 明暗主题切换，选择保存在浏览器 localStorage，默认跟随系统

## 访问控制

- **整站统一 Basic Auth**：`wkeeli.cn` 站点级一道账号密码（用户名 `wkeeli`，复用原 `/job/` 的凭据）。浏览器访问任意页面输入一次，同域所有子页面自动带凭据，不再逐个弹窗。
- 原先 `/jd/`、`/record/`、`/job/`、`/paotui/` 各自的 Basic Auth 弹窗已移除，改由站点级统一入口接管。
- **服务器本机请求免认证**：Caddy 用 `@not_local`（`not remote_ip 127.0.0.1 ::1 <服务器公网 IP> 10.0.0.0/8 172.16.0.0/12`）让本机发起的请求跳过认证，保证 `/lst/api/services` 的状态探测和 JobDeck 取数正常；外部访问仍需登录。
- **应用内登录保留**：supersys、Schedul、计划、Supercut、pc2mb、vtodo 各自的登录页，以及 Architecture / 面试复盘的应用内 Basic Auth，会在站点登录后继续要求应用登录（个人数据敏感服务不放开）。
- **子域名**：`dsh.wkeeli.cn`、`attu.wkeeli.cn`、`redis.wkeeli.cn` 仍各自独立认证。
- 配置备份：服务器 `/etc/caddy/Caddyfile.bak-siteauth-*`；可复用片段见 [`deploy/Caddyfile.site-auth.snippet`](deploy/Caddyfile.site-auth.snippet)。

## 项目结构

```
app.py                 Flask 应用：页面 + /api/services + 后台状态探测
services.json          服务清单（改这个文件即可增删服务）
static/index.html      单页列表
static/style.css       黑白极简样式
static/app.js          渲染 + 主题切换 + 每 60 秒刷新
deploy/                服务器部署文件（systemd 单元、Caddy 片段、同步脚本）
```

## 本地运行

```bash
python -m venv .venv
.venv/Scripts/pip install flask          # macOS/Linux: .venv/bin/pip
.venv/Scripts/python app.py
# 打开 http://127.0.0.1:8330/
```

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

## 状态判定说明

探测由服务器发起：401/403 说明服务本身可达（只是要登录），因此标记为「需登录」而不是「异常」；
`/pw/` 这类只接受特定路径的 API 根路径返回 404/400 同样视为「在线」。
