import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/', // Pastikan baris ini ada
  plugins: [vue()],
})