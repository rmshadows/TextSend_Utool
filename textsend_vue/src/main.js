// 引入Vue
import { createApp } from 'vue'

/* 根组件选项 */
import App from './App.vue'

// 创建Vue应用
const app_root = createApp(App)

// app_root.component('footer_component', {
//     template: '<h1>自定义组件!</h1>'
// })

// 挂载应用
app_root.mount('#app')
