/**
 * Secrets Manager ユーティリティ
 *
 * AWS Secrets Manager から OIDC クライアント情報を取得する。
 * Lambda のウォームスタート時にキャッシュすることで、
 * Secrets Manager API の呼び出しを削減する。
 */
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager'

/**
 * Secrets Manager クライアント（Lambda コンテナで再利用）
 */
const client = new SecretsManagerClient({})

/**
 * キャッシュされたシークレット値
 *
 * Lambda のウォームスタート時に再利用することで、
 * Secrets Manager の API 呼び出しを削減する。
 */
const secretCache: Map<string, string> = new Map()

/**
 * Secrets Manager からシークレットを取得
 *
 * @param secretName - シークレット名
 * @returns シークレット値
 * @throws 取得に失敗した場合
 */
async function getSecret(secretName: string): Promise<string> {
  // キャッシュにある場合はそれを返す
  const cached = secretCache.get(secretName)
  if (cached) {
    return cached
  }

  console.log('Fetching secret from Secrets Manager', { secretName })

  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
      })
    )

    if (!response.SecretString) {
      throw new Error(`Secret value is empty: ${secretName}`)
    }

    // キャッシュに保存
    secretCache.set(secretName, response.SecretString)

    console.log('Secret fetched and cached', { secretName })

    return response.SecretString
  } catch (error) {
    console.error('Failed to fetch secret from Secrets Manager', {
      secretName,
      error,
    })
    throw error
  }
}

/**
 * Secrets Manager から OIDC Client ID を取得
 *
 * 環境変数 OIDC_CLIENT_ID_KEY に設定されたシークレット名を使用して取得する。
 *
 * @returns Client ID
 * @throws 環境変数が設定されていない場合、または取得に失敗した場合
 */
export async function getClientId(): Promise<string> {
  const secretName = process.env.OIDC_CLIENT_ID_KEY

  if (!secretName) {
    throw new Error('OIDC_CLIENT_ID_KEY environment variable is not set')
  }

  return getSecret(secretName)
}

/**
 * Secrets Manager から OIDC Client Secret を取得
 *
 * 環境変数 OIDC_CLIENT_SECRET_KEY に設定されたシークレット名を使用して取得する。
 *
 * @returns Client Secret
 * @throws 環境変数が設定されていない場合、または取得に失敗した場合
 */
export async function getClientSecret(): Promise<string> {
  const secretName = process.env.OIDC_CLIENT_SECRET_KEY

  if (!secretName) {
    throw new Error('OIDC_CLIENT_SECRET_KEY environment variable is not set')
  }

  return getSecret(secretName)
}

/**
 * キャッシュをクリア（テスト用）
 */
export function clearSecretCache(): void {
  secretCache.clear()
}
