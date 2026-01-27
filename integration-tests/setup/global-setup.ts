/**
 * Playwright グローバルセットアップ
 *
 * テスト実行前に必須の環境変数とAWS認証情報を検証する。
 * いずれかの検証に失敗した場合、テストを中断してエラーメッセージを表示する。
 */
import { FullConfig } from '@playwright/test'

/**
 * 必須環境変数のリスト
 */
const REQUIRED_ENV_VARS = ['CLOUDFRONT_URL', 'USER_POOL_ID', 'USER_POOL_CLIENT_ID']

/**
 * グローバルセットアップ関数
 *
 * Playwrightのテスト実行前に呼び出される。
 * 必須環境変数とAWS認証情報の存在を検証する。
 *
 * @param config - Playwright設定オブジェクト
 */
async function globalSetup(config: FullConfig): Promise<void> {
  console.log('🔧 E2Eテスト環境を検証中...\n')

  // ステップ1: 必須環境変数の検証
  const missingVars: string[] = []

  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      missingVars.push(varName)
    }
  }

  if (missingVars.length > 0) {
    console.error('❌ 以下の必須環境変数が設定されていません:')
    missingVars.forEach((v) => console.error(`   - ${v}`))
    console.error('\n💡 以下のコマンドで環境変数を設定してください:')
    console.error('   source scripts/load-env.sh\n')
    throw new Error(`必須環境変数が不足しています: ${missingVars.join(', ')}`)
  }

  console.log('✅ 必須環境変数:')
  console.log(`   - CLOUDFRONT_URL: ${process.env.CLOUDFRONT_URL}`)
  console.log(`   - USER_POOL_ID: ${process.env.USER_POOL_ID}`)
  console.log(`   - USER_POOL_CLIENT_ID: ${process.env.USER_POOL_CLIENT_ID}`)

  // ステップ2: AWS認証情報の検証
  // AWS_PROFILE または AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY が設定されているか確認
  const hasAwsProfile = !!process.env.AWS_PROFILE
  const hasAwsKeys = !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY

  if (!hasAwsProfile && !hasAwsKeys) {
    console.warn('\n⚠️  AWS認証情報が明示的に設定されていません。')
    console.warn('   デフォルトプロファイルまたはIAMロールが使用されます。')
  } else {
    console.log('\n✅ AWS認証情報:')
    if (hasAwsProfile) {
      console.log(`   - AWS_PROFILE: ${process.env.AWS_PROFILE}`)
    } else {
      console.log('   - AWS_ACCESS_KEY_ID: ****')
    }
  }

  console.log('\n🚀 E2Eテストを開始します...\n')
}

export default globalSetup
