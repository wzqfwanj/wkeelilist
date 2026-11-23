<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";

const emit = defineEmits(["summary", "checked"]);

const groups = ref([]);
const updatedAt = ref(null);
const failed = ref(false);
const order = ref([]);
const draggingId = ref(null);

const STATE_LABEL = { online: "在线", auth: "需登录", down: "异常", unknown: "未知" };
const REFRESH_MS = 60000;
let timer = null;

let dragging = false;
let suppressClick = false;
let pending = null;
let touchBound = false;

// 统一为一个「服务」列表：扁平分组的服务，按用户拖拽保存的顺序排列
const allServices = computed(() => {
  const items = groups.value.flatMap((group) => group.services.filter((svc) => !svc.hidden));
  const rank = new Map(order.value.map((id, index) => [id, index]));
  return items.slice().sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id) : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(b.id) ? rank.get(b.id) : Number.MAX_SAFE_INTEGER;
    return ra - rb;
  });
});

const total = computed(() => allServices.value.length);

const counts = computed(() => {
  const result = { online: 0, auth: 0, down: 0 };
  allServices.value.forEach((svc) => {
    if (result[svc.state] !== undefined) result[svc.state] += 1;
  });
  return result;
});

function stateLabel(svc) {
  if (svc.state === "down" && svc.code) return "异常 " + svc.code;
  return STATE_LABEL[svc.state] || svc.state;
}

function prettyUrl(url) {
  return url.replace(/^https?:\/\//, "");
}

function formatTime(iso) {
  if (!iso) return "—";
  return iso.replace("T", " ").replace(/([+-]\d{2}:\d{2})$/, " ($1)");
}

function updateSummary() {
  let summary = total.value + " 项 · " + counts.value.online + " 在线";
  if (counts.value.auth) summary += " · " + counts.value.auth + " 需登录";
  if (counts.value.down) summary += " · " + counts.value.down + " 异常";
  emit("summary", summary);
}

/* ---------- 拖拽排序（无手柄，直接拖行；手机长按后拖） ---------- */

function beginDrag(id) {
  dragging = true;
  draggingId.value = id;
  document.body.style.userSelect = "none";
}

function moveDrag(clientY) {
  if (!dragging || !draggingId.value) return;
  const rows = Array.from(document.querySelectorAll(".list .row-item")).filter(
    (el) => el.dataset.serviceId !== draggingId.value
  );
  let target = rows.length;
  for (let i = 0; i < rows.length; i += 1) {
    const rect = rows[i].getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      target = i;
      break;
    }
  }

  const next = order.value.slice();
  allServices.value.forEach((svc) => {
    if (!next.includes(svc.id)) next.push(svc.id);
  });
  const from = next.indexOf(draggingId.value);
  if (from === -1) return;
  next.splice(from, 1);
  next.splice(target, 0, draggingId.value);
  order.value = next;
}

function endDrag() {
  if (!dragging) return;
  dragging = false;
  draggingId.value = null;
  document.body.style.userSelect = "";
  saveOrder();
}

let suppressTimer = null;

function setSuppressClick() {
  suppressClick = true;
  if (suppressTimer) clearTimeout(suppressTimer);
  suppressTimer = setTimeout(() => {
    suppressClick = false;
  }, 400);
}

function onRowClick(event) {
  if (suppressClick) {
    event.preventDefault();
    event.stopPropagation();
    suppressClick = false;
  }
}

/* 鼠标 / 触控笔 */

function onRowPointerDown(event, svc) {
  if (event.pointerType === "touch") return; // 触摸走 touch 事件
  if (event.button !== 0) return;
  pending = { id: svc.id, x: event.clientX, y: event.clientY };
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp, { once: true });
  window.addEventListener("pointercancel", onPointerUp, { once: true });
}

function onPointerMove(event) {
  if (!pending) return;
  if (!dragging) {
    if (Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > 8) {
      beginDrag(pending.id);
    }
    return;
  }
  event.preventDefault();
  moveDrag(event.clientY);
}

function onPointerUp() {
  window.removeEventListener("pointermove", onPointerMove);
  if (dragging) {
    setSuppressClick();
    endDrag();
  }
  pending = null;
}

/* 触摸：长按 350ms 进入拖拽，短滑仍然滚动页面 */

function bindTouch() {
  if (touchBound) return;
  document.addEventListener("touchmove", onTouchMove, { passive: false });
  document.addEventListener("touchend", onTouchEnd);
  document.addEventListener("touchcancel", onTouchEnd);
  touchBound = true;
}

function unbindTouch() {
  if (!touchBound) return;
  document.removeEventListener("touchmove", onTouchMove);
  document.removeEventListener("touchend", onTouchEnd);
  document.removeEventListener("touchcancel", onTouchEnd);
  touchBound = false;
}

function onRowTouchStart(event, svc) {
  if (event.touches.length !== 1) return;
  const touch = event.touches[0];
  pending = {
    id: svc.id,
    x: touch.clientX,
    y: touch.clientY,
    timer: setTimeout(() => {
      if (pending) beginDrag(pending.id);
    }, 350),
  };
  bindTouch();
}

function onTouchMove(event) {
  if (!pending || !event.touches.length) return;
  const touch = event.touches[0];
  if (!dragging) {
    if (Math.hypot(touch.clientX - pending.x, touch.clientY - pending.y) > 10) {
      cancelTouch();
    }
    return;
  }
  event.preventDefault();
  moveDrag(touch.clientY);
}

function onTouchEnd() {
  const wasDragging = dragging;
  cancelTouch();
  if (wasDragging) {
    setSuppressClick();
    endDrag();
  }
}

function cancelTouch() {
  if (pending && pending.timer) clearTimeout(pending.timer);
  pending = null;
  unbindTouch();
}

/* ---------- 数据 ---------- */

async function saveOrder() {
  try {
    await fetch("api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: allServices.value.map((svc) => svc.id) }),
    });
  } catch {
    // 保存失败时保持本地顺序，下个刷新周期会回到已保存顺序
  }
}

async function load() {
  try {
    const res = await fetch("api/services", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    groups.value = data.groups || [];
    // 拖拽过程中不要被 60 秒刷新覆盖本地顺序
    if (!dragging && Array.isArray(data.order)) order.value = data.order;
    updatedAt.value = data.updated_at;
    failed.value = false;
    updateSummary();
    emit("checked", "上次检测 " + formatTime(updatedAt.value) + " · 每 60 秒自动刷新");
  } catch {
    failed.value = true;
    emit("summary", "状态获取失败");
  }
}

onMounted(() => {
  load();
  timer = setInterval(load, REFRESH_MS);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
  window.removeEventListener("pointermove", onPointerMove);
  unbindTouch();
});
</script>

<template>
  <div class="list">
    <p v-if="failed" class="hint">状态获取失败</p>
    <section>
      <h2 class="group-title">服务</h2>
      <ul class="rows">
        <li
          v-for="svc in allServices"
          :key="svc.id"
          class="row-item"
          :data-service-id="svc.id"
          :class="{ 'is-dragging': draggingId === svc.id }"
        >
          <a
            class="row"
            :href="svc.url"
            draggable="false"
            @click="onRowClick"
            @dragstart.prevent
            @pointerdown="onRowPointerDown($event, svc)"
            @touchstart="onRowTouchStart($event, svc)"
          >
            <span class="main">
              <span class="name">{{ svc.name }}</span>
              <span class="desc">{{ svc.description }}</span>
              <span class="url">{{ prettyUrl(svc.url) }}</span>
            </span>
            <span class="status" :class="svc.state">
              <span class="dot" aria-hidden="true"></span>
              <span class="state">{{ stateLabel(svc) }}</span>
            </span>
          </a>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.group-title {
  margin: 36px 0 10px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.list section:first-child .group-title {
  margin-top: 0;
}

.rows {
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--line);
  list-style: none;
}

.row-item {
  position: relative;
  margin: 0;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 14px 8px;
  border-bottom: 1px solid var(--line);
  color: inherit;
  text-decoration: none;
}

.row:hover {
  background: var(--hover);
}

.row-item.is-dragging .row {
  background: var(--hover);
  outline: 1px dashed var(--muted);
  outline-offset: -1px;
}

.main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.name {
  font-size: 15px;
  font-weight: 600;
}

.desc {
  overflow: hidden;
  color: var(--muted);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.url {
  overflow: hidden;
  color: var(--muted);
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status {
  display: flex;
  flex: none;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}

.dot {
  width: 7px;
  height: 7px;
  border: 1px solid var(--fg);
  border-radius: 50%;
}

.status.online .dot {
  background: var(--fg);
}

.status.auth .dot {
  background: linear-gradient(90deg, var(--fg) 50%, transparent 50%);
}

.status.down .dot {
  border-color: var(--muted);
  background: transparent;
}

.status.online .state {
  color: var(--fg);
}

.status.down .state {
  color: var(--muted);
}

.hint {
  color: var(--muted);
  font-size: 13px;
}

@media (max-width: 560px) {
  .row {
    gap: 12px;
  }

  .url {
    display: none;
  }
}
</style>
