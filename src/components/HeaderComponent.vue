<template>
  <div class="header-component">
    <div class="textsend-title">Textsend for uTools</div>
  </div>
</template>

<script></script>

<!-- scoped 解决了样式私有化的问题，但同时也引入了新的问题—样式不易（可）修改 -->
<style scoped lang="less">
.header-component {
  width: 100%;
  height: 80px;
  font-size: 20px;
  // flex 属性用于设置或检索弹性盒模型对象的子元素如何分配空间
  display: flex;
  // 元素居中
  justify-content: center;
  // 元素水平线上居中
  align-items: center;
  user-select: none;
  background-color: floralwhite;

  .textsend-title {
    font-size: 40px;
  }
}
</style>
