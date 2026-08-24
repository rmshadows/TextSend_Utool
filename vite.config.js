import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/** uTools / Electron file:// 下 crossorigin 会导致 ES module 静默加载失败 */
function stripCrossOrigin() {
  return {
    name: 'strip-crossorigin',
    transformIndexHtml(html) {
      return html.replace(/ crossorigin/g, '')
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), stripCrossOrigin()],
  base: './',
  build: {
    modulePreload: { polyfill: false },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
