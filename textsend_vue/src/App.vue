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
import HeaderComponent from "@/components/HeaderComponent.vue";
import MainBodyComponent from "@/components/MainBodyComponent.vue";
import FooterComponent from "./components/Footer_component.vue";
</script>

<template>
  <div class="textsend">
    <HeaderComponent />
    <MainBodyComponent />
    <FooterComponent />
  </div>
</template>

<style scoped lang="less">
.textsend {
  width: 100%;
  height: 100vh;
  background-color: rgb(242, 242, 242);  
}
</style>

<style>
body {
  margin: 0px;
}
</style>
