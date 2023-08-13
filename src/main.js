// 引入Vue
import { createApp } from 'vue'
// 引入Pinia
import { createPinia } from 'pinia'
/* 根组件选项 */
import App from './App.vue'

// 创建一个 pinia 实例 (根 store) 并将其传递给应用
const pinia = createPinia();

// 创建Vue应用
const app = createApp(App);
// 使用pinia
app.use(pinia);
// 挂载应用
app.mount('#app');
