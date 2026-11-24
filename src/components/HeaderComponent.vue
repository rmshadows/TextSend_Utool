<template>
  <div class="header-component">
    <div class="header-side header-side--left" aria-hidden="true"></div>
    <div class="header-brand">
      <div class="textsend-title">TextSend</div>
      <span
        class="zoom-label"
        title="滚轮 ±1%；Ctrl+滚轮 ±0.1%；双击恢复 100%"
        @wheel.prevent="onZoomWheel"
        @dblclick="onZoomReset"
      >{{ zoomText }}</span>
    </div>
    <div class="header-side header-side--right">
      <n-button
        v-if="headerWebVisible"
        size="small"
        :type="headerWebRunning ? 'primary' : 'default'"
        title="浏览器兼容模式。A 明文 / B 加密 / C 证书，端口默认 54301，和 ts:// 分开"
        @click="runHeader('web')"
      >{{ headerWebRunning ? "兼容中" : "兼容模式" }}</n-button>
      <n-button size="small" title="快捷键与用法说明" @click="runHeader('help')">帮助</n-button>
      <n-button size="small" title="版本与 Android 下载" @click="runHeader('about')">关于</n-button>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { NButton } from "naive-ui";
import { nudgeZoom, applyZoom, zoomLabel } from "../js/zoom.js";
import {
  headerWebVisible,
  headerWebRunning,
  runHeader,
} from "../js/headerNav.js";

const zoomText = ref(zoomLabel());

const onZoomWheel = (e) => {
  const step = e.ctrlKey ? 0.1 : 1;
  nudgeZoom(e.deltaY < 0 ? step : -step);
  zoomText.value = zoomLabel();
};

const onZoomReset = () => {
  applyZoom(100);
  zoomText.value = zoomLabel();
};
</script>

<style scoped lang="less">
.header-component {
  width: 100%;
  height: var(--ts-header);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  column-gap: 12px;
  padding: 0 10px;
  box-sizing: border-box;
  user-select: none;
  background: var(--ts-surface);
  border-bottom: 1px solid var(--ts-line);
}

.header-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-width: 0;
}

.header-side {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.header-side--left {
  justify-content: flex-start;
}

.header-side--right {
  justify-content: flex-end;
  flex-wrap: wrap;
}

.textsend-title {
  font-size: 20px;
  font-weight: 650;
}

.zoom-label {
  font-size: 12px;
  min-width: 3.2em;
  text-align: center;
  cursor: ns-resize;
  color: var(--ts-muted);
}
</style>
