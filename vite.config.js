import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/fta-mobile/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'FTA Mobile Editor',
        short_name: 'FTA Editor',
        description: 'Mobile nested-list editor for Fault Tree Analysis',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/fta-mobile/',
        scope: '/fta-mobile/',
        icons: [
          {
            src: '/fta-mobile/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/fta-mobile/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
