/**
 * OIDC学習サンドボックス - フロントエンドロジック
 *
 * このファイルは、OIDC認証フローにおけるフロントエンドの動作を定義します。
 * - トップ画面: 認証フローの開始（/api/auth/login へのリダイレクト）
 * - 認証成功画面: クエリパラメータからユーザー情報を取得して表示
 * - エラー画面: エラーコードに応じたメッセージを表示
 */

// ========================================
// エラーメッセージの定義
// ========================================

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
const ERROR_MESSAGES: Record<string, string> = {
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
const DEFAULT_ERROR_MESSAGE = '認証に失敗しました。もう一度お試しください。';

// ========================================
// ユーティリティ関数
// ========================================

/**
 * URLのクエリパラメータを取得する
 *
 * @param name - 取得するパラメータ名
 * @returns パラメータの値。存在しない場合はnull
 */
function getQueryParam(name: string): string | null {
  // URLSearchParams APIを使用してクエリ文字列をパース
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// ========================================
// 各ページの初期化関数
// ========================================

/**
 * トップ画面（index.html）の初期化
 *
 * 「口座作成」ボタンのクリックイベントを設定します。
 * ボタンをクリックすると、バックエンドの認可エンドポイント（/api/auth/login）に
 * リダイレクトされ、OIDC認証フローが開始されます。
 */
function initIndexPage(): void {
  // 「口座作成」ボタンの要素を取得
  const loginButton = document.getElementById('login-button');

  if (loginButton) {
    // クリックイベントリスナーを設定
    loginButton.addEventListener('click', () => {
      // バックエンドの認可エンドポイントにリダイレクト
      // このエンドポイントでstate, nonce, PKCEパラメータが生成され、
      // CognitoのAuthorization Endpointにリダイレクトされる
      window.location.href = '/api/auth/login';
    });
  }
}

/**
 * 認証成功画面（callback.html）の初期化
 *
 * バックエンドからリダイレクトされた際のクエリパラメータから
 * ユーザー情報（email, sub）を取得して画面に表示します。
 *
 * クエリパラメータ:
 * - email: ユーザーのメールアドレス（IDトークンのemail claimから取得）
 * - sub: ユーザーの一意識別子（IDトークンのsub claimから取得）
 */
function initCallbackPage(): void {
  // クエリパラメータからユーザー情報を取得
  const email = getQueryParam('email');
  const sub = getQueryParam('sub');

  // 表示要素を取得
  const emailElement = document.getElementById('user-email');
  const subElement = document.getElementById('user-sub');

  // メールアドレスを表示
  if (emailElement) {
    emailElement.textContent = email || '(未取得)';
  }

  // ユーザーIDを表示
  if (subElement) {
    subElement.textContent = sub || '(未取得)';
  }
}

/**
 * エラー画面（error.html）の初期化
 *
 * クエリパラメータからエラーコードを取得し、
 * 対応するエラーメッセージを画面に表示します。
 *
 * クエリパラメータ:
 * - error: エラーコード（state_mismatch, access_denied など）
 */
function initErrorPage(): void {
  // クエリパラメータからエラーコードを取得
  const errorCode = getQueryParam('error');

  // エラーコードに対応するメッセージを取得
  // 未定義のエラーコードの場合はデフォルトメッセージを使用
  const message = errorCode
    ? ERROR_MESSAGES[errorCode] || DEFAULT_ERROR_MESSAGE
    : DEFAULT_ERROR_MESSAGE;

  // エラーメッセージを表示
  const messageElement = document.getElementById('error-message');
  if (messageElement) {
    messageElement.textContent = message;
  }

  // デバッグ用：エラーコードも表示（学習目的）
  // 実際のプロダクション環境では表示しないことが推奨される
  const codeElement = document.getElementById('error-code');
  if (codeElement && errorCode) {
    codeElement.textContent = `エラーコード: ${errorCode}`;
  }
}

// ========================================
// ページ判定と初期化実行
// ========================================

/**
 * 現在のページに応じた初期化処理を実行
 *
 * URLのパス名から現在表示されているページを判定し、
 * 対応する初期化関数を呼び出します。
 */
function init(): void {
  // 現在のパス名を取得
  const path = window.location.pathname;

  // パス名に応じて適切な初期化関数を呼び出す
  if (path === '/' || path === '/index.html') {
    // トップ画面の初期化
    initIndexPage();
  } else if (path === '/callback.html') {
    // 認証成功画面の初期化
    initCallbackPage();
  } else if (path === '/error.html') {
    // エラー画面の初期化
    initErrorPage();
  }
}

// DOMContentLoadedイベント時に初期化を実行
// DOMの構築が完了してから初期化処理を行うことで、
// 要素が確実に存在する状態でイベントリスナーを設定できる
document.addEventListener('DOMContentLoaded', init);
