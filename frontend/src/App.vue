<script setup>
import { ref } from "vue";
import ServiceList from "./components/ServiceList.vue";
import HostPanel from "./components/HostPanel.vue";

const summary = ref("加载中…");
const checked = ref("—");
</script>

<template>
  <main>
    <header class="head">
      <div>
        <h1>wkeeli 在线服务</h1>
        <p class="sub">服务器上运行的全部公网服务与实时状态 · <span>{{ summary }}</span></p>
      </div>
    </header>

    <div class="content">
      <div class="layout">
        <ServiceList @summary="summary = $event" @checked="checked = $event" />
        <HostPanel />
      </div>

      <footer>
        <span>{{ checked }}</span>
      </footer>
    </div>
  </main>
</template>

<style scoped>
main {
  max-width: 1040px;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 200px;
  gap: 48px;
  align-items: start;
}

footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  margin-top: 44px;
  color: var(--muted);
  font-size: 12px;
}

@media (max-width: 760px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
}

@media (max-width: 560px) {
  footer {
    margin-top: 28px;
  }
}
</style>
