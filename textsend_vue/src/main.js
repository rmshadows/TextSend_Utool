import { createApp } from 'vue'

import App from './App.vue'

const app_root = createApp(App)



app_root.component('footer_component', {
    template: '<h1>自定义组件!</h1>'
})

app_root.mount('#app')
