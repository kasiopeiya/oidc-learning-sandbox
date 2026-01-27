/**
 * SSM Parameter Store ユーティリティ
 *
 * SSM Parameter Store からパラメータを取得し、キャッシュする。
 * Lambda のウォームスタート時に再利用することで、SSM API 呼び出しを削減する。
 */
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'

// SSM クライアントのインスタンス（Lambda 実行間で再利用）
const ssmClient = new SSMClient({})

// パラメータキャッシュ（パラメータ名 → 値）
const parameterCache = new Map<string, string>()

/**
 * SSM Parameter Store からパラメータを取得
 *
 * 一度取得した値はキャッシュされ、Lambda のウォームスタート時に再利用される。
 *
 * @param parameterName - SSM パラメータ名（例: /oidc-sandbox/cloudfront-url）
 * @returns パラメータの値
 * @throws パラメータが存在しない場合、または取得に失敗した場合
 */
export async function getParameter(parameterName: string): Promise<string> {
  // キャッシュから取得を試みる
  const cached = parameterCache.get(parameterName)
  if (cached) {
    console.log('SSM parameter cache hit', { parameterName })
    return cached
  }

  console.log('Fetching SSM parameter', { parameterName })

  // SSM API からパラメータを取得
  const command = new GetParameterCommand({
    Name: parameterName
  })

  const response = await ssmClient.send(command)

  // パラメータが存在しない場合はエラー
  if (!response.Parameter?.Value) {
    throw new Error(`SSM parameter not found: ${parameterName}`)
  }

  const value = response.Parameter.Value

  // キャッシュに保存
  parameterCache.set(parameterName, value)

  console.log('SSM parameter fetched and cached', { parameterName })

  return value
}

/**
 * CloudFront URL を取得
 *
 * 環境変数 SSM_CLOUDFRONT_URL_PARAM に設定されたパラメータ名を使用して、
 * SSM Parameter Store から CloudFront URL を取得する。
 *
 * @returns CloudFront URL（例: https://xxxx.cloudfront.net）
 * @throws 環境変数が設定されていない場合、またはパラメータ取得に失敗した場合
 */
export async function getCloudFrontUrl(): Promise<string> {
  // 環境変数からパラメータ名を取得
  const paramName = process.env.SSM_CLOUDFRONT_URL_PARAM
  if (!paramName) {
    throw new Error('SSM_CLOUDFRONT_URL_PARAM environment variable is not set')
  }

  return getParameter(paramName)
}

/**
 * REDIRECT_URI を取得
 *
 * CloudFront URL に /api/auth/callback を付加した値を返す。
 *
 * @returns REDIRECT_URI（例: https://xxxx.cloudfront.net/api/auth/callback）
 */
export async function getRedirectUri(): Promise<string> {
  const cloudFrontUrl = await getCloudFrontUrl()
  return `${cloudFrontUrl}/api/auth/callback`
}

/**
 * キャッシュをクリア（テスト用）
 */
export function clearParameterCache(): void {
  parameterCache.clear()
}
