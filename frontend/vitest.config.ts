/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // テスト環境の設定
    environment: 'jsdom',

    // テストファイルのパターン
    include: ['src/**/*.test.{ts,tsx}'],

    // グローバルなセットアップファイル
    setupFiles: ['./src/test/setup.ts'],

    // カバレッジ設定
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.d.ts', 'src/main.tsx', 'src/test/**']
    },

    // グローバルなテスト関数
    globals: true,

    // タイムアウト設定（ミリ秒）
    testTimeout: 10000
  }
})
