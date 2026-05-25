import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['baeknyeon.json'],
      manifest: {
        name: '단이의 맛집지도',
        short_name: '맛집지도',
        description: '단이님이 직접 큐레이션한 맛집과 백년가게 모음',
        theme_color: '#FF6B35',
        background_color: '#FFFFFF',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🗺️</text></svg>',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        // 정적 자산은 빌드 결과를 precache
        globPatterns: ['**/*.{js,css,html,svg,json}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          // Supabase REST API: StaleWhileRevalidate (1시간 캐시)
          // 첫 호출 후 1시간 동안은 캐시 응답 즉시 반환 + 백그라운드 갱신
          {
            urlPattern: /^https:\/\/arxpepynyenotpgjkazq\.supabase\.co\/rest\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'supabase-api-v1',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60, // 1시간
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 네이버 지도 SDK
          {
            urlPattern: /^https:\/\/oapi\.map\.naver\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'naver-maps-sdk-v1',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30일
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 네이버 정적 자원 (이미지 등)
          {
            urlPattern: /^https:\/\/.*\.naver\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'naver-static-v1',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7일
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // /baeknyeon.json (자기 도메인의 정적 JSON)
          {
            urlPattern: /\/baeknyeon\.json$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'baeknyeon-json-v1',
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7일
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
