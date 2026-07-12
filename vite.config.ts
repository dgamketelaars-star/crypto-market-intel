import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  // GitHub Pages serves this project from https://<user>.github.io/crypto-market-intel/,
  // not the domain root, so the production build needs every asset path prefixed accordingly.
  // Local dev keeps serving from '/' so `npm run dev` URLs stay unchanged.
  base: command === 'build' ? '/crypto-market-intel/' : '/',
}))
