<script setup>
import { onMounted, onUnmounted, ref } from "vue";

const hosts = ref([]);
const failed = ref(false);

const REFRESH_MS = 60000;
let timer = null;

function gb(bytes) {
  if (bytes === null || bytes === undefined) return "";
  const value = bytes / 1073741824;
  return (value >= 10 ? value.toFixed(0) : value.toFixed(1)) + " GB";
}

function percentText(percent) {
  return percent === null || percent === undefined ? "—" : Math.round(percent) + "%";
}

function barWidth(percent) {
  return (percent || 0) + "%";
}

async function load() {
  try {
    const res = await fetch("api/host", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    hosts.value = data.hosts || [];
    failed.value = false;
  } catch {
    failed.value = true;
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
  <aside class="host">
    <h2 class="host-title">服务器</h2>
    <p v-if="failed" class="host-off">服务器指标获取失败</p>

    <div v-for="(host, index) in hosts" :key="host.id" class="host-card" :style="{ '--i': index }">
      <div class="host-head">
        <span class="host-name">{{ host.label }}</span>
        <span class="host-addr">{{ host.addr }}</span>
      </div>

      <div class="metric">
        <div class="metric-row">
          <span>CPU</span>
          <b>{{ percentText(host.online ? host.cpu_percent : null) }}</b>
        </div>
        <div class="bar"><i :style="{ width: barWidth(host.online ? host.cpu_percent : null) }"></i></div>
      </div>

      <div class="metric">
        <div class="metric-row">
          <span>内存</span>
          <b>{{ percentText(host.online ? host.mem_percent : null) }}</b>
        </div>
        <div class="bar"><i :style="{ width: barWidth(host.online ? host.mem_percent : null) }"></i></div>
        <div v-if="host.online && host.mem_total" class="metric-sub">
          {{ gb(host.mem_used) }} / {{ gb(host.mem_total) }}
        </div>
      </div>

      <div v-if="!host.online" class="host-off">采集失败</div>
    </div>
  </aside>
</template>

<style scoped>
.host {
  position: sticky;
  top: 40px;
}

.host-title {
  margin: 0 0 12px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.host-card {
  padding: 14px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  margin-bottom: 12px;
  animation: card-in 0.5s ease both;
  animation-delay: calc(var(--i, 0) * 90ms);
  transition: border-color 0.2s ease;
}

.host-card:hover {
  border-color: var(--accent);
}

@keyframes card-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.host-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.host-name {
  font-size: 13px;
  font-weight: 600;
}

.host-addr {
  overflow: hidden;
  color: var(--muted);
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  font-size: 10.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric {
  margin-top: 14px;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: var(--muted);
  font-size: 12px;
}

.metric-row b {
  color: var(--fg);
  font-weight: 600;
}

.bar {
  overflow: hidden;
  height: 4px;
  margin-top: 6px;
  background: var(--line);
  border-radius: 2px;
}

.bar i {
  display: block;
  height: 100%;
  background: var(--accent);
  transition: width 0.6s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.metric-sub {
  margin-top: 3px;
  color: var(--muted);
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  font-size: 10.5px;
}

.host-off {
  margin-top: 10px;
  color: var(--muted);
  font-size: 11px;
}

@media (max-width: 760px) {
  .host {
    position: static;
    display: flex;
    flex-wrap: wrap;
    gap: 0 12px;
  }

  .host-title {
    width: 100%;
    margin: 24px 0 12px;
  }

  .host-card {
    flex: 1 1 160px;
    margin-bottom: 0;
  }
}
</style>
