import { createStore, createLogger } from 'vuex'
import qrdata from './qrdata'
import textsenddata from './textsenddata'
import mainbodydata from './mainbodydata'

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
    modules: {
        qrdata,
        textsenddata,
        mainbodydata
    },
    strict: debug,
    plugins: debug ? [createLogger()] : [],
    state: () => ({
        user: null
    }),
    getters: {
        loginStatus: state => !!state.user
    },
    actions: {
        login({ commit }, { user }) {
            commit('SET_USER', user)
        },
        logout({ commit }) {
            commit('SET_USER', null)
        }
    },
    mutations: {
        SET_USER(state, user) {
            state.user = user
        }
    }
})
