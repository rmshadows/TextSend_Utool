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
  /* clear: both; */
  width: 100%;
  display: flex;
  // Viewport Height，视窗高度，1vh=视窗高度的1%
  // 百分百高 - 80px -70px (header和footer的高度)
  height: calc((100vh - 80px - 70px));

  .textsend-body-left {
    // 宽度 = 高度
    width: calc((100vh - 80px - 70px));
    height: 100%;
  }

  .textsend-body-right {
    // 宽度 = 百分比宽度 - 左边占用的宽度
    width: calc(100vw - (100vh - 80px - 70px));
    height: 100%;
  }
}
</style>
