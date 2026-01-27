import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright設定ファイル
 *
 * OIDC認証フローのE2Eテスト用設定
 * - 学習用途のため、Chromiumブラウザのみ使用
 * - Cognito画面のロード待ちを考慮したタイムアウト設定
 */
export default defineConfig({
  // テストディレクトリ
  testDir: './tests',

  // テスト結果の並列実行設定（認証フローのため直列実行を推奨）
  fullyParallel: false,

  // CI環境での失敗時リトライを無効化
  forbidOnly: !!process.env.CI,

  // リトライ回数
  retries: process.env.CI ? 2 : 0,

  // ワーカー数（認証フローのため1つに制限）
  workers: 1,

  // レポーター設定
  reporter: 'html',

  // グローバルセットアップ（環境変数の検証）
  globalSetup: './setup/global-setup.ts',

  // 共通設定
  use: {
    // CloudFrontのURL（環境変数から取得）
    baseURL: process.env.CLOUDFRONT_URL,

    // トレース記録（失敗時のみ）
    trace: 'on-first-retry',

    // スクリーンショット（失敗時のみ）
    screenshot: 'only-on-failure'
  },

  // テストタイムアウト（Cognito画面のロード待ちを考慮）
  timeout: 30000,

  // expect のタイムアウト
  expect: {
    timeout: 10000
  },

  // プロジェクト設定（Chromiumのみ）
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
