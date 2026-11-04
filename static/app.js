(function () {
  "use strict";

  var root = document.documentElement;
  var themeBtn = document.getElementById("theme");
  var listEl = document.getElementById("list");
  var summaryEl = document.getElementById("summary");
  var checkedEl = document.getElementById("checked");

  var STATE_LABEL = { online: "在线", auth: "需登录", down: "异常", unknown: "未知" };

  /* ---------- 明暗主题 ---------- */

  function applyTheme(theme) {
    root.dataset.theme = theme;
    themeBtn.textContent = theme === "dark" ? "亮色" : "暗色";
    themeBtn.setAttribute("aria-label", theme === "dark" ? "切换到亮色主题" : "切换到暗色主题");
  }

  function initialTheme() {
    var param = new URLSearchParams(location.search).get("theme");
    if (param === "light" || param === "dark") return param;
    var saved = localStorage.getItem("wkeeli-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  applyTheme(initialTheme());

  themeBtn.addEventListener("click", function () {
    var next = root.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("wkeeli-theme", next);
    applyTheme(next);
  });

  /* ---------- 渲染 ---------- */

  function formatTime(iso) {
    if (!iso) return "—";
    return iso.replace("T", " ").replace(/([+-]\d{2}:\d{2})$/, " ($1)");
  }

  function buildRow(svc) {
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.className = "row";
    a.href = svc.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";

    var main = document.createElement("span");
    main.className = "main";

    var name = document.createElement("span");
    name.className = "name";
    name.textContent = svc.name;

    var desc = document.createElement("span");
    desc.className = "desc";
    desc.textContent = svc.description;

    var url = document.createElement("span");
    url.className = "url";
    url.textContent = svc.url.replace(/^https?:\/\//, "");

    main.appendChild(name);
    main.appendChild(desc);
    main.appendChild(url);

    var status = document.createElement("span");
    status.className = "status " + svc.state;
    if (svc.latency_ms !== null && svc.latency_ms !== undefined) {
      status.title = svc.latency_ms + " ms";
    }

    var dot = document.createElement("span");
    dot.className = "dot";
    dot.setAttribute("aria-hidden", "true");

    var label = document.createElement("span");
    label.className = "state";
    label.textContent = STATE_LABEL[svc.state] || svc.state;
    if (svc.state === "down" && svc.code) {
      label.textContent = "异常 " + svc.code;
    }

    status.appendChild(dot);
    status.appendChild(label);

    a.appendChild(main);
    a.appendChild(status);
    li.appendChild(a);
    return li;
  }

  function render(data) {
    var frag = document.createDocumentFragment();
    var total = 0;

    data.groups.forEach(function (group) {
      var section = document.createElement("section");
      var heading = document.createElement("h2");
      heading.textContent = group.label;
      section.appendChild(heading);

      var ul = document.createElement("ul");
      ul.className = "rows";
      group.services.forEach(function (svc) {
        ul.appendChild(buildRow(svc));
        total += 1;
      });
      section.appendChild(ul);
      frag.appendChild(section);
    });

    listEl.replaceChildren(frag);
    var summary = total + " 项 · " + data.counts.online + " 在线";
    if (data.counts.auth) summary += " · " + data.counts.auth + " 需登录";
    if (data.counts.down) summary += " · " + data.counts.down + " 异常";
    summaryEl.textContent = summary;
    checkedEl.textContent = "上次检测 " + formatTime(data.updated_at) + " · 每 60 秒自动刷新";
  }

  /* ---------- 数据 ---------- */

  function load() {
    fetch("api/services", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(render)
      .catch(function () {
        summaryEl.textContent = "状态获取失败";
      });
  }

  load();
  setInterval(load, 60000);
})();
