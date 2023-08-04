<template>
  <!-- 一个template一个元素 -->
  <div class="textsend">
    <HeaderComponent />
    <MainBodyComponent />
    <FooterComponent />
    
  </div>
</template>

<script setup>
import HeaderComponent from "@/components/HeaderComponent.vue";
import MainBodyComponent from "@/components/MainBodyComponent.vue";
import FooterComponent from "./components/Footer_component.vue";
</script>

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
