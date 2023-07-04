<template>
  <div id="footer-component">
    <p>
      Copyright ©
      <span>{{ footer_year }}</span>
      <a href="https://civiccccc.ltd/"> Ryan </a> All Rights Reserved
    </p>
  </div>
</template>

<script setup>
import { ref } from "vue";

const footer_year = ref(2000);

/**
 * 获取当前年份
 */
const getFooterYear = () => {
  let d = new Date();
  // console.log("当前年份："+d.getFullYear());
  return d.getFullYear();
};

/**
 * 状态变量
 * 要放在函数后
 */
footer_year.value = getFooterYear();
</script>

<style scoped>
#footer-component {
  text-align: center;
  position: absolute;
  width: 100%;
  bottom: 0;
  height: 70px;
  font-size: 20px;

  /* debug */
  background-color: rgb(182, 255, 255);
}
</style>
