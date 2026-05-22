import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // 로컬 개발 시 `vercel dev` 사용 권장 (api/ 서버리스 함수 포함)
    // vercel dev 미사용 시 아래 프록시로 별도 로컬 서버에 연결
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
