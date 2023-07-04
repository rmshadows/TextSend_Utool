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
  /* clear: both; */
  width: 100%;
  display: flex;
  height: calc((100vh - 80px - 70px));

  .textsend-body-left {
    width: calc((100vh - 80px - 70px));
    height: 100%;
    background-color: rgb(207, 255, 192);
  }
  .textsend-body-right {
    width: calc(100vw - (100vh - 80px - 70px));
    height: 100%;
    background-color: rgb(250, 255, 153);
  }
}
</style>
