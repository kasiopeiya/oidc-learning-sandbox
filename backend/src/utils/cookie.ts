/**
 * Cookie操作ユーティリティ
 *
 * OIDC認可コードフローで使用するCookieの生成・解析を行う。
 * セキュアなCookie設定（HttpOnly, Secure, SameSite=Lax）を適用する。
 */

/**
 * Cookie名の定数定義
 * OIDC認可コードフローで使用する3つのセキュリティパラメータを保存
 */
export const COOKIE_NAMES = {
  /** CSRF攻撃対策用のstate値 */
  STATE: 'oidc_state',
  /** リプレイ攻撃対策用のnonce値 */
  NONCE: 'oidc_nonce',
  /** 認可コード横取り攻撃対策用のcode_verifier（PKCE） */
  CODE_VERIFIER: 'oidc_code_verifier'
} as const

/** Cookieの有効期限（秒）: 10分 */
const COOKIE_MAX_AGE = 600

/**
 * Cookie設定のオプション
 */
interface CookieOptions {
  /** Cookie名 */
  name: string
  /** Cookie値 */
  value: string
  /** 有効期限（秒）。省略時はCOOKIE_MAX_AGE（600秒）を使用 */
  maxAge?: number
}

/**
 * セキュアなSet-Cookieヘッダー値を生成する
 *
 * 以下のセキュリティ属性を付与:
 * - HttpOnly: JavaScriptからのアクセスを防止（XSS対策）
 * - Secure: HTTPS通信でのみ送信
 * - SameSite=Lax: クロスサイトリクエストでのCookie送信を制限（CSRF対策）
 * - Path=/: すべてのパスで有効
 *
 * @param options - Cookie設定オプション
 * @returns Set-Cookieヘッダーに設定する文字列
 */
export function createSecureCookie(options: CookieOptions): string {
  const { name, value, maxAge = COOKIE_MAX_AGE } = options

  // Cookieの各属性を配列で構築し、セミコロン区切りで結合
  const attributes = [
    `${name}=${value}`,
    `Max-Age=${maxAge}`,
    'HttpOnly', // JavaScriptからアクセス不可
    'Secure', // HTTPS接続でのみ送信
    'SameSite=Lax', // トップレベルナビゲーションからのPOST以外でクロスサイト送信を制限
    'Path=/' // すべてのパスで有効
  ]

  return attributes.join('; ')
}

/**
 * OIDC認証用の3つのCookieを一括で生成する
 *
 * 生成されるCookie:
 * 1. oidc_state: CSRF攻撃対策
 * 2. oidc_nonce: リプレイ攻撃対策
 * 3. oidc_code_verifier: 認可コード横取り攻撃対策（PKCE）
 *
 * @param state - 認可リクエストで使用するstate値
 * @param nonce - IDトークンに埋め込まれるnonce値
 * @param codeVerifier - PKCEのcode_verifier値
 * @returns Set-Cookieヘッダー値の配列
 */
export function createOidcCookies(state: string, nonce: string, codeVerifier: string): string[] {
  return [
    createSecureCookie({ name: COOKIE_NAMES.STATE, value: state }),
    createSecureCookie({ name: COOKIE_NAMES.NONCE, value: nonce }),
    createSecureCookie({ name: COOKIE_NAMES.CODE_VERIFIER, value: codeVerifier })
  ]
}

/**
 * Cookieを削除するためのSet-Cookieヘッダー値を生成する
 *
 * Max-Age=0を設定することで、ブラウザにCookieの削除を指示する。
 * 認証完了後やエラー発生時にセキュリティパラメータをクリアするために使用。
 *
 * @param name - 削除するCookie名
 * @returns Set-Cookieヘッダーに設定する文字列
 */
export function createDeleteCookie(name: string): string {
  const attributes = [`${name}=`, 'Max-Age=0', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']

  return attributes.join('; ')
}

/**
 * OIDC認証用の3つのCookieを一括削除するヘッダー値を生成する
 *
 * @returns Set-Cookieヘッダー値の配列
 */
export function createDeleteOidcCookies(): string[] {
  return [
    createDeleteCookie(COOKIE_NAMES.STATE),
    createDeleteCookie(COOKIE_NAMES.NONCE),
    createDeleteCookie(COOKIE_NAMES.CODE_VERIFIER)
  ]
}

/**
 * Cookie文字列をパースしてオブジェクトに変換する
 *
 * @param cookieHeader - Cookieヘッダーの値（例: "name1=value1; name2=value2"）
 * @returns Cookie名と値のマップ
 */
export function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {}

  if (!cookieHeader) {
    return cookies
  }

  // セミコロンで分割して各Cookie項目を処理
  cookieHeader.split(';').forEach((cookie) => {
    // 最初の「=」で名前と値を分割（値に「=」が含まれる場合を考慮）
    const [name, ...rest] = cookie.split('=')
    const trimmedName = name.trim()

    if (trimmedName) {
      // URLエンコードされた値をデコード
      cookies[trimmedName] = decodeURIComponent(rest.join('='))
    }
  })

  return cookies
}
