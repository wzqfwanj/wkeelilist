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

/* ---------- 拖拽排序 ---------- */

function startDrag(event, svc) {
  if (event.button !== undefined && event.button !== 0) return;
  dragging = true;
  draggingId.value = svc.id;
  document.body.style.userSelect = "none";
  window.addEventListener("pointermove", onDragMove);
  window.addEventListener("pointerup", endDrag, { once: true });
  window.addEventListener("pointercancel", endDrag, { once: true });
}

function onDragMove(event) {
  if (!dragging || !draggingId.value) return;
  const rows = Array.from(document.querySelectorAll(".list .row-item")).filter(
    (el) => el.dataset.serviceId !== draggingId.value
  );
  let target = rows.length;
  for (let i = 0; i < rows.length; i += 1) {
    const rect = rows[i].getBoundingClientRect();
    if (event.clientY < rect.top + rect.height / 2) {
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
  window.removeEventListener("pointermove", onDragMove);
  saveOrder();
}

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

/* ---------- 数据 ---------- */

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
  window.removeEventListener("pointermove", onDragMove);
});
</script>

<template>
  <div class="list">
    <p v-if="failed" class="hint">状态获取失败</p>
    <section>
      <h2 class="group-title">服务</h2>
      <p class="order-hint">拖拽左侧手柄可调整顺序</p>
      <ul class="rows">
        <li
          v-for="svc in allServices"
          :key="svc.id"
          class="row-item"
          :data-service-id="svc.id"
          :class="{ 'is-dragging': draggingId === svc.id }"
        >
          <span class="drag-handle" title="拖拽排序" @pointerdown.stop.prevent="startDrag($event, svc)">
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <circle cx="6" cy="3.5" r="1.2" />
              <circle cx="10" cy="3.5" r="1.2" />
              <circle cx="6" cy="8" r="1.2" />
              <circle cx="10" cy="8" r="1.2" />
              <circle cx="6" cy="12.5" r="1.2" />
              <circle cx="10" cy="12.5" r="1.2" />
            </svg>
          </span>

          <a class="row" :href="svc.url">
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
  margin: 36px 0 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.list section:first-child .group-title {
  margin-top: 0;
}

.order-hint {
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 11px;
  opacity: 0.8;
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

.drag-handle {
  position: absolute;
  top: 50%;
  left: 7px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 30px;
  color: var(--muted);
  opacity: 0.45;
  cursor: grab;
  touch-action: none;
  transform: translateY(-50%);
  transition: opacity 0.15s ease, color 0.15s ease;
}

.drag-handle svg {
  display: block;
  width: 12px;
  height: 12px;
}

.row-item:hover .drag-handle {
  color: var(--fg);
  opacity: 1;
}

.drag-handle:active {
  cursor: grabbing;
}

.row-item.is-dragging .row {
  background: var(--hover);
  outline: 1px dashed var(--muted);
  outline-offset: -1px;
}

.row-item.is-dragging .drag-handle {
  color: var(--fg);
  opacity: 1;
  cursor: grabbing;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 14px 8px 14px 28px;
  border-bottom: 1px solid var(--line);
  color: inherit;
  text-decoration: none;
}

.row:hover {
  background: var(--hover);
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
    padding: 14px 8px 14px 26px;
  }

  .url {
    display: none;
  }
}
</style>
