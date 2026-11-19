# 黑白极简页面模板

一个空白页骨架：页头 + 主题切换 + 内容区，纯 HTML / CSS / JS，零依赖、零构建，双击 `index.html` 即可打开。

> 交给开发智能体时：把本文件夹给它即可，智能体会读取 [AGENTS.md](AGENTS.md) 按规范开发（主题切换保持不变、标题替换为系统名称、副标题写系统说明、其余自行排版）。

## 包含什么

| 文件 | 内容 |
| --- | --- |
| `index.html` | 页头（标题 / 说明 / 主题按钮）+ 空白内容区 `.content` |
| `style.css` | 设计变量（明 / 灰 / 暗）+ 基础排版样式 |
| `app.js` | 主题切换（三态循环，图标随主题变化） |

## 特性

- **三种主题**：明（白底黑字）/ 灰（`#3a3f47`）/ 暗（`#0b0b0b`）
  - 右上角图标按钮循环切换，图标随主题变化（☀ / ◐ / ☾）
  - 选择存 localStorage；支持 `?theme=light|gray|dark` 直接指定
- **纯黑白配色**：所有颜色都来自 5 个 CSS 变量
  `--bg / --fg / --muted / --line / --hover`，改变量即可换配色
- **基础排版已备好**：标题、段落、链接、列表、代码块、表格、分割线
- **响应式**：窄屏自动收紧边距
- **零依赖**：没有框架、没有 CDN、没有网络请求，`file://` 直接可用

## 怎么用

1. 把 `index.html`、`style.css`、`app.js` 复制到你的项目
2. 改 `<h1>` 和 `<p class="sub">` 为你的标题 / 说明
3. 在 `<div class="content">` 里写页面内容（模板里已备好 `h2 / h3 / p / a / ul / ol / code / pre / table / hr` 的样式）
4. 需要额外组件时自己加 HTML + CSS，颜色统一用变量

## 自定义配色

改 `style.css` 顶部三个变量块：

```css
:root { --bg:#fff; --fg:#111; --muted:#8a8a8a; --line:#e8e8e8; --hover:#f6f6f6; }
[data-theme="gray"] { --bg:#3a3f47; --fg:#f2f3f5; --muted:#b3b9c2; --line:#4b525c; --hover:#454c56; }
[data-theme="dark"] { --bg:#0b0b0b; --fg:#f0f0f0; --muted:#7f7f7f; --line:#222; --hover:#151515; }
```

> 带「服务列表 / 状态圆点 / 服务器状态卡」的完整页面实现在主项目 `static/` 里，线上见 <https://wkeeli.cn/lst/>。
