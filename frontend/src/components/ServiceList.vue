<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";

const emit = defineEmits(["summary", "checked"]);

const groups = ref([]);
const updatedAt = ref(null);
const failed = ref(false);

const STATE_LABEL = { online: "在线", auth: "需登录", down: "异常", unknown: "未知" };
const REFRESH_MS = 60000;
let timer = null;

const visibleGroups = computed(() =>
  groups.value
    .map((group) => ({
      id: group.id,
      label: group.label,
      services: group.services.filter((svc) => !svc.hidden),
    }))
    .filter((group) => group.services.length > 0)
);

const total = computed(() => visibleGroups.value.reduce((sum, group) => sum + group.services.length, 0));

const counts = computed(() => {
  const result = { online: 0, auth: 0, down: 0 };
  visibleGroups.value.forEach((group) =>
    group.services.forEach((svc) => {
      if (result[svc.state] !== undefined) result[svc.state] += 1;
    })
  );
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

async function load() {
  try {
    const res = await fetch("api/services", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    groups.value = data.groups || [];
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
});
</script>

<template>
  <div class="list">
    <p v-if="failed" class="hint">状态获取失败</p>
    <section v-for="group in visibleGroups" :key="group.id">
      <h2 class="group-title">{{ group.label }}</h2>
      <ul class="rows">
        <li v-for="svc in group.services" :key="svc.id" class="row-item">
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

.main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.name {
  color: var(--fg);
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
