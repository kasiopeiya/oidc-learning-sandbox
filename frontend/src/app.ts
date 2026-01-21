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
 * 口座作成APIのレスポンス型
 */
interface AccountResponse {
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
interface ErrorResponse {
  /** エラーメッセージ */
  error: string;
  /** エラーコード */
  code: string;
}

/**
 * 口座作成APIを呼び出す
 *
 * アクセストークンはDynamoDBに保存されており、CookieのセッションIDで紐付けられる。
 * ブラウザにはアクセストークンが渡らないセキュアな実装。
 *
 * @returns 口座情報（成功時）またはエラー（失敗時）
 */
async function createAccount(): Promise<AccountResponse | ErrorResponse> {
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

/**
 * 認証成功画面（callback.html）の初期化
 *
 * ページロード時に口座作成APIを自動呼び出しし、
 * 口座番号とユーザー情報を画面に表示します。
 *
 * フロー:
 * 1. 口座作成API（/api/account）をPOSTで呼び出し
 * 2. APIがCookieのセッションIDからアクセストークンを取得
 * 3. UserInfoエンドポイントでトークンを検証
 * 4. 口座番号を生成して返却
 * 5. 画面に口座番号とユーザー情報を表示
 */
async function initCallbackPage(): Promise<void> {
  // 表示要素を取得
  const emailElement = document.getElementById('user-email');
  const subElement = document.getElementById('user-sub');
  const accountStatusElement = document.getElementById('account-status');
  const accountInfoElement = document.getElementById('account-info');
  const accountNumberElement = document.getElementById('account-number');
  const accountErrorElement = document.getElementById('account-error');

  try {
    // 口座作成APIを呼び出し
    const result = await createAccount();

    // エラーレスポンスの場合
    if ('error' in result) {
      console.error('Account creation failed', result);

      // ローディング表示を非表示
      if (accountStatusElement) {
        accountStatusElement.style.display = 'none';
      }

      // エラーメッセージを表示
      if (accountErrorElement) {
        accountErrorElement.textContent = result.error;
        accountErrorElement.style.display = 'block';
      }

      // ユーザー情報はエラー時も表示できない
      if (emailElement) {
        emailElement.textContent = '(取得失敗)';
      }
      if (subElement) {
        subElement.textContent = '(取得失敗)';
      }

      return;
    }

    // 成功時: ユーザー情報を表示
    if (emailElement) {
      emailElement.textContent = result.email || '(未取得)';
    }
    if (subElement) {
      subElement.textContent = result.sub || '(未取得)';
    }

    // ローディング表示を非表示
    if (accountStatusElement) {
      accountStatusElement.style.display = 'none';
    }

    // 口座情報を表示
    if (accountInfoElement) {
      accountInfoElement.style.display = 'block';
    }
    if (accountNumberElement) {
      accountNumberElement.textContent = result.accountNumber;
    }

    console.log('Account created successfully', {
      accountNumber: result.accountNumber.substring(0, 4) + '******',
    });

  } catch (error) {
    console.error('Failed to call account API', error);

    // ローディング表示を非表示
    if (accountStatusElement) {
      accountStatusElement.style.display = 'none';
    }

    // エラーメッセージを表示
    if (accountErrorElement) {
      accountErrorElement.textContent = '口座作成に失敗しました。もう一度お試しください。';
      accountErrorElement.style.display = 'block';
    }

    // ユーザー情報はエラー時も表示できない
    if (emailElement) {
      emailElement.textContent = '(取得失敗)';
    }
    if (subElement) {
      subElement.textContent = '(取得失敗)';
    }
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
