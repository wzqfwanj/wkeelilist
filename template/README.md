# 黑白极简页面模板

从 `wkeeli.cn/lst` 抽离出来的前端模板：一个「列表 + 右侧状态卡」的极简页面，纯 HTML / CSS / JS，零依赖、零构建，双击 `index.html` 即可打开。

## 包含什么

| 文件 | 内容 |
| --- | --- |
| `index.html` | 页面骨架：页头（标题 / 说明 / 主题按钮）、列表容器、右侧状态卡、页脚 |
| `style.css` | 设计变量 + 全部组件样式（明 / 灰 / 暗三套配色） |
| `app.js` | 主题切换（含图标）+ 演示数据 + 列表/状态卡渲染 |

## 特性

- **三种主题**：明（白底黑字）/ 灰（`#3a3f47`）/ 暗（`#0b0b0b`）
  - 右上角图标按钮循环切换，图标随主题变化（☀ / ◐ / ☾）
  - 选择存 localStorage；支持 `?theme=light|gray|dark` 直接指定
- **纯黑白配色**：所有颜色都来自 CSS 变量 `--bg / --fg / --muted / --line / --hover`
- **响应式**：宽屏左右两栏，窄屏（< 860px）自动单列
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
        { name: "服务名", description: "一句话说明", url: "https://…", state: "online" } // state: online | auth | down | unknown
      ]
    }
  ],
  hosts: [
    {
      label: "服务器一", addr: "192.0.2.10", online: true,
      cpu_percent: 23,            // 0-100，null 显示 —
      mem_percent: 48,
      mem_used: 858993459,       // 字节，可省略
      mem_total: 1717986918
    }
  ]
}
```

右侧状态卡不需要的话，删掉 `index.html` 里的 `<aside class="host">…</aside>` 和 `app.js` 里的 `renderHosts(...)` 调用即可；列表会自然占满整行（把 `.layout` 的 `grid-template-columns` 改成 `1fr`）。

## 自定义配色

改 `style.css` 顶部三个变量块即可：

```css
:root { --bg:#fff; --fg:#111; --muted:#8a8a8a; --line:#e8e8e8; --hover:#f6f6f6; }
[data-theme="gray"] { --bg:#3a3f47; --fg:#f2f3f5; --muted:#b3b9c2; --line:#4b525c; --hover:#454c56; }
[data-theme="dark"] { --bg:#0b0b0b; --fg:#f0f0f0; --muted:#7f7f7f; --line:#222; --hover:#151515; }
```
