// 引入Vue
import { createApp } from 'vue'

/* 根组件选项 */
import App from './App.vue'

// 创建Vue应用
const app_root = createApp(App)

// 挂载应用
app_root.mount('#app')
