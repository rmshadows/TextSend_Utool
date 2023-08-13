// 引入Vue
import { createApp } from 'vue'
// 引入Vuex store
import store from './store/index'

/* 根组件选项 */
import App from './App.vue'

// 创建Vue应用
const app = createApp(App)
// 将 store 实例作为插件安装
// 在 Vue 组件中， 可以通过 this.$store 访问store实例
// 通过 store.state 来获取状态对象，并通过 store.commit 方法触发状态变更
app.use(store);

// 挂载应用
app.mount('#app');
