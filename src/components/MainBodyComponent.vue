<template>
  <div class="textsend-body">
    <div class="textsend-body-left">
      <!-- <QrComponent @img-click="handleClickInner" /> -->
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
import { computed } from "vue";
import { useMainbodyStore } from '../stores/mainbodyStore'

// 可以在组件中的任意位置访问 `store` 变量 ✨
const mbStore = useMainbodyStore();

// 是否是服务端模式 计算属性中返回某个状态
let serverMode = computed(() => mbStore.serverMode);
// 连接状态
let isConnected = computed(() => mbStore.isConnected);

// 测试子传父
// const handleClickInner = (value) => {
//   console.log("父组件接收到了img-click, 值为", value);
// };
</script>

<style scoped lang="less">
.textsend-body {
  width: 100%;
  display: flex;
  height: calc(100vh - var(--ts-header) - var(--ts-footer));
  min-height: 0;

  .textsend-body-left {
    flex: 0 1 36%;
    max-width: min(340px, 42vw);
    min-width: 160px;
    height: 100%;
  }

  .textsend-body-right {
    flex: 1 1 auto;
    min-width: 240px;
    height: 100%;
    min-height: 0;
  }
}
</style>
