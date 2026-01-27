/**
 * Cognito Admin API ユーティリティ
 *
 * E2Eテスト用のテストユーザーを管理するためのユーティリティ関数群
 * - テストユーザーの作成（メール確認をスキップ）
 * - テストユーザーの削除
 * - ユニークなテストメールアドレスの生成
 */
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminDeleteUserCommand,
  AdminInitiateAuthCommand,
  AuthFlowType
} from '@aws-sdk/client-cognito-identity-provider'

// Cognito Identity Provider クライアントの初期化
const client = new CognitoIdentityProviderClient({
  region: 'ap-northeast-1'
})

/**
 * テストユーザーを作成する
 *
 * Cognito Admin API を使用して、メール確認をスキップしたテストユーザーを作成する。
 * 1. AdminCreateUserCommand でユーザーを作成（確認メール送信なし）
 * 2. AdminSetUserPasswordCommand でパスワードを永続的に設定
 *
 * @param email - テストユーザーのメールアドレス
 * @param password - テストユーザーのパスワード
 */
export async function createTestUser(email: string, password: string): Promise<void> {
  const userPoolId = process.env.USER_POOL_ID

  if (!userPoolId) {
    throw new Error('USER_POOL_ID 環境変数が設定されていません')
  }

  // ステップ1: ユーザーを作成（確認メール送信をスキップ）
  // MessageAction: 'SUPPRESS' により、ウェルカムメールを送信しない
  await client.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: email,
      MessageAction: 'SUPPRESS',
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' }
      ]
    })
  )

  // ステップ2: パスワードを永続的に設定
  // Permanent: true により、初回ログイン時のパスワード変更をスキップ
  await client.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: email,
      Password: password,
      Permanent: true
    })
  )
}

/**
 * テストユーザーを削除する
 *
 * テスト終了後のクリーンアップ用。
 * 削除に失敗しても例外をスローしない（既に削除されている場合など）。
 *
 * @param email - 削除するテストユーザーのメールアドレス
 */
export async function deleteTestUser(email: string): Promise<void> {
  const userPoolId = process.env.USER_POOL_ID

  if (!userPoolId) {
    throw new Error('USER_POOL_ID 環境変数が設定されていません')
  }

  try {
    await client.send(
      new AdminDeleteUserCommand({
        UserPoolId: userPoolId,
        Username: email
      })
    )
  } catch (error) {
    // ユーザーが存在しない場合などはエラーを無視
    console.warn(`テストユーザーの削除に失敗しました: ${email}`, error)
  }
}

/**
 * ユニークなテストメールアドレスを生成する
 *
 * タイムスタンプとランダム文字列を組み合わせて、
 * 各テスト実行で一意のメールアドレスを生成する。
 *
 * @returns 生成されたテストメールアドレス
 */
export function generateTestEmail(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `e2e-test-${timestamp}-${random}@example.com`
}

/**
 * 認証結果の型定義
 */
export interface AuthResult {
  /** ユーザーID（sub） */
  sub: string
  /** メールアドレス */
  email: string
  /** IDトークン */
  idToken: string
  /** アクセストークン */
  accessToken: string
}

/**
 * テストユーザーを認証する
 *
 * Cognito Admin API の AdminInitiateAuth を使用して、
 * Hosted UI をバイパスしてプログラマティックに認証を行う。
 *
 * @param email - テストユーザーのメールアドレス
 * @param password - テストユーザーのパスワード
 * @returns 認証結果（sub, email, トークン）
 */
export async function authenticateTestUser(email: string, password: string): Promise<AuthResult> {
  const userPoolId = process.env.USER_POOL_ID
  const clientId = process.env.USER_POOL_CLIENT_ID

  if (!userPoolId) {
    throw new Error('USER_POOL_ID 環境変数が設定されていません')
  }
  if (!clientId) {
    throw new Error('USER_POOL_CLIENT_ID 環境変数が設定されていません')
  }

  // AdminInitiateAuth を使用して認証
  // ADMIN_USER_PASSWORD_AUTH フローにより、Hosted UI をバイパス
  const response = await client.send(
    new AdminInitiateAuthCommand({
      UserPoolId: userPoolId,
      ClientId: clientId,
      AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    })
  )

  if (!response.AuthenticationResult?.IdToken) {
    throw new Error('認証に失敗しました: IDトークンが取得できません')
  }

  const idToken = response.AuthenticationResult.IdToken
  const accessToken = response.AuthenticationResult.AccessToken!

  // IDトークンをデコードしてユーザー情報を取得
  // 注意: テスト用のため署名検証はスキップ（JWTの構造のみ利用）
  const payload = decodeJwtPayload(idToken)

  return {
    sub: payload.sub,
    email: payload.email,
    idToken,
    accessToken
  }
}

/**
 * JWTのペイロードをデコードする
 *
 * @param token - JWTトークン
 * @returns デコードされたペイロード
 */
function decodeJwtPayload(token: string): { sub: string; email: string } {
  // JWTは「ヘッダー.ペイロード.署名」の形式
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('無効なJWTトークン形式です')
  }

  // ペイロード部分をBase64URLデコード
  const payload = parts[1]
  const decoded = Buffer.from(payload, 'base64url').toString('utf-8')

  return JSON.parse(decoded)
}
