import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
// The menu layer wires ITSELF to the box App.vue donates (windows.whenMounted). All this line does
// is make sure the module is loaded — the alternative would be App.vue knowing that menus exist.
import '@/menus'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
