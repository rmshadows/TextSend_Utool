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
    portNumber: 54300,
    // 文本框默认文字
    inputText: "",
    // 是否加载中
    isLoading: false,
    // 按钮文字
    launchBtnText: "启&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;动",
    changeModeBtnText: "切&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;换",
})

// getters : 有时候我们需要从 store 中的 state 中派生出一些状态，例如对列表进行过滤并计数
const getters = {
    getInputTextPlaceholder(state, getters, rootState, rootGetters) {
        if (rootGetters['mainbodydata/getServerMode']) {
            return "请输入要发送的文字";
        } else {
            // 客户端模式
            if (rootGetters['mainbodydata/getIsConnected']) {
                return "请输入要发送的文字";
            } else {
                return "请输入服务端[IP地址]:[端口号]，如：192.168.1.2:54301 或者 192.168.1.2 (不加端口号默认54300) ";
            }
        }
    },
}

// actions : 异步commit mutations的方法
const actions = {
    async setInputValue(context, value) {
        await context.commit('setInputValue', value);
    },
    async setIsLoadingValue(context, value) {
        await context.commit('setIsLoadingValue', value);
    },
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
    setInputValue(state, value) {
        console.log("setInputValue: 设置文本框内容 => " + value);
        state.inputText = value;
    },
    changeIsLoadingValue(state) {
        if (state.isLoading) {
            state.isLoading = false;
        } else {
            state.isLoading = true;
        }
        console.log("changeIsLoadingValue: => " + state.isLoading);
    },
    setIsLoadingValue(state, value) {
        state.isLoading = value;
        console.log("set isLoading value to " + state.isLoading);
    },
}


export default {
    namespaced: true,
    state,
    getters,
    actions,
    mutations
}