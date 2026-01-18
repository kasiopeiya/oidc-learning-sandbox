# フロントエンド設計書

## 1. 概要

本ドキュメントは、OIDC学習サンドボックスのフロントエンド（S3配置の静的ファイル）の設計を定義します。

### 1.1 フロントエンドの役割

- ユーザーに認証フローの開始点（「口座作成」ボタン）を提供する
- 認証結果（成功・エラー）を画面に表示する

### 1.2 技術スタック

| 項目 | 選定 |
|------|------|
| 言語 | TypeScript |
| フレームワーク | なし（Vanilla） |
| スタイル | 最小限のCSS |
| ビルドツール | esbuild |
| 配置先 | S3 + CloudFront |

---

## 2. 画面一覧

| 画面 | ファイル | URL | 説明 |
|------|---------|-----|------|
| トップ画面 | `index.html` | `/` | 「口座作成」ボタンを表示 |
| 認証成功画面 | `callback.html` | `/callback.html?email=xxx&sub=xxx` | ユーザー情報を表示 |
| エラー画面 | `error.html` | `/error.html?error=xxx` | エラーメッセージを表示 |

---

## 3. 画面詳細

### 3.1 トップ画面（index.html）

#### 表示内容

- アプリケーションタイトル
- 「口座作成」ボタン

#### 動作

1. 「口座作成」ボタンをクリック
2. `/api/auth/login` にリダイレクト
3. バックエンドが認可URLを生成し、Cognitoにリダイレクト

#### ワイヤーフレーム

```
+----------------------------------+
|                                  |
|     OIDC学習サンドボックス         |
|                                  |
|     銀行口座を作成するには        |
|     認証が必要です               |
|                                  |
|       [ 口座作成 ]               |
|                                  |
+----------------------------------+
```

### 3.2 認証成功画面（callback.html）

#### 表示内容

- 成功メッセージ
- ユーザー情報（メールアドレス、ユーザーID）
- トップへ戻るリンク

#### 動作

1. URLのクエリパラメータから `email`, `sub` を取得
2. 画面にユーザー情報を表示

#### ワイヤーフレーム

```
+----------------------------------+
|                                  |
|     ✓ 認証成功                   |
|                                  |
|     メールアドレス: user@example.com
|     ユーザーID: abc-123-def      |
|                                  |
|     → トップへ戻る               |
|                                  |
+----------------------------------+
```

### 3.3 エラー画面（error.html）

#### 表示内容

- エラーメッセージ
- トップへ戻るリンク

#### 動作

1. URLのクエリパラメータから `error` を取得
2. エラーコードに対応するメッセージを表示

#### エラーコードとメッセージの対応

| エラーコード | 表示メッセージ |
|-------------|---------------|
| `state_mismatch` | セッションが無効です。もう一度お試しください。 |
| `nonce_mismatch` | セッションが無効です。もう一度お試しください。 |
| `missing_code` | 認証情報が見つかりません。 |
| `access_denied` | 認証がキャンセルされました。 |
| `op_error` | 認証サーバーでエラーが発生しました。 |
| `invalid_signature` | 認証情報が不正です。 |
| `token_expired` | 認証の有効期限が切れました。もう一度お試しください。 |
| `network_error` | 認証サーバーとの通信に失敗しました。 |
| その他 | 認証に失敗しました。もう一度お試しください。 |

#### ワイヤーフレーム

```
+----------------------------------+
|                                  |
|     ✗ エラー                     |
|                                  |
|     セッションが無効です。        |
|     もう一度お試しください。       |
|                                  |
|     → トップへ戻る               |
|                                  |
+----------------------------------+
```

---

## 4. 実装詳細

### 4.1 ディレクトリ構成

```
frontend/
├── public/
│   ├── index.html              # トップ画面
│   ├── callback.html           # 認証成功画面
│   └── error.html              # エラー画面
├── src/
│   └── app.ts                  # アプリケーションロジック
├── dist/                       # ビルド成果物（S3にデプロイ）
├── package.json
├── tsconfig.json
└── esbuild.config.js           # esbuild設定（オプション）
```

### 4.2 ビルド成果物

`npm run build` 実行後、`dist/` ディレクトリに以下が生成されます。

```
dist/
├── index.html
├── callback.html
├── error.html
└── js/
    └── app.js                  # トランスパイルされたJS
```

### 4.3 app.ts の実装

```typescript
/**
 * OIDC学習サンドボックス - フロントエンドロジック
 */

// ========================================
// エラーメッセージの定義
// ========================================
const ERROR_MESSAGES: Record<string, string> = {
  state_mismatch: 'セッションが無効です。もう一度お試しください。',
  nonce_mismatch: 'セッションが無効です。もう一度お試しください。',
  missing_code: '認証情報が見つかりません。',
  access_denied: '認証がキャンセルされました。',
  op_error: '認証サーバーでエラーが発生しました。',
  invalid_signature: '認証情報が不正です。',
  token_expired: '認証の有効期限が切れました。もう一度お試しください。',
  network_error: '認証サーバーとの通信に失敗しました。',
};

const DEFAULT_ERROR_MESSAGE = '認証に失敗しました。もう一度お試しください。';

// ========================================
// ユーティリティ関数
// ========================================

/**
 * URLのクエリパラメータを取得する
 */
function getQueryParam(name: string): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// ========================================
// 各ページの初期化関数
// ========================================

/**
 * トップ画面の初期化
 * - 「口座作成」ボタンのクリックイベントを設定
 */
function initIndexPage(): void {
  const loginButton = document.getElementById('login-button');
  if (loginButton) {
    loginButton.addEventListener('click', () => {
      // バックエンドの認可エンドポイントにリダイレクト
      window.location.href = '/api/auth/login';
    });
  }
}

/**
 * 認証成功画面の初期化
 * - クエリパラメータからユーザー情報を取得して表示
 */
function initCallbackPage(): void {
  const email = getQueryParam('email');
  const sub = getQueryParam('sub');

  const emailElement = document.getElementById('user-email');
  const subElement = document.getElementById('user-sub');

  if (emailElement) {
    emailElement.textContent = email || '(未取得)';
  }
  if (subElement) {
    subElement.textContent = sub || '(未取得)';
  }
}

/**
 * エラー画面の初期化
 * - クエリパラメータからエラーコードを取得してメッセージを表示
 */
function initErrorPage(): void {
  const errorCode = getQueryParam('error');
  const message = errorCode 
    ? (ERROR_MESSAGES[errorCode] || DEFAULT_ERROR_MESSAGE)
    : DEFAULT_ERROR_MESSAGE;

  const messageElement = document.getElementById('error-message');
  if (messageElement) {
    messageElement.textContent = message;
  }

  // デバッグ用：エラーコードも表示（学習目的）
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
 */
function init(): void {
  const path = window.location.pathname;

  if (path === '/' || path === '/index.html') {
    initIndexPage();
  } else if (path === '/callback.html') {
    initCallbackPage();
  } else if (path === '/error.html') {
    initErrorPage();
  }
}

// DOMContentLoaded時に初期化を実行
document.addEventListener('DOMContentLoaded', init);
```

### 4.4 HTMLテンプレート

#### index.html

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OIDC学習サンドボックス</title>
  <style>
    body {
      font-family: sans-serif;
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
      text-align: center;
    }
    button {
      padding: 12px 24px;
      font-size: 16px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <h1>OIDC学習サンドボックス</h1>
  <p>銀行口座を作成するには認証が必要です</p>
  <button id="login-button">口座作成</button>
  <script src="/js/app.js"></script>
</body>
</html>
```

#### callback.html

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>認証成功 - OIDC学習サンドボックス</title>
  <style>
    body {
      font-family: sans-serif;
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
    }
    .success { color: green; }
    .info { margin: 20px 0; }
    .info dt { font-weight: bold; }
    .info dd { margin: 5px 0 15px 0; }
  </style>
</head>
<body>
  <h1 class="success">✓ 認証成功</h1>
  <dl class="info">
    <dt>メールアドレス</dt>
    <dd id="user-email"></dd>
    <dt>ユーザーID</dt>
    <dd id="user-sub"></dd>
  </dl>
  <a href="/">→ トップへ戻る</a>
  <script src="/js/app.js"></script>
</body>
</html>
```

#### error.html

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>エラー - OIDC学習サンドボックス</title>
  <style>
    body {
      font-family: sans-serif;
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
    }
    .error { color: red; }
    .message { margin: 20px 0; }
    .code { color: gray; font-size: 12px; }
  </style>
</head>
<body>
  <h1 class="error">✗ エラー</h1>
  <p class="message" id="error-message"></p>
  <p class="code" id="error-code"></p>
  <a href="/">→ トップへ戻る</a>
  <script src="/js/app.js"></script>
</body>
</html>
```

---

## 5. ビルド設定

### 5.1 package.json

```json
{
  "name": "oidc-sandbox-frontend",
  "version": "1.0.0",
  "scripts": {
    "build": "npm run build:ts && npm run build:html",
    "build:ts": "esbuild src/app.ts --bundle --outfile=dist/js/app.js --minify",
    "build:html": "cp -r public/* dist/"
  },
  "devDependencies": {
    "esbuild": "^0.20.0",
    "typescript": "^5.0.0"
  }
}
```

### 5.2 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": false,
    "lib": ["ES2020", "DOM"]
  },
  "include": ["src/**/*"]
}
```

### 5.3 ビルドコマンド

```bash
# 依存関係のインストール
cd frontend
npm install

# ビルド実行
npm run build

# dist/ ディレクトリにビルド成果物が生成される
```

---

## 6. デプロイ

### 6.1 S3への配置

CDKによるデプロイ時に、`dist/` ディレクトリの内容がS3バケットにアップロードされます。

```
dist/                   →    S3 Bucket
├── index.html          →    /index.html
├── callback.html       →    /callback.html
├── error.html          →    /error.html
└── js/
    └── app.js          →    /js/app.js
```

### 6.2 CloudFrontの設定

| 設定項目 | 値 |
|----------|-----|
| デフォルトルートオブジェクト | `index.html` |
| エラーページ設定 | 404 → `/index.html`（SPAの場合。今回は不要） |
