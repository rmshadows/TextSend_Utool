// initial state 数据
const state = () => ({
    serverMode: true, // 服务状态：服务端或者客户端
    appName: "Textsend uTools 插件",
    version: "0.0.1",
    author: "Ryan Yim",
})

// getters : 有时候我们需要从 store 中的 state 中派生出一些状态，例如对列表进行过滤并计数
const getters = {}

// actions : 异步commit mutations的方法
const actions = {
    async getAllProducts({ commit }) {
        const products = await shop.getProducts()
        commit('setProducts', products)
    }
}

// mutations ：注意，mutations需要同步的
const mutations = {
    /**
     * 修改模式状态 store.commit('mainbodydata/changeServerMode');
     * @param {*} state  
     * @returns 
     */
    changeServerMode(state) {
        if (state.serverMode) {
            state.serverMode = false;
            console.log("切换客户端模式");
        } else {
            state.serverMode = true;
            console.log("切换服务端模式");
        }
        // return就报错！
        /**
         * Uncaught ReferenceError: serverMode is not defined
    at Store2.changeServerMode (mainbodydata.js?t=1691530975034:32:9)
    at wrappedMutationHandler (vuex.esm-bundler.js:298:13)
    at commitIterator (vuex.esm-bundler.js:982:7)
    at Array.forEach (<anonymous>)
    at vuex.esm-bundler.js:981:11
    at Store2._withCommit (vuex.esm-bundler.js:1140:3)
    at Store2.commit (vuex.esm-bundler.js:980:8)
    at Store2.boundCommit [as commit] (vuex.esm-bundler.js:917:19)
    at btnChangeMode (Textsend_component.vue:181:9)
    at call (call.js:6:16)
         */
        // return serverMode;
    },
}


export default {
    namespaced: true,
    state,
    getters,
    actions,
    mutations
}