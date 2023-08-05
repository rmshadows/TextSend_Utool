<template>
  <div class="qr-component">
    <div class="qr-component-div">
      <!-- <img
      class="qr-code-img"
      src="../assets/favicon.png"
      @click="handleClickImg"
    /> -->
    </div>
  </div>
</template>

<script>
import { defineComponent, ref } from "vue";
export default defineComponent({
  name: "QrComponent",
  props: {},
  setup(props, context) {

    const handleClickImg = () => {
      console.log("点击里面的图片");
      // 向父组件发出img-click
      context.emit("img-click", 111);
    };
    return {
      handleClickImg,
    };
  },
});
</script>

<style scoped lang="less">
.qr-component {
  height: 100%;
  width: 100%;
  user-select: none;
  background-color: blue;
}

.qr-component-div {
  // height: 100%;
  height: calc((100%)); // TODO
  padding: 40px;
  background-color: aliceblue;
}

.qr-code-img {
  height: 100%;
  width: 100%;
}
</style>
