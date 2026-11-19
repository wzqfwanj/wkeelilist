# 黑白极简页面模板

从 `wkeeli.cn/lst` 抽离出来的前端模板：一个「分组列表」页面，纯 HTML / CSS / JS，零依赖、零构建，双击 `index.html` 即可打开。

## 包含什么

| 文件 | 内容 |
| --- | --- |
| `index.html` | 页面骨架：页头（标题 / 说明 / 主题按钮）、列表容器、页脚 |
| `style.css` | 设计变量 + 全部组件样式（明 / 灰 / 暗三套配色） |
| `app.js` | 主题切换（含图标）+ 演示数据 + 列表渲染 |

## 特性

- **三种主题**：明（白底黑字）/ 灰（`#3a3f47`）/ 暗（`#0b0b0b`）
  - 右上角图标按钮循环切换，图标随主题变化（☀ / ◐ / ☾）
  - 选择存 localStorage；支持 `?theme=light|gray|dark` 直接指定
- **纯黑白配色**：所有颜色都来自 CSS 变量 `--bg / --fg / --muted / --line / --hover`
- **列表行**：名称 + 说明 + 链接 + 状态圆点（在线 / 需登录 / 异常）
- **响应式**：窄屏自动隐藏链接行、收紧间距
- **零依赖**：没有框架、没有 CDN、没有网络请求，`file://` 直接可用

## 怎么用

1. 把 `index.html`、`style.css`、`app.js` 复制到你的项目里
2. 改 `index.html` 里的标题和说明文字
3. 接入数据：把 `app.js` 末尾的 `render(DEMO);` 换成你的数据源，例如

```js
fetch("/api/services")
  .then(function (res) { return res.json(); })
  .then(render);
```

数据结构（`render` 的入参）：

```js
{
  updated_at: "2026-01-01T12:00:00+08:00",
  groups: [
    {
      label: "应用",
      services: [
        {
          name: "服务名",
          description: "一句话说明",
          url: "https://…",
          state: "online",   // online | auth | down | unknown
          code: 502,          // 可选，异常时显示
          latency_ms: 120     // 可选，悬停显示
        }
      ]
    }
  ]
}
```

## 自定义配色

改 `style.css` 顶部三个变量块即可：

```css
:root { --bg:#fff; --fg:#111; --muted:#8a8a8a; --line:#e8e8e8; --hover:#f6f6f6; }
[data-theme="gray"] { --bg:#3a3f47; --fg:#f2f3f5; --muted:#b3b9c2; --line:#4b525c; --hover:#454c56; }
[data-theme="dark"] { --bg:#0b0b0b; --fg:#f0f0f0; --muted:#7f7f7f; --line:#222; --hover:#151515; }
```

> 需要「右侧服务器状态卡」的版本，见主项目 `static/` 下的实现（`index.html` 的 `aside.host` + `app.js` 的 `renderHosts`），或直接看线上 <https://wkeeli.cn/lst/>。
