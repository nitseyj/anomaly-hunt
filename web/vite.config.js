import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// No XSS vector exists in this app today (no dangerouslySetInnerHTML,
// eval, or innerHTML anywhere -- every user-facing string renders
// through React's auto-escaping JSX). This CSP is defense-in-depth
// against a FUTURE regression, not a fix for a known hole: it's as
// strict as the app's actual origins allow, since there's nothing here
// that legitimately needs more. `img-src` includes `data:` for the
// inline SVG grain-texture background; nothing else in the app uses a
// data: URI. A meta tag can't carry frame-ancestors/sandbox/report-uri
// (those are HTTP-header-only per spec) -- if this ever moves to a host
// that lets you set response headers, add those there instead.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

// Only applied to the PRODUCTION build (`apply: 'build'`) -- Vite's dev
// server injects CSS Modules as literal inline <style> tags for fast
// HMR, which this policy (deliberately with no 'unsafe-inline') blocks
// outright, silently breaking every bit of styling under `npm run dev`.
// The production build extracts CSS to real .css files instead, which
// the policy is fine with -- confirmed against the actual built output
// with zero CSP violations across every screen.
function productionCsp() {
  return {
    name: 'production-csp',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

// base: '/anomaly-hunt/' matches the repo name for GitHub Pages deploys.
// Change this if you rename the repo, or set base: '/' if deploying to a
// custom domain / root path instead.
export default defineConfig({
  plugins: [react(), productionCsp()],
  base: '/anomaly-hunt/',
  publicDir: 'public',
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
