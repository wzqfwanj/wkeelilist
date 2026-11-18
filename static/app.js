(function () {
  "use strict";

  var root = document.documentElement;
  var themeBtn = document.getElementById("theme");
  var listEl = document.getElementById("list");
  var summaryEl = document.getElementById("summary");
  var checkedEl = document.getElementById("checked");

  var STATE_LABEL = { online: "在线", auth: "需登录", down: "异常", unknown: "未知" };

  /* ---------- 主题（明 / 灰 / 暗） ---------- */

  var THEMES = ["light", "gray", "dark"];
  var THEME_LABEL = { light: "明", gray: "灰", dark: "暗" };

  function applyTheme(theme) {
    root.dataset.theme = theme;
    themeBtn.textContent = "主题 · " + THEME_LABEL[theme];
    themeBtn.setAttribute("aria-label", "当前主题：" + THEME_LABEL[theme] + "，点击切换");
  }

  function isTheme(value) {
    return THEMES.indexOf(value) !== -1;
  }

  function initialTheme() {
    var param = new URLSearchParams(location.search).get("theme");
    if (isTheme(param)) return param;
    var saved = localStorage.getItem("wkeeli-theme");
    if (isTheme(saved)) return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  applyTheme(initialTheme());

  themeBtn.addEventListener("click", function () {
    var current = root.dataset.theme;
    var next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
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
    var counts = { online: 0, auth: 0, down: 0 };

    data.groups.forEach(function (group) {
      var section = document.createElement("section");
      var heading = document.createElement("h2");
      heading.textContent = group.label;
      section.appendChild(heading);

      var ul = document.createElement("ul");
      ul.className = "rows";
      group.services.forEach(function (svc) {
        if (svc.hidden) return; // 保留在 API 中供 JobDeck 取数，但不在本页显示
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

  /* ---------- 服务器指标 ---------- */

  var hostEl = document.getElementById("host-list");

  function gb(bytes) {
    if (bytes === null || bytes === undefined) return "";
    var value = bytes / 1073741824;
    return (value >= 10 ? value.toFixed(0) : value.toFixed(1)) + " GB";
  }

  function hostMetric(name, percent, sub) {
    var wrap = document.createElement("div");
    wrap.className = "metric";

    var row = document.createElement("div");
    row.className = "metric-row";
    var label = document.createElement("span");
    label.textContent = name;
    var value = document.createElement("b");
    value.textContent = percent === null || percent === undefined ? "—" : Math.round(percent) + "%";
    row.appendChild(label);
    row.appendChild(value);

    var bar = document.createElement("div");
    bar.className = "bar";
    var fill = document.createElement("i");
    fill.style.width = (percent || 0) + "%";
    bar.appendChild(fill);

    wrap.appendChild(row);
    wrap.appendChild(bar);
    if (sub) {
      var subEl = document.createElement("div");
      subEl.className = "metric-sub";
      subEl.textContent = sub;
      wrap.appendChild(subEl);
    }
    return wrap;
  }

  function renderHosts(data) {
    hostEl.replaceChildren();
    (data.hosts || []).forEach(function (host) {
      var card = document.createElement("div");
      card.className = "host-card";

      var head = document.createElement("div");
      head.className = "host-head";
      var name = document.createElement("span");
      name.className = "host-name";
      name.textContent = host.label;
      var addr = document.createElement("span");
      addr.className = "host-addr";
      addr.textContent = host.addr || "";
      head.appendChild(name);
      head.appendChild(addr);
      card.appendChild(head);

      var cpu = host.online ? host.cpu_percent : null;
      var mem = host.online ? host.mem_percent : null;
      card.appendChild(hostMetric("CPU", cpu, null));

      var memSub = host.online && host.mem_total ? gb(host.mem_used) + " / " + gb(host.mem_total) : null;
      card.appendChild(hostMetric("内存", mem, memSub));

      if (!host.online) {
        var off = document.createElement("div");
        off.className = "host-off";
        off.textContent = "采集失败";
        card.appendChild(off);
      }
      hostEl.appendChild(card);
    });
  }

  function loadHosts() {
    fetch("api/host", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(renderHosts)
      .catch(function () {
        hostEl.textContent = "服务器指标获取失败";
      });
  }

  loadHosts();
  setInterval(loadHosts, 60000);
})();
