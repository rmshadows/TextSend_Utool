// initial state
const state = () => ({
    serverMode: true,
})

// getters : 有时候我们需要从 store 中的 state 中派生出一些状态，例如对列表进行过滤并计数
const getters = {}

// actions
const actions = {
    async getAllProducts({ commit }) {
        const products = await shop.getProducts()
        commit('setProducts', products)
    }
}

// mutations
const mutations = {
    changeServerMode(state){
        if(state.serverMode){
            state.serverMode = false;
        }else{
            state.serverMode = true;
        }
        return serverMode;
    },
}


export default {
    namespaced: true,
    state,
    getters,
    actions,
    mutations
}