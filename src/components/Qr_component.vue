<template>
  <div class="qr-component">
    <div class="qr-component-div">
      <img
        class="qr-code-img"
        :src="qrImgSrc"
        :title="hasQr ? '点击复制长密钥连接串' : ''"
        @click="handleCopyUri"
        @contextmenu.prevent="handleCopyUri"
      />
      <div v-if="pinText" class="qr-meta">
        <button type="button" class="pin" title="点复制短连接串，右键只复制 PIN"
          @click="copyPinUri" @contextmenu.prevent="copyPinOnly">PIN {{ pinText }}</button>
        <span v-if="showClientCount" class="count">{{ clientCountLabel }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import logoUrl from "../../logo.png";
import { useQrStore } from '../stores/qrStore'
import { useTextsendStore } from '../stores/textsendStore'
import { useMainbodyStore } from '../stores/mainbodyStore'

const qrStore = useQrStore();
const tsStore = useTextsendStore();
const mbStore = useMainbodyStore();

function resolveQrSrc(raw) {
  const s = raw == null ? "" : String(raw);
  if (!s || s.includes("favicon")) {
    return logoUrl;
  }
  if (s.startsWith("/") || /^[A-Za-z]:[\\/]/.test(s)) {
    return "file://" + s.replace(/\\/g, "/");
  }
  try {
    return new URL(s, import.meta.url).href;
  } catch (e) {
    return logoUrl;
  }
}

const qrImgSrc = computed(() => resolveQrSrc(qrStore.qrImgSrc));
const pinText = computed(() => qrStore.pin);
const hasQr = computed(() => {
  const src = String(qrStore.qrImgSrc || "");
  return !!qrStore.pskB64 && src && !src.includes("favicon");
});
const showClientCount = computed(() => mbStore.serverMode && mbStore.isServerStart);
const clientCountLabel = computed(() => {
  const n = mbStore.connectedCount;
  const max = mbStore.maxConnections;
  return max > 1 ? `${n}/${max}` : `${n}`;
});

const handleCopyUri = () => {
  if (!hasQr.value) {
    return;
  }
  qrStore.copyPskUri(tsStore.ipAddr, tsStore.portNumber);
};

const copyPinUri = () => {
  if (!qrStore.pin) {
    return;
  }
  window.copyText(window.formatUri(tsStore.ipAddr, tsStore.portNumber, qrStore.pin));
  if (window.$message) {
    window.$message.success("已复制 PIN 连接串");
  }
};

const copyPinOnly = () => {
  if (!qrStore.pin) {
    return;
  }
  window.copyText(qrStore.pin);
  if (window.$message) {
    window.$message.success("已复制 PIN");
  }
};
</script>

<style scoped lang="less">
.qr-component {
  height: 100%;
  width: 100%;
  min-height: 0;
  user-select: none;

  .qr-component-div {
    height: 100%;
    min-height: 0;
    padding: 16px;
    box-sizing: border-box;
    position: relative;
    display: flex;
    flex-direction: column;

    .qr-code-img {
      flex: 1 1 auto;
      width: 100%;
      min-height: 0;
      max-height: 100%;
      object-fit: contain;
      object-position: center;
      cursor: pointer;
      background: #fff;
    }
  }
}

.qr-meta {
  position: absolute;
  left: 8px;
  bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.pin {
  border: 0;
  background: var(--ts-chip);
  color: var(--ts-accent);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

.count {
  font-size: 12px;
  color: var(--ts-muted);
}
</style>
