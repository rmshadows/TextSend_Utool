// initial state 数据
const state = () => ({
    // IP列表
    ipAddrList: [{
        "label": "127.0.0.1",
        "value": "127.0.0.1"
    },
    {
        "label": "::1",
        "value": "::1"
    },
    {
        "label": "192.168.30.126",
        "value": "192.168.30.126"
    }],
    // 选取的IP
    ipAddr: "127.0.0.1",
    // 选取的端口号
    portNumber: "54300",
    // 文本框默认文字
    inputText: "",
})

// getters : 有时候我们需要从 store 中的 state 中派生出一些状态，例如对列表进行过滤并计数
const getters = {}

// actions : 异步commit mutations的方法
const actions = {
    // async getAllProducts({ commit }) {
    //     const products = await shop.getProducts()
    //     commit('setProducts', products)
    // }
}

// mutations ：注意，mutations需要同步的
const mutations = {
    setIpAddrListValue(state, value) {
        console.log("setIpAddrListValue: 设置IP下拉框列表 => " + JSON.stringify(value));
        state.ipAddrList = value;
    },
    setIpAddrValue(state, value) {
        console.log("setIpAddrValue: 设置IP地址 => " + value);
        state.ipAddr = value;
    },
    setPortNumberValue(state, value) {
        console.log("setPortNumberValue: 设置端口号 => " + value);
        state.portNumber = value;
    },
}


export default {
    namespaced: true,
    state,
    getters,
    actions,
    mutations
}