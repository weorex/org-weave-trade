import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  build: {
    outDir: 'dist', emptyOutDir: true,
    rollupOptions: {
      input: { popup: fileURLToPath(new URL('popup.html', import.meta.url)), background: fileURLToPath(new URL('src/background.ts', import.meta.url)) },
      // The manifest references the service worker by a fixed name.
      output: { entryFileNames: chunk => chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js' },
    },
  },
})