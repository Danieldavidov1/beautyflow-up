import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa' // ✅ ייבוא הפלאגין של ה-PWA

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // ✅ הגדרות ה-PWA המלאות
    VitePWA({
      registerType: 'autoUpdate', // ברגע שיש גרסה חדשה, האפליקציה תתעדכן אוטומטית ברקע
      includeAssets: ['favicon.ico', 'icons/*.png'], // שומר את האייקונים בזיכרון של המכשיר
      manifest: {
        name: 'BeautyFlow Finance',
        short_name: 'BeautyFlow',
        description: 'ניהול פיננסי חכם לעסק שלך',
        theme_color: '#e5007e', // צבע שורת המצב (Status bar) בנייד
        background_color: '#ffffff',
        display: 'standalone', // מעלים את שורת הכתובת של הדפדפן כדי שזה ייראה כמו אפליקציה אמיתית
        start_url: '/',
        lang: 'he',
        dir: 'rtl',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'], // שומר קבצים לעבודה גם ללא אינטרנט
        runtimeCaching: [
          {
            // שומר את הפונטים של גוגל בזיכרון של הטלפון לשנה שלמה (טוען מהר יותר)
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      }
    })
  ],
})