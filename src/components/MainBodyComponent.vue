<template>
  <div class="textsend-body">
    <div class="textsend-body-left">
      <QrComponent />
    </div>
    <div class="textsend-body-right">
      <TextSendComponent />
    </div>
  </div>
</template>

<script setup>
import QrComponent from "./Qr_component.vue";
import TextSendComponent from "./Textsend_component.vue";
</script>

<style scoped lang="less">
.textsend-body {
  width: 100%;
  display: flex;
  height: calc(100vh - var(--ts-header) - var(--ts-footer));
  min-height: 0;
  background: var(--ts-surface);

  .textsend-body-left {
    flex: 0 1 36%;
    max-width: min(340px, 42vw);
    min-width: 168px;
    height: 100%;
    border-right: 1px solid var(--ts-line);
  }

  .textsend-body-right {
    flex: 1 1 auto;
    min-width: 0;
    height: 100%;
    min-height: 0;
  }
}
</style>
