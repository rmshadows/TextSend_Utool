// 引入Vue
import { createApp } from 'vue'
// 引入Vuex store
import vstore from './store/index'

/* 根组件选项 */
import App from './App.vue'

// 创建Vue应用
const app = createApp(App)
// 将 store 实例作为插件安装
app.use(vstore)

// 挂载应用
app.mount('#app')
