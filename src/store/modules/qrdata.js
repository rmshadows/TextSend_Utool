// initial state 数据
const state = () => ({
    
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
    
}


export default {
    namespaced: true,
    state,
    getters,
    actions,
    mutations
}