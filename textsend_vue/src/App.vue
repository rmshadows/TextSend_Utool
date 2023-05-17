<script setup>
  import { NSpace, NButton, NCard,
  NLayout, NLayoutContent, NLayoutHeader, NLayoutSider, NLayoutFooter } from 'naive-ui'
  import Qr_component from './components/Qr_component.vue'
  import Footer_component from './components/Footer_component.vue'
  import Textsend_component from './components/Textsend_component.vue'
</script>

<template>
  <n-space vertical size="large">
    <n-layout embedded content-style="padding: 24px;">
    <n-card>
      只要是 看到天边云一朵<br>
      逐天拢有好心情
    </n-card>
  </n-layout>
    <n-layout has-sider>
      <n-layout-sider content-style="padding: 24px;">
        海淀桥
      </n-layout-sider>
      <n-layout>
        <n-layout-header>颐和园路</n-layout-header>
        <n-layout-content content-style="padding: 24px;">
          平山道
        </n-layout-content>
        <n-layout-footer>成府路</n-layout-footer>
      </n-layout>
    </n-layout>
  </n-space>
  <n-space justify="space-around" size="large">
    <n-button>Oops!</n-button>
    <n-button>Oops!</n-button>
    <n-button>Oops!</n-button>
  </n-space>
</template>

<style scoped>
.n-layout-header,
.n-layout-footer {
  background: rgba(128, 128, 128, 0.2);
  padding: 24px;
}

.n-layout-sider {
  background: rgba(128, 128, 128, 0.3);
}

.n-layout-content {
  background: rgba(128, 128, 128, 0.4);
}
</style>