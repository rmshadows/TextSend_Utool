// initial state
const state = () => ({
    ipAddr: "",
})

// getters
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
    setIpAddr(state, ip){
        state.ipAddr = ip;
    },
    
    decrementProductInventory(state, { id }) {
        const product = state.all.find(product => product.id === id)
        product.inventory--
    }
}


export default {
    namespaced: true,
    state,
    getters,
    actions,
    mutations
}