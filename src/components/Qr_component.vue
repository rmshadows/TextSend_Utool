<template>
  <div class="qr-component">
    <n-tooltip trigger="hover">
      <template #trigger>
        <div class="qr-component-div">
          <img class="qr-code-img" :src="qrImgSrc" @click="handleClickImg" />
        </div>
      </template>
      二维码是 ts:// 长密钥连接串。点图复制；点 PIN 复制短连接串。
    </n-tooltip>
  </div>
</template>

<script setup>
import { NTooltip } from "naive-ui";
import { computed } from "vue";
import { useQrStore } from '../stores/qrStore'
import { useTextsendStore } from '../stores/textsendStore'

const qrStore = useQrStore();
const tsStore = useTextsendStore();

let qrImgSrc = computed(() => new URL(qrStore.qrImgSrc, import.meta.url));

const handleClickImg = () => {
  const psk = qrStore.pskB64;
  if (!psk) {
    return;
  }
  const uri = window.formatUri(tsStore.ipAddr, tsStore.portNumber, psk);
  window.copyText(uri);
  if (window.$message) {
    window.$message.success("已复制密钥连接串");
  }
};
</script>

<style scoped lang="less">
.qr-component {
  height: 100%;
  width: 100%;
  user-select: none;

  // 包裹二维码图片的div
  .qr-component-div {
    height: 100%;
    padding: 16px;
    box-sizing: border-box;

    .qr-code-img {
      height: 100%;
      width: 100%;
      object-fit: contain;
    }
  }
}
</style>
