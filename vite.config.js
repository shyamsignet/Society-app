import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base './' lets the same build run from a domain root or a sub-path
// (e.g. GitHub Pages at /Society-app/). Routing uses HashRouter.
// The same code is built twice by the deploy workflow: the real app (Supabase env set)
// and the sample-data demo served from /demo/ (no Supabase env).
const DEMO_BUILD = !(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY)

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'sw-push.js'],
      manifest: {
        name: DEMO_BUILD ? 'SociYo Demo – sample society' : 'SociYo – Your society, sorted.',
        short_name: DEMO_BUILD ? 'SociYo Demo' : 'SociYo',
        description: 'SociYo – your society, sorted. Maintenance payments, complaints, visitors, bookings, notices and more for your apartment society.',
        theme_color: '#3B1F3A',
        background_color: '#F8F4EF',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        // the real app must not swallow the demo that lives under /demo/
        navigateFallbackDenylist: DEMO_BUILD ? [] : [/\/demo\//],
        importScripts: ['sw-push.js']
      }
    })
  ]
})
