import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'www',
    emptyOutDir: true,
  },
  base: './', // Use relative paths for assets
  optimizeDeps: {
    include: ['hls.js'], // Force pre-bundling for hls.js to fix build errors
  },
})