import { defineConfig } from 'vite'
import { resolve } from 'path'

// No framework plugin: the editor is plain TypeScript, and Vite is here purely as a bundler and dev
// server. See docs/remove-vue-plan.md — "Vite is not Vue".
export default defineConfig({
  base: '/opus-editor/',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  test: {
    globals: true,
    environment: 'node'
  }
})
