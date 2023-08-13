// store vuex入口文件
import { createStore, createLogger } from 'vuex'
import mainbodydata from './modules/mainbodydata'
import qrdata from './modules/qrdata'
import textsenddata from './modules/textsenddata'

const debug = process.env.NODE_ENV !== 'production'

// 创建一个新的 store 实例 https://stackblitz.com/edit/vue-script-setup-with-vuex?file=src%2FApp.vue
// const store = createStore({
//     state() {
//         return {
//             serverMode: true,
//         }
//     }
// })
export default createStore({
    namespaced: true,
    // 分成了几个模块，分别导入，但是一个app仅有一个store ！
    modules: {
        qrdata,
        textsenddata,
        mainbodydata
    },
    strict: debug,
    plugins: debug ? [createLogger()] : [],
    state: () => ({
    }),
    getters: {
    },
    actions: {
    },
    mutations: {
    }
})
