<script setup>
  import { NSpace, NButton, NCard,
  NLayout, NLayoutContent, NLayoutHeader, NLayoutSider, NLayoutFooter } from 'naive-ui'
  import Qr_component from './components/Qr_component.vue'
  import Footer_component from './components/Footer_component.vue'
  import Textsend_component from './components/Textsend_component.vue'
</script>

<template>
  <div>
    <!-- <qr_component></qr_component>
    <textsend_component></textsend_component> -->
  </div>
  <footer_component></footer_component>
</template>

<style scoped>
#div-left{
  /* align-content: center; */
  float: left;
  border-style:solid;
  border-width:5px;
  border-color: rgb(153, 153, 255);
  background-color: rgb(64, 55, 225);
}

#div-right{
  float: right;
}
</style>