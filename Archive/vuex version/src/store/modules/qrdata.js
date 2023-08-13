// initial state 数据
const state = () => ({
    qrImgSrc: "../assets/favicon.png",
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
    // Reset二维码图片
    setQrImgDefaultValue(state) {
        console.log("setQrImgDefaultValue: Reset二维码图片 => ../assets/favicon.png");
        state.qrImgSrc = "../assets/favicon.png";
    }, 
    // 调用：store.commit('qrdata/setQrImgValue', "../d.png");
    // 修改图片路径
    setQrImgValue(state, value) {
        console.log("setQrImgValue: Set二维码图片 " + state.qrImgSrc + " => " + value);
        state.qrImgSrc = value;
    }, 
}


export default {
    namespaced: true,
    state,
    getters,
    actions,
    mutations
}