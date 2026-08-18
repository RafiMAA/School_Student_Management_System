import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { VitePWA } from 'vite-plugin-pwa'

const publishedAt = new Date().toISOString()
const publishedStamp = publishedAt.replace(/\D/g, '').slice(2, 12)
const commitStamp = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local'
const buildVersion = `${commitStamp}-${publishedStamp}`

const buildMetadata = JSON.stringify({ version: buildVersion, publishedAt }, null, 2)

function pwaBuildMetadata(): Plugin {
  return {
    name: 'pwa-build-metadata',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: buildMetadata })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  define: {
    __AHADIYA_BUILD_VERSION__: JSON.stringify(buildVersion),
    __AHADIYA_BUILD_PUBLISHED_AT__: JSON.stringify(publishedAt),
  },
  plugins: [
    react(),
    pwaBuildMetadata(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'ahadiya-pwa-icon-192.png',
        'ahadiya-pwa-icon-512.png',
      ],
      manifest: {
        id: '/',
        name: 'Al-Meera Ahadiya School Management System',
        short_name: 'Al-Meera Ahadiya',
        description: 'Student, attendance, class, and school management for Al-Meera Ahadiya School.',
        categories: ['education', 'productivity'],
        theme_color: '#059669',
        background_color: '#f8fafc',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/ahadiya-pwa-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/ahadiya-pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/ahadiya-pwa-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        importScripts: ['push-sw.js'],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
      },
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'https://ahadiya-student-management-system.onrender.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  preview: {
    proxy: {
      '/api': {
        target: 'https://ahadiya-student-management-system.onrender.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
