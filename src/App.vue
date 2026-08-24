<template>
  <div class="textsend">
    <n-config-provider :theme-overrides="themeOverrides">
      <n-message-provider>
        <HeaderComponent />
        <MainBodyComponent />
        <FooterComponent />
      </n-message-provider>
    </n-config-provider>
  </div>
</template>

<script setup>
import HeaderComponent from "@/components/HeaderComponent.vue";
import MainBodyComponent from "@/components/MainBodyComponent.vue";
import FooterComponent from "@/components/Footer_component.vue";
import { NConfigProvider, NMessageProvider } from "naive-ui";

const themeOverrides = {
  common: {
    primaryColor: "#5C00FF",
    primaryColorHover: "#6D1AFF",
    primaryColorPressed: "#4A00CC",
    primaryColorSuppl: "#5C00FF",
    borderRadius: "4px",
    fontSize: "13px",
  },
  Button: {
    heightSmall: "26px",
    heightMedium: "26px",
    paddingSmall: "0 8px",
    paddingMedium: "0 8px",
  },
  Input: {
    borderHover: "1px solid #C5C9D1",
    borderFocus: "1px solid #5C00FF",
  },
};
</script>

<style scoped lang="less">
.textsend {
  width: 100%;
  height: 100vh;
  background: var(--ts-bg);
  color: var(--ts-ink);
}
</style>