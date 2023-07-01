<script setup>
  import { NSpace, NButton, NCard,
  NLayout, NLayoutContent, NLayoutHeader, NLayoutSider, NLayoutFooter } from 'naive-ui'
  import Qr_component from './components/Qr_component.vue'
  import Footer_component from './components/Footer_component.vue'
  import Textsend_component from './components/Textsend_component.vue'
</script>

<template>
  <div id="textsend-title">
    <h4 id="textsend-title-h4">Textsend Utools</h4>
  </div>
  <div id="div-body">
    <qr_component></qr_component>
    <!-- <textsend_component></textsend_component> -->
  </div>
  <footer_component></footer_component>
</template>

<style scoped>
#textsend-title
{
  /* position: absolute; */
  width: 100%;
  background-color: aqua;
}

#textsend-title-h4
{
  text-align: center;
  margin-top: 1px;
  margin-bottom: 0%;
}

#div-body{
  /* clear: both; */
  padding: 10px;
  overflow: auto;
  height: auto;
  top: 27px;
  bottom: 50px;
  width: 100%;
  position: absolute;

  /* 边框 debug */
  border-style:solid;
  border-width:5px;
  border-color: rgb(153, 153, 255);
  background-color: rgb(64, 55, 225);
}

</style>