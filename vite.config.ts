import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: false,
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webp,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: { cacheName: 'gee-fonts', expiration: { maxEntries: 8, maxAgeSeconds: 2592000 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'vendor-react'
          if (id.includes('/react-router/') || id.includes('/react-router-dom/') || id.includes('/@remix-run/')) return 'vendor-router'
          if (id.includes('/@radix-ui/') || id.includes('/sonner/') || id.includes('/lucide-react/')) return 'vendor-ui'
          if (id.includes('/@dnd-kit/')) return 'vendor-dnd'
          if (id.includes('/@tanstack/') || id.includes('/zustand/') || id.includes('/zod/') || id.includes('/react-hook-form/') || id.includes('/@hookform/') || id.includes('/date-fns/')) return 'vendor-data'
          if (id.includes('/motion/')) return 'vendor-motion'
        },
      },
    },
  },
  server: { host: '0.0.0.0', port: 3000, strictPort: true },
})
