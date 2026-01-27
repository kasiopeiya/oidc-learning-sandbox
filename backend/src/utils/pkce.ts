/**
 * PKCE（Proof Key for Code Exchange）ユーティリティ
 *
 * RFC 7636 に準拠したPKCE実装を提供する。
 * 認可コード横取り攻撃を防ぐため、code_verifier と code_challenge を生成する。
 *
 * また、OIDC認可コードフローで使用する state と nonce の生成機能も提供する。
 */
import * as crypto from 'crypto'

/** ランダム文字列の長さ（バイト数）: 32バイト = 256ビット */
const RANDOM_BYTES_LENGTH = 32

/**
 * 暗号論的に安全なランダム文字列を生成する
 *
 * Node.jsの crypto.randomBytes を使用して、暗号論的に安全な乱数を生成。
 * Base64URL エンコーディングにより、URLセーフな文字列に変換する。
 *
 * Base64URL形式:
 * - 標準のBase64から「+」を「-」に、「/」を「_」に置換
 * - パディング「=」を削除
 * これにより、URLのクエリパラメータやCookieで安全に使用できる。
 *
 * @returns 43文字のBase64URLエンコードされたランダム文字列
 */
export function generateRandomString(): string {
  // 32バイト（256ビット）の暗号論的に安全なランダムバイト列を生成
  const buffer = crypto.randomBytes(RANDOM_BYTES_LENGTH)

  // Base64URLエンコーディング
  // 1. Base64に変換
  // 2. 「+」→「-」、「/」→「_」に置換（URLセーフ化）
  // 3. パディング「=」を削除
  return buffer.toString('base64url')
}

/**
 * CSRF攻撃対策用のstate値を生成する
 *
 * stateの役割:
 * - 認可リクエストとコールバックを紐付ける一意の識別子
 * - 攻撃者が自分の認可コードで被害者のセッションに紐付けようとする攻撃を防ぐ
 *
 * 検証フロー:
 * 1. 認可リクエスト時にstateを生成し、Cookieに保存
 * 2. Cognitoにstateを含めて認可リクエストを送信
 * 3. コールバック時にURLパラメータのstateとCookieのstateを比較
 * 4. 一致しない場合は攻撃の可能性があるため拒否
 *
 * @returns 暗号論的に安全なstate値
 */
export function generateState(): string {
  return generateRandomString()
}

/**
 * リプレイ攻撃対策用のnonce値を生成する
 *
 * nonceの役割:
 * - IDトークンと認可リクエストを紐付ける一意の識別子
 * - 過去に発行されたIDトークンの再利用（リプレイ攻撃）を防ぐ
 *
 * 検証フロー:
 * 1. 認可リクエスト時にnonceを生成し、Cookieに保存
 * 2. Cognitoにnonceを含めて認可リクエストを送信
 * 3. CognitoはIDトークンの claims にnonceを埋め込む
 * 4. コールバック時にIDトークンのnonceとCookieのnonceを比較
 * 5. 一致しない場合は盗まれたIDトークンの可能性があるため拒否
 *
 * @returns 暗号論的に安全なnonce値
 */
export function generateNonce(): string {
  return generateRandomString()
}

/**
 * PKCEのcode_verifierを生成する
 *
 * code_verifierの役割:
 * - 認可コードをトークンに交換する際の「鍵」
 * - 認可コードを横取りした攻撃者がトークンを取得することを防ぐ
 *
 * RFC 7636 仕様:
 * - 43〜128文字のランダム文字列
 * - 使用可能文字: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
 *
 * 本実装では32バイト（256ビット）のランダム値をBase64URLエンコードし、
 * 43文字の文字列を生成する。
 *
 * @returns 暗号論的に安全なcode_verifier値
 */
export function generateCodeVerifier(): string {
  return generateRandomString()
}

/**
 * code_verifier から code_challenge を計算する
 *
 * code_challengeの役割:
 * - code_verifierのハッシュ値（「鍵穴」）
 * - 認可リクエスト時にOPに送信し、OPがcode_verifierと対応付けを保持
 *
 * 計算方法（S256方式）:
 * 1. code_verifier を SHA256 でハッシュ化
 * 2. ハッシュ値を Base64URL エンコード
 *
 * 検証フロー:
 * 1. 認可リクエスト時にcode_challengeをOPに送信
 * 2. OPはcode_challengeを認可コードに紐付けて保存
 * 3. トークン交換時にcode_verifierを送信
 * 4. OPはcode_verifierからcode_challengeを再計算
 * 5. 保存していたcode_challengeと一致するか検証
 * 6. 一致しない場合は認可コードを横取りした攻撃者の可能性があるため拒否
 *
 * @param codeVerifier - code_verifier値
 * @returns SHA256ハッシュをBase64URLエンコードしたcode_challenge値
 */
export function generateCodeChallenge(codeVerifier: string): string {
  // SHA256ハッシュを計算
  const hash = crypto.createHash('sha256').update(codeVerifier).digest()

  // Base64URLエンコード
  return hash.toString('base64url')
}

/**
 * OIDC認可リクエストに必要なセキュリティパラメータを一括生成する
 *
 * 生成されるパラメータ:
 * 1. state: CSRF攻撃対策
 * 2. nonce: リプレイ攻撃対策
 * 3. codeVerifier: 認可コード横取り攻撃対策（Cookie保存用）
 * 4. codeChallenge: 認可コード横取り攻撃対策（認可リクエスト送信用）
 *
 * @returns セキュリティパラメータのセット
 */
export function generateOidcSecurityParams(): {
  state: string
  nonce: string
  codeVerifier: string
  codeChallenge: string
} {
  const state = generateState()
  const nonce = generateNonce()
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)

  return {
    state,
    nonce,
    codeVerifier,
    codeChallenge
  }
}
