/* ============================================================
   黑白极简页面模板 · 交互脚本
   ------------------------------------------------------------
   1) 主题：明 / 灰 / 暗，图标按钮循环切换，localStorage 记忆，支持 ?theme=
   2) 列表：把 DEMO.groups 渲染成分组列表
   接入真实数据时：把最后的 render(DEMO) 换成
     fetch("/api/xxx").then(r => r.json()).then(render)
   数据结构见 DEMO 注释。
   ============================================================ */
(function () {
  "use strict";

  var root = document.documentElement;
  var themeBtn = document.getElementById("theme");
  var listEl = document.getElementById("list");
  var summaryEl = document.getElementById("summary");
  var checkedEl = document.getElementById("checked");

  /* ---------- 主题（明 / 灰 / 暗） ---------- */

  var THEMES = ["light", "gray", "dark"];
  var THEME_LABEL = { light: "明", gray: "灰", dark: "暗" };

  var THEME_ICON = {
    light:
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">' +
      '<circle cx="8" cy="8" r="3"/>' +
      '<path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3.2 3.2l1.1 1.1M11.7 11.7l1.1 1.1M12.8 3.2l-1.1 1.1M4.3 11.7l-1.1 1.1"/>' +
      "</svg>",
    gray:
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">' +
      '<circle cx="8" cy="8" r="5.7"/>' +
      '<path d="M8 2.3a5.7 5.7 0 0 1 0 11.4z" fill="currentColor" stroke="none"/>' +
      "</svg>",
    dark:
      '<svg viewBox="0 0 16 16" fill="currentColor">' +
      '<path d="M14 8.53A6 6 0 1 1 7.47 2 4.67 4.67 0 0 0 14 8.53z"/>' +
      "</svg>"
  };

  function applyTheme(theme) {
    root.dataset.theme = theme;
    themeBtn.innerHTML = THEME_ICON[theme];
    var label = "当前主题：" + THEME_LABEL[theme] + "，点击切换";
    themeBtn.setAttribute("aria-label", label);
    themeBtn.title = label;
  }

  function isTheme(value) {
    return THEMES.indexOf(value) !== -1;
  }

  function initialTheme() {
    var param = new URLSearchParams(location.search).get("theme");
    if (isTheme(param)) return param;
    var saved = localStorage.getItem("demo-theme");
    if (isTheme(saved)) return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  applyTheme(initialTheme());

  themeBtn.addEventListener("click", function () {
    var current = root.dataset.theme;
    var next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
    localStorage.setItem("demo-theme", next);
    applyTheme(next);
  });

  /* ---------- 演示数据（接入接口时替换成真实数据） ----------
     groups[].services[] 字段：
       name        服务名（必填）
       description 一句话说明
       url         链接（必填）
       state       online | auth | down | unknown
       code        可选，异常时显示的 HTTP 状态码
       latency_ms  可选，悬停显示的耗时
  ------------------------------------------------------------ */

  var DEMO = {
    updated_at: "2026-01-01T12:00:00+08:00",
    groups: [
      {
        label: "应用",
        services: [
          {
            name: "示例服务 A",
            description: "一句话说明这个服务是做什么的",
            url: "https://example.com/a",
            state: "online"
          },
          {
            name: "示例服务 B",
            description: "需要登录才能使用的服务",
            url: "https://example.com/b",
            state: "auth"
          },
          {
            name: "示例服务 C",
            description: "服务异常时会显示 HTTP 状态码",
            url: "https://example.com/c",
            state: "down",
            code: 502
          }
        ]
      },
      {
        label: "接口",
        services: [
          {
            name: "示例 API",
            description: "供程序调用的接口，可直接链接",
            url: "https://api.example.com/",
            state: "online"
          }
        ]
      }
    ]
  };

  /* ---------- 小工具 ---------- */

  var STATE_LABEL = { online: "在线", auth: "需登录", down: "异常", unknown: "未知" };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function formatTime(iso) {
    if (!iso) return "—";
    return iso.replace("T", " ").replace(/([+-]\d{2}:\d{2})$/, " ($1)");
  }

  /* ---------- 渲染 ---------- */

  function buildRow(svc) {
    var a = el("a", "row");
    a.href = svc.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";

    var main = el("span", "main");
    main.appendChild(el("span", "name", svc.name));
    main.appendChild(el("span", "desc", svc.description || ""));
    main.appendChild(el("span", "url", svc.url.replace(/^https?:\/\//, "")));

    var status = el("span", "status " + (svc.state || "unknown"));
    if (svc.latency_ms) status.title = svc.latency_ms + " ms";
    status.appendChild(el("span", "dot"));
    var label = STATE_LABEL[svc.state] || svc.state;
    if (svc.state === "down" && svc.code) label = "异常 " + svc.code;
    status.appendChild(el("span", "state", label));

    a.appendChild(main);
    a.appendChild(status);

    var li = el("li");
    li.appendChild(a);
    return li;
  }

  function render(data) {
    var frag = document.createDocumentFragment();
    var total = 0;
    var counts = { online: 0, auth: 0, down: 0 };

    (data.groups || []).forEach(function (group) {
      var section = document.createElement("section");
      section.appendChild(el("h2", "", group.label));

      var ul = el("ul", "rows");
      group.services.forEach(function (svc) {
        ul.appendChild(buildRow(svc));
        total += 1;
        if (counts[svc.state] !== undefined) counts[svc.state] += 1;
      });
      section.appendChild(ul);
      frag.appendChild(section);
    });

    listEl.replaceChildren(frag);

    var summary = total + " 项 · " + counts.online + " 在线";
    if (counts.auth) summary += " · " + counts.auth + " 需登录";
    if (counts.down) summary += " · " + counts.down + " 异常";
    summaryEl.textContent = summary;
    checkedEl.textContent = "上次检测 " + formatTime(data.updated_at) + " · 模板演示数据";
  }

  render(DEMO);
})();
