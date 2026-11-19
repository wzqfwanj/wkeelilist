/* ============================================================
   黑白极简页面模板 · 主题脚本
   ------------------------------------------------------------
   明 / 灰 / 暗三套主题：
   - 右上角图标按钮循环切换（☀ / ◐ / ☾），图标随当前主题变化
   - 选择存 localStorage（键名 template-theme）
   - 支持 ?theme=light|gray|dark 直接指定
   ============================================================ */
(function () {
  "use strict";

  var root = document.documentElement;
  var themeBtn = document.getElementById("theme");

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
    var saved = localStorage.getItem("template-theme");
    if (isTheme(saved)) return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  applyTheme(initialTheme());

  themeBtn.addEventListener("click", function () {
    var current = root.dataset.theme;
    var next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
    localStorage.setItem("template-theme", next);
    applyTheme(next);
  });
})();
