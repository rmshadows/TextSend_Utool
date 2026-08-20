<template>
  <div class="header-component">
    <div class="textsend-title">Textsend for uTools</div>
    <span
      class="zoom-label"
      title="滚轮 ±1%；Ctrl+滚轮 ±0.1%；双击恢复 100%"
      @wheel.prevent="onZoomWheel"
      @dblclick="onZoomReset"
    >{{ zoomText }}</span>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { nudgeZoom, applyZoom, zoomLabel } from "../js/zoom.js";

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
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  user-select: none;
  background-color: floralwhite;

  .textsend-title {
    font-size: 18px;
  }

  .zoom-label {
    font-size: 13px;
    min-width: 3.2em;
    text-align: center;
    cursor: ns-resize;
    opacity: 0.75;
  }
}
</style>
