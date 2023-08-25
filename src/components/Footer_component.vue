<template>
  <div class="footer-component">
    <p>
      Copyright ©
      <span>{{ footer_year }}</span>
      <n-tooltip trigger="hover">
        <template #trigger>
          <a href="https://civiccccc.ltd/"> Ryan </a>
        </template>
        https://civiccccc.ltd/
      </n-tooltip>
      All Rights Reserved. |
      <n-tooltip trigger="hover">
        <template #trigger>
          <a href="https://github.com/rmshadows/TextSend_Utool">Source</a>
        </template>
        https://github.com/rmshadows/TextSend_Utool
      </n-tooltip>
    </p>

  </div>
</template>

<script setup>
import { ref } from "vue";
import { NTooltip } from "naive-ui";

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

<style scoped lang="less">
.footer-component {
  width: 100%;
  height: 70px;
  font-size: 20px;
  display: flex;
  justify-content: center;
  user-select: none;
}
</style>
