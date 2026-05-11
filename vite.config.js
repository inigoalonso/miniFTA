import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/miniFTA/',
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
        start_url: '/miniFTA/',
        scope: '/miniFTA/',
        icons: [
          {
            src: '/miniFTA/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/miniFTA/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
