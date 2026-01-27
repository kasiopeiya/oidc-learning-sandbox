import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // テスト環境の設定
    environment: 'node',

    // テストファイルのパターン
    include: ['src/**/*.test.ts'],

    // カバレッジ設定
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts']
    },

    // グローバルなセットアップ
    globals: true,

    // タイムアウト設定（ミリ秒）
    testTimeout: 10000
  }
})
