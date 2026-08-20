import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { loadZoom } from './js/zoom.js'
import './styles.css'

loadZoom();

const pinia = createPinia();
const app = createApp(App);
app.use(pinia);
app.mount('#app');
