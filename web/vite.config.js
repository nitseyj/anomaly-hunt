import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: '/anomaly-hunt/' matches the repo name for GitHub Pages deploys.
// Change this if you rename the repo, or set base: '/' if deploying to a
// custom domain / root path instead.
export default defineConfig({
  plugins: [react()],
  base: '/anomaly-hunt/',
  publicDir: 'public',
})
