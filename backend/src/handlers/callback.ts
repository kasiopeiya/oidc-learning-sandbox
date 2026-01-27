/**
 * /api/auth/callback ハンドラー
 *
 * OP（OpenID Provider）からのコールバックを処理し、トークン交換・検証を行う。
 * openid-client ライブラリを使用して以下の検証を自動実行:
 * - State検証（CSRF攻撃対策）
 * - PKCE検証（認可コード横取り攻撃対策）
 * - IDトークン署名検証（改ざん検出）
 * - Nonce検証（リプレイ攻撃対策）
 * - 有効期限検証
 *
 * 処理フロー:
 * 1. URLパラメータからエラーまたは認可コードを取得
 * 2. CookieからセッションIDを取得
 * 3. DynamoDBからstate, nonce, code_verifierを取得
 * 4. openid-client の authorizationCodeGrant() でトークン交換・検証
 * 5. 検証成功: /callback にリダイレクト
 * 6. 検証失敗: /error?error=エラーコード にリダイレクト
 * 7. セッションデータを削除（DynamoDB + Cookie）
 */
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import * as client from 'openid-client'

import { getOidcConfig } from '../utils/oidc-config'
import {
  createSessionCookie,
  deleteSession,
  getSession,
  getSessionIdFromCookie,
  saveAuthenticatedSession
} from '../utils/session'
import { getRedirectUri } from '../utils/ssm'

/**
 * エラーコードの定義
 * フロントエンドのErrorPageコンポーネントで対応するメッセージを表示
 */
const ERROR_CODES = {
  /** セッションが見つからない（期限切れまたは未設定） */
  MISSING_SESSION: 'missing_session',
  /** State不一致（CSRF攻撃の可能性） */
  STATE_MISMATCH: 'state_mismatch',
  /** Nonce不一致（リプレイ攻撃の可能性） */
  NONCE_MISMATCH: 'nonce_mismatch',
  /** 認可コードがない */
  MISSING_CODE: 'missing_code',
  /** ユーザーがログインをキャンセル */
  ACCESS_DENIED: 'access_denied',
  /** OPからのエラー（認可コード無効など） */
  OP_ERROR: 'op_error',
  /** IDトークンの署名が無効 */
  INVALID_SIGNATURE: 'invalid_signature',
  /** IDトークンの有効期限切れ */
  TOKEN_EXPIRED: 'token_expired',
  /** ネットワークエラー */
  NETWORK_ERROR: 'network_error',
  /** その他の認証エラー */
  AUTHENTICATION_FAILED: 'authentication_failed'
} as const

/**
 * エラーページへのリダイレクトレスポンスを生成
 *
 * @param errorCode - エラーコード
 * @returns 302 リダイレクトレスポンス
 */
function redirectToError(errorCode: string): APIGatewayProxyResultV2 {
  return {
    statusCode: 302,
    headers: {
      Location: `/error?error=${errorCode}`
    },
    body: ''
  }
}

/**
 * 成功ページへのリダイレクトレスポンスを生成
 *
 * トークン交換成功後、アクセストークンはDynamoDBに保存済みのため、
 * クエリパラメータにはユーザー情報のみを含める。
 * セッションIDのCookieは口座作成API呼び出しのために維持する。
 *
 * @param sessionId - セッションID（Cookie維持用）
 * @returns 302 リダイレクトレスポンス
 */
function redirectToSuccess(sessionId: string): APIGatewayProxyResultV2 {
  // セッションCookieを再設定（口座作成API呼び出しのために維持）
  const sessionCookie = createSessionCookie(sessionId)

  return {
    statusCode: 302,
    headers: {
      Location: '/callback'
    },
    cookies: [sessionCookie],
    body: ''
  }
}

/**
 * エラーの種類からエラーコードを判定
 *
 * openid-client が投げるエラーの種類に応じて、
 * フロントエンドで表示するエラーコードを決定する。
 *
 * @param error - 発生したエラー
 * @returns エラーコード
 */
function getErrorCode(error: unknown): string {
  // AuthorizationResponseError: OPからのエラーレスポンス
  if (error instanceof client.AuthorizationResponseError) {
    const errorType = error.error
    console.log('AuthorizationResponseError', {
      error: errorType,
      description: error.error_description
    })

    // ユーザーがログインをキャンセルした場合
    if (errorType === 'access_denied') {
      return ERROR_CODES.ACCESS_DENIED
    }
    return ERROR_CODES.OP_ERROR
  }

  // ResponseBodyError: トークンエンドポイントからのエラー
  if (error instanceof client.ResponseBodyError) {
    console.log('ResponseBodyError', { error: error.error, description: error.error_description })
    return ERROR_CODES.OP_ERROR
  }

  // ClientError: クライアント側のエラー（検証失敗など）
  if (error instanceof client.ClientError) {
    const message = error.message.toLowerCase()
    console.log('ClientError', { message, code: error.code })

    if (message.includes('state')) {
      return ERROR_CODES.STATE_MISMATCH
    }
    if (message.includes('nonce')) {
      return ERROR_CODES.NONCE_MISMATCH
    }
    if (message.includes('signature') || message.includes('jwt')) {
      return ERROR_CODES.INVALID_SIGNATURE
    }
    if (message.includes('expired') || message.includes('exp')) {
      return ERROR_CODES.TOKEN_EXPIRED
    }
  }

  // TypeError/FetchError: ネットワークエラー
  if (error instanceof TypeError) {
    console.log('TypeError (likely network error)', { message: (error as Error).message })
    return ERROR_CODES.NETWORK_ERROR
  }

  // その他のエラー
  if (error instanceof Error) {
    console.log('Unknown error', { name: error.name, message: error.message })
  }

  return ERROR_CODES.AUTHENTICATION_FAILED
}

/**
 * コールバックエンドポイントのハンドラー
 *
 * OP（OpenID Provider）からのリダイレクトを受け取り、認可コードをトークンに交換する。
 * openid-client ライブラリが以下の検証を自動実行:
 * 1. State照合 - CSRF攻撃対策
 * 2. トークン交換 - 認可コードをIDトークンに交換
 * 3. PKCE検証 - code_verifier と code_challenge の照合
 * 4. JWK署名検証 - IDトークンの改ざん検出
 * 5. Nonce照合 - リプレイ攻撃対策
 * 6. 有効期限チェック - トークンの有効期限検証
 *
 * @param event - API Gateway HTTP API (v2) からのイベント
 * @returns 302 リダイレクトレスポンス（成功時: /callback、失敗時: /error）
 */
export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  console.log('Callback handler invoked', {
    path: event.rawPath,
    method: event.requestContext.http.method,
    queryParams: event.queryStringParameters
  })

  // ============================================================
  // Step 1: URLパラメータの確認
  // ============================================================

  // OPからのエラーレスポンスをチェック（ユーザーキャンセル等）
  // エラー時は ?error=access_denied&error_description=... の形式で返される
  const errorParam = event.queryStringParameters?.error
  if (errorParam) {
    console.log('OP returned error', {
      error: errorParam,
      description: event.queryStringParameters?.error_description
    })

    // ユーザーがログインをキャンセルした場合
    if (errorParam === 'access_denied') {
      return redirectToError(ERROR_CODES.ACCESS_DENIED)
    }
    return redirectToError(ERROR_CODES.OP_ERROR)
  }

  // 認可コードの存在確認
  const code = event.queryStringParameters?.code
  if (!code) {
    console.error('Missing authorization code')
    return redirectToError(ERROR_CODES.MISSING_CODE)
  }

  // ============================================================
  // Step 2: CookieからセッションIDを取得
  // ============================================================

  // Cookieヘッダーを解析してセッションIDを取得
  // HTTP API v2 では cookies 配列で送信される
  const cookieHeader = event.cookies?.join('; ') || ''
  const sessionId = getSessionIdFromCookie(cookieHeader)

  console.log('Session ID from cookie', {
    hasSessionId: !!sessionId
  })

  // セッションIDが存在しない場合はエラー
  if (!sessionId) {
    console.error('Missing session ID in cookie')
    return redirectToError(ERROR_CODES.MISSING_SESSION)
  }

  // ============================================================
  // Step 3: DynamoDBからセキュリティパラメータを取得
  // ============================================================

  let state: string
  let nonce: string
  let codeVerifier: string

  try {
    const sessionData = await getSession(sessionId)

    // セッションが存在しない場合はエラー
    // セッションの期限切れ（5分）または、別のブラウザ/タブからのアクセスが考えられる
    if (!sessionData) {
      console.error('Session not found in DynamoDB', {
        sessionId: sessionId.substring(0, 8) + '...'
      })
      return redirectToError(ERROR_CODES.MISSING_SESSION)
    }

    state = sessionData.state
    nonce = sessionData.nonce
    codeVerifier = sessionData.codeVerifier

    console.log('Session data retrieved from DynamoDB', {
      hasState: !!state,
      hasNonce: !!nonce,
      hasCodeVerifier: !!codeVerifier
    })
  } catch (error) {
    console.error('Failed to get session from DynamoDB', error)
    return redirectToError(ERROR_CODES.MISSING_SESSION)
  }

  // ============================================================
  // Step 4: OIDC Configuration の取得
  // ============================================================

  let config: client.Configuration
  try {
    // OIDC Discovery を実行して Configuration を取得
    // 共通モジュールを使用することで、OP の種類に依存しない
    config = await getOidcConfig()
  } catch (error) {
    console.error('OIDC Discovery failed', error)
    return redirectToError(ERROR_CODES.NETWORK_ERROR)
  }

  // ============================================================
  // Step 5: トークン交換と検証
  // ============================================================

  try {
    // コールバックURLを構築（認可レスポンスのパラメータを含む）
    // SSM Parameter Store から CloudFront URL を取得してリダイレクト URI を構築
    const redirectUri = await getRedirectUri()
    const callbackUrl = new URL(redirectUri)
    callbackUrl.searchParams.set('code', code)
    callbackUrl.searchParams.set('state', event.queryStringParameters?.state || '')

    console.log('Starting token exchange', {
      redirectUri,
      hasCode: !!code
    })

    // authorizationCodeGrant() で以下の処理が自動実行される:
    // 1. State照合: URLのstate と expectedState を比較
    // 2. トークンエンドポイントに認可コードを送信
    // 3. PKCE検証: code_verifier を送信し、OPが code_challenge と照合
    // 4. JWK署名検証: IDトークンの署名を公開鍵で検証
    // 5. Nonce照合: IDトークン内の nonce と expectedNonce を比較
    // 6. 有効期限チェック: exp, iat, nbf クレームを検証
    const tokenResponse = await client.authorizationCodeGrant(config, callbackUrl, {
      // State検証: Cookieに保存したstateと照合
      expectedState: state,
      // Nonce検証: IDトークン内のnonceと照合
      expectedNonce: nonce,
      // PKCE検証: code_verifierをトークンエンドポイントに送信
      pkceCodeVerifier: codeVerifier
    })

    console.log('Token exchange successful')

    // IDトークンのクレームを取得
    const claims = tokenResponse.claims()
    if (!claims) {
      console.error('No ID token claims')
      return redirectToError(ERROR_CODES.AUTHENTICATION_FAILED)
    }

    console.log('ID Token claims', {
      sub: claims.sub,
      email: claims.email,
      email_verified: claims.email_verified
    })

    // ============================================================
    // Step 6: アクセストークンをDynamoDBに保存して成功リダイレクト
    // ============================================================

    // アクセストークンを取得（UserInfoエンドポイント呼び出しに使用）
    const accessToken = tokenResponse.access_token
    if (!accessToken) {
      console.error('No access token in response')
      return redirectToError(ERROR_CODES.AUTHENTICATION_FAILED)
    }

    const email = (claims.email as string) || ''
    const sub = claims.sub

    // 認証済みセッションデータをDynamoDBに保存（認可フロー用データを上書き）
    // アクセストークンはブラウザに渡らず、DynamoDBで安全に管理される
    try {
      await saveAuthenticatedSession(sessionId, {
        accessToken,
        email,
        sub
      })
    } catch (saveError) {
      console.error('Failed to save authenticated session', saveError)
      return redirectToError(ERROR_CODES.AUTHENTICATION_FAILED)
    }

    console.log('Authentication successful, access token saved to DynamoDB')

    return redirectToSuccess(sessionId)
  } catch (error) {
    // ============================================================
    // Step 7: エラー時のセッション削除とリダイレクト
    // ============================================================

    console.error('Token exchange failed', error)

    // エラー時もセッションデータを削除（セキュリティのため）
    try {
      await deleteSession(sessionId)
    } catch (deleteError) {
      console.warn('Failed to delete session from DynamoDB on error', deleteError)
    }

    const errorCode = getErrorCode(error)
    return redirectToError(errorCode)
  }
}
