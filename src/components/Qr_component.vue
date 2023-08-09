<template>
  <div class="qr-component">
    <n-tooltip trigger="hover">
      <template #trigger>
        <div class="qr-component-div">
          <img class="qr-code-img" :src="qrImgSrc" @click="handleClickImg" />
        </div>
      </template>
      二维码将在点击“启动”后重新生成， 请使用Textsend安卓客户端扫码。
    </n-tooltip>
  </div>
</template>

<script setup>
import { NTooltip } from "naive-ui";
import { useStore } from 'vuex';
import { computed } from "vue";

const store = useStore();

// QR二维码图片地址 下面这句行不通 参加: https://stackoverflow.com/questions/66419471/vue-3-vite-dynamic-image-src
// let qrImgSrc = "../assets/favicon.png";
// let qrImgSrc = new URL('../assets/favicon.png', import.meta.url);
let qrImgSrc = computed(() => new URL(store.state.qrdata.qrImgSrc, import.meta.url));

// const props = defineProps({});
// 测试子传父
const emit = defineEmits(['handleClickImg'])
const handleClickImg = () => {
  console.log("点击里面的图片");
  // 向父组件发出img-click
  emit("img-click", 111);
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
    padding: 60px;
    // 加这一句后padding就不会溢出
    box-sizing: border-box;

    // 二维码图片
    .qr-code-img {
      height: 100%;
      width: 100%;
    }
  }
}
</style>
