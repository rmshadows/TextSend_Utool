<script setup>
// import {
//   NSpace,
//   NButton,
//   NCard,
//   NLayout,
//   NLayoutContent,
//   NLayoutHeader,
//   NLayoutSider,
//   NLayoutFooter,
// } from "naive-ui";
import HeaderComponent from '@/components/HeaderComponent.vue';
import QrComponent from "./components/Qr_component.vue";
import FooterComponent from "./components/Footer_component.vue";
import TextsendComponent from "./components/Textsend_component.vue";
</script>

<template>
  <div class="textsend">
    <HeaderComponent />
    <div class="textsend-body">
      <div class="textsend-body-left">
        <QrComponent />
      </div>
      <div class="textsend-body-right">
        <TextsendComponent />
      </div>
    </div>
    <FooterComponent />
  </div>
</template>

<style scoped lang="less">
.textsend {
  width: 100%;
  height: 100vh;
  background-color: rgb(242, 242, 242);
  
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
}
</style>
<style>
body {
  margin: 0px;
}
</style>
