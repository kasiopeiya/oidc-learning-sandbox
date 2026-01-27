import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 開発時のAPIプロキシ設定
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // ローカル開発用（必要に応じて変更）
        changeOrigin: true
      }
    }
  },
  build: {
    // ビルド出力ディレクトリ
    outDir: 'dist'
  }
})
