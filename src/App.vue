<template>
  <!-- 一个template一个元素 -->
  <div class="textsend">
    <n-message-provider>
      <HeaderComponent />
      <MainBodyComponent />
      <FooterComponent />
    </n-message-provider>
  </div>
</template>

<script setup>
import HeaderComponent from "@/components/HeaderComponent.vue";
import MainBodyComponent from "@/components/MainBodyComponent.vue";
import FooterComponent from "@/components/Footer_component.vue";
import { NMessageProvider } from "naive-ui";
</script>

<style scoped lang="less">
.textsend {
  width: 100%;
  height: 100vh;
  background-color: rgb(242, 242, 242);
}

body {
  margin: 0px;
}
</style>