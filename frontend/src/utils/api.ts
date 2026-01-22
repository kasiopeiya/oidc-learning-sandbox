/**
 * API呼び出しユーティリティ
 *
 * バックエンドAPIとの通信を行うユーティリティ関数を提供します。
 */

/**
 * 口座作成APIのレスポンス型
 */
export interface AccountResponse {
  /** 生成された口座番号 */
  accountNumber: string;
  /** ユーザーのメールアドレス */
  email: string;
  /** ユーザーの一意識別子 */
  sub: string;
}

/**
 * APIエラーレスポンス型
 */
export interface ErrorResponse {
  /** エラーメッセージ */
  error: string;
  /** エラーコード */
  code: string;
}

/**
 * エラーコードと表示メッセージの対応表
 *
 * OIDC認証フローで発生する可能性のあるエラーを定義しています。
 * - missing_session: セッションが見つからない（期限切れまたは未設定）
 * - state_mismatch: CSRF対策用のstateパラメータが一致しない
 * - nonce_mismatch: リプレイ攻撃対策用のnonceが一致しない
 * - missing_code: 認可コードがレスポンスに含まれていない
 * - access_denied: ユーザーが認証をキャンセルした
 * - op_error: OPサーバー（Cognito）側でエラーが発生
 * - invalid_signature: IDトークンの署名検証に失敗
 * - token_expired: IDトークンの有効期限切れ
 * - network_error: OPサーバーとの通信エラー
 */
export const ERROR_MESSAGES: Record<string, string> = {
  missing_session: 'セッションが見つかりません。もう一度お試しください。',
  state_mismatch: 'セッションが無効です。もう一度お試しください。',
  nonce_mismatch: 'セッションが無効です。もう一度お試しください。',
  missing_code: '認証情報が見つかりません。',
  access_denied: '認証がキャンセルされました。',
  op_error: '認証サーバーでエラーが発生しました。',
  invalid_signature: '認証情報が不正です。',
  token_expired: '認証の有効期限が切れました。もう一度お試しください。',
  network_error: '認証サーバーとの通信に失敗しました。',
};

/** 未定義のエラーコードに対するデフォルトメッセージ */
export const DEFAULT_ERROR_MESSAGE =
  '認証に失敗しました。もう一度お試しください。';

/**
 * エラーコードからエラーメッセージを取得
 *
 * @param errorCode - エラーコード
 * @returns エラーメッセージ
 */
export function getErrorMessage(errorCode: string | null): string {
  // エラーコードがnullまたは未定義の場合はデフォルトメッセージ
  if (!errorCode) {
    return DEFAULT_ERROR_MESSAGE;
  }

  // エラーコードに対応するメッセージを返す
  return ERROR_MESSAGES[errorCode] || DEFAULT_ERROR_MESSAGE;
}

/**
 * 口座作成APIを呼び出す
 *
 * アクセストークンはDynamoDBに保存されており、CookieのセッションIDで紐付けられる。
 * ブラウザにはアクセストークンが渡らないセキュアな実装。
 *
 * @returns 口座情報（成功時）またはエラー（失敗時）
 */
export async function createAccount(): Promise<
  AccountResponse | ErrorResponse
> {
  // 口座作成APIを呼び出し
  // CookieのセッションIDが自動的に送信される
  const response = await fetch('/api/account', {
    method: 'POST',
    credentials: 'include', // Cookieを送信するために必要
  });

  // JSONレスポンスをパース
  const data = await response.json();

  // エラーレスポンスの場合
  if (!response.ok) {
    return data as ErrorResponse;
  }

  return data as AccountResponse;
}
