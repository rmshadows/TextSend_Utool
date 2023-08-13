// initial state 数据
const state = () => ({
    appName: "Textsend uTools 插件",
    version: "0.0.1",
    author: "Ryan Yim",
    serverMode: true, // 服务状态：服务端或者客户端
    isConnected: false, // 是否已连接
    isServerStart: false, // 服务端是否已启动(仅服务端) 只能从Action更改
    disableChangeModeBtn: false, // 是否禁用切换按钮
})

// getters : 有时候我们需要从 store 中的 state 中派生出一些状态，例如对列表进行过滤并计数
const getters = {
    getIsConnected(state) {
        return state.isConnected;
    },
    getServerMode(state) {
        return state.serverMode;
    },
    getisServerStart(state) {
        return state.isServerStart;
    },
    getDisableChangeModeBtn(state) {
        if(state.isServerStart){
            return true;
        }else{
            return false;
        }
    },
}

// actions : 异步commit mutations的方法
const actions = {
    // 服务端停止
    async serverStop({ dispatch, commit, getters, rootGetters }) {
        await commit('setServerStat', false);
        await commit('setDisableChangeModeBtn', false);
    },
    // 服务端启动
    async serverStart({ dispatch, commit, getters, rootGetters }) {
        await commit('setServerStat', true);
        await commit('setDisableChangeModeBtn', true);
    },
    async clientStop(context, value) {
        await commit('setInputValue', value);
    },
    async clientStart(context, value) {
        await commit('setIsLoadingValue', value);
    },
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
    setConnectStat(state, value) {
        if (value) {
            state.isConnected = true;
            console.log("设置连接成功状态");
        } else {
            state.isConnected = false;
            console.log("设置连接断开状态");
        }
    },
    changeConnectStat(state) {
        if (state.isConnected) {
            state.isConnected = false;
        } else {
            state.isConnected = true;
        }
    },
    // 仅供内部Action调用！
    setServerStat(state, value) {
        if (value) {
            state.isServerStart = true;
            console.log("设置服务端启动状态");
        } else {
            state.isServerStart = false;
            console.log("设置服务端停止状态");
        }
    },
    changeServerStat(state) {
        if (state.isServerStart) {
            state.isServerStart = false;
            console.log("服务端停止");
        } else {
            state.isServerStart = true;
            console.log("服务端启动");
        }
    },
    // 内部调用
    setDisableChangeModeBtn(state, value){
        state.disableChangeModeBtn = value;
    }
}


export default {
    namespaced: true,
    state,
    getters,
    actions,
    mutations
}