# OIDC学習サンドボックス

OIDC（OpenID Connect）の認可コードフローを学習するためのサンドボックス環境です。
AWS CDKを用いて、IDプロバイダー（Cognito）とリライイングパーティ（Lambda）を構築し、実際の挙動をハンズオン形式で確認できます。

## 概要

### 目的

- OIDC認証フロー（認可コードフロー）をRP（Relying Party）として実装する際の動作確認・学習環境を提供
- State、Nonce、PKCEなどのセキュリティパラメータの動作を実際に確認

### ユースケース

銀行口座作成の入り口として認証フローを体験:

1. 「口座作成」ボタンをクリック
2. Cognitoのログイン画面にリダイレクト
3. 認証成功後、ユーザー情報（メールアドレス、ユーザーID）を表示

## システム構成

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud (ap-northeast-1)                       │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         oidc-sandbox-app スタック                        │ │
│  │                                                                          │ │
│  │                                              ┌─────────────┐             │ │
│  │                                              │             │             │ │
│  │                        /*  ─────────────────▶│     S3      │             │ │
│  │    ┌─────────────┐                           │  (静的資産)  │             │ │
│  │    │             │                           └─────────────┘             │ │
│  │    │  CloudFront │                                                       │ │
│  │    │             │                           ┌─────────────┐             │ │
│  │    └──────┬──────┘     /api/* ──────────────▶│     API     │             │ │
│  │           │                                  │   Gateway   │             │ │
│  │           │                                  └──────┬──────┘             │ │
│  │           │ xxxxx.cloudfront.net                    │                    │ │
│  │           │                                   ┌─────▼─────┐              │ │
│  │           │                                   │           │              │ │
│  │           │                                   │  Lambda   │              │ │
│  │           │                                   │           │              │ │
│  │           │                                   └─────┬─────┘              │ │
│  │           │                                         │                    │ │
│  │           │                                         │ トークン交換       │ │
│  │           │                                         ▼                    │ │
│  │           │                                   ┌───────────┐              │ │
│  │           │                                   │  Cognito  │              │ │
│  │           │                                   │ User Pool │              │ │
│  │           │                                   └───────────┘              │ │
│  │                                                                          │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘

    ┌─────────┐
    │         │
    │ ブラウザ │  ユーザー（学習者）
    │         │
    └─────────┘
```

## 技術スタック

| 項目 | 技術 |
|------|------|
| 言語 | TypeScript |
| インフラ | AWS CDK |
| 認証 (OP) | Amazon Cognito |
| バックエンド (RP) | API Gateway (HTTP API) + Lambda |
| フロントエンド | React 18 + Vite + Tailwind CSS + React Router |
| ホスティング | S3 + CloudFront |

## 前提条件

- Node.js 18.x 以上
- AWS CLI がインストール・設定済み
- AWS CDK がインストール済み（`npm install -g aws-cdk`）
- AWSアカウントへのアクセス権限

## セットアップ

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd oidc-learning-sandbox
```

### 2. 依存関係のインストール

```bash
# CDK
cd cdk && npm install

# バックエンド
cd ../backend && npm install

# フロントエンド
cd ../frontend && npm install
```

### 3. CDK ブートストラップ（初回のみ）

AWS アカウント・リージョンに対して初回のみ実行が必要です。

```bash
cd cdk
npx cdk bootstrap
```

## デプロイ

### 1. フロントエンドのビルド

```bash
cd frontend
npm run build
```

### 2. CDK デプロイ

```bash
cd cdk
npx cdk deploy
```

デプロイ完了後、CloudFront の URL が出力されます。

```
Outputs:
OidcSandboxStack.CloudFrontURL = https://xxxxx.cloudfront.net
```

## 動作確認（E2Eテスト）

### 正常系: 新規ユーザー登録フロー

1. **トップ画面にアクセス**
   - CloudFront URL（`https://xxxxx.cloudfront.net`）にアクセス
   - 「口座作成」ボタンが表示されることを確認

2. **認証フロー開始**
   - 「口座作成」ボタンをクリック
   - Cognito のログイン画面にリダイレクトされることを確認

3. **新規ユーザー登録**
   - 「Sign up」リンクをクリック
   - メールアドレスとパスワードを入力して登録
   - 確認コードがメールで届くので入力して認証を完了

4. **認証成功画面の確認**
   - 認証成功後、`/callback` にリダイレクトされる
   - 「✓ 認証成功」と表示される
   - メールアドレスとユーザーID（sub）が表示されることを確認
   - 口座番号が自動生成されて表示されることを確認

### 異常系: ログインキャンセル

1. トップ画面から「口座作成」ボタンをクリック
2. Cognito ログイン画面で「Back to <アプリ名>」リンクをクリック（または ブラウザの戻るボタン）
3. `/error?error=access_denied` にリダイレクトされる
4. 「認証がキャンセルされました。」というエラーメッセージが表示されることを確認

### 確認ポイント

| 確認項目 | 期待結果 |
|----------|----------|
| トップ画面 → Cognito | 「口座作成」ボタンで認可エンドポイントにリダイレクト |
| 新規ユーザー登録 | メール確認後にログイン可能 |
| 認証成功画面 | メールアドレス、ユーザーID、口座番号が表示される |
| ログインキャンセル | エラー画面に適切なメッセージが表示される |
| SPA直接アクセス | `/callback`や`/error`に直接アクセスしてもSPAが正しく表示される |

### 自動E2Eテスト（Playwright）

Playwrightを使用した自動E2Eテストを実行できます。

#### 前提条件

- デプロイ済みのスタック（`npx cdk deploy` 完了済み）
- jq コマンドがインストール済み
- AWS CLI が設定済み

#### テスト実行手順

```bash
# 1. integration-tests ディレクトリに移動
cd integration-tests

# 2. 依存関係のインストール（初回のみ）
npm install

# 3. Playwright ブラウザのインストール（初回のみ）
npx playwright install

# 4. 環境変数のロード（CDKスタックの出力値を取得）
source scripts/load-env.sh

# 5. テスト実行
npm test

# オプション: ブラウザを表示してテスト実行
npm run test:headed

# オプション: UIモードでテスト実行
npm run test:ui
```

#### 環境変数

`source scripts/load-env.sh` を実行すると、以下の環境変数が設定されます：

| 環境変数 | 説明 |
|----------|------|
| `CLOUDFRONT_URL` | CloudFront ディストリビューションの URL |
| `USER_POOL_ID` | Cognito User Pool ID |
| `USER_POOL_CLIENT_ID` | Cognito User Pool Client ID |
| `COGNITO_DOMAIN` | Cognito ドメイン |

#### テスト結果

テスト結果は `integration-tests/playwright-report/` に HTML レポートとして出力されます。

```bash
# レポートを表示
npx playwright show-report
```

## ディレクトリ構成

```
oidc-learning-sandbox/
├── cdk/                    # AWS CDK インフラ定義
│   ├── bin/
│   │   └── app.ts          # CDK アプリのエントリーポイント
│   ├── lib/
│   │   └── oidc-sandbox-stack.ts  # メインスタック定義
│   └── parameter.ts        # 環境別パラメータ設定
├── backend/                # Lambda 関数（OIDC RP ロジック）
│   └── src/
│       └── handlers/
│           ├── login.ts    # 認可リクエスト生成
│           ├── callback.ts # コールバック処理
│           └── account.ts  # 口座作成API
├── frontend/               # フロントエンド（React SPA）
│   ├── index.html          # Viteエントリポイント
│   ├── vite.config.ts      # Vite設定
│   ├── tailwind.config.js  # Tailwind CSS設定
│   └── src/
│       ├── main.tsx        # Reactエントリポイント
│       ├── App.tsx         # ルーティング設定
│       ├── contexts/
│       │   └── AuthContext.tsx  # 認証状態Context
│       ├── pages/
│       │   ├── IndexPage.tsx    # トップ画面
│       │   ├── CallbackPage.tsx # 認証成功画面
│       │   └── ErrorPage.tsx    # エラー画面
│       └── utils/
│           └── api.ts      # API呼び出しユーティリティ
├── integration-tests/      # E2Eテスト（Playwright）
│   ├── tests/              # テストファイル
│   ├── scripts/
│   │   └── load-env.sh     # 環境変数ロードスクリプト
│   └── playwright.config.ts # Playwright設定
├── docs/                   # 設計書
└── README.md
```

## 主要コマンド

```bash
# デプロイ
cd frontend && npm run build
cd ../cdk && npx cdk deploy

# 差分確認
cd cdk && npx cdk diff

# 削除
cd cdk && npx cdk destroy
```

## セキュリティ

このプロジェクトでは以下のセキュリティ対策を実装しています:

| 対策 | 説明 |
|------|------|
| HTTPS 強制 | CloudFront で HTTP → HTTPS リダイレクト |
| S3 非公開 | OAC 経由でのみアクセス可能 |
| PKCE | 認可コード横取り攻撃を防止 |
| State パラメータ | CSRF 攻撃を防止 |
| Nonce パラメータ | リプレイ攻撃を防止 |
| HttpOnly Cookie | XSS によるセッション情報の漏洩を防止 |

## 注意事項

- このプロジェクトは学習用途のため、一部のセキュリティ対策（WAF、Secrets Manager等）を簡略化しています
- 本番環境での利用は想定していません
- AWS 利用料金が発生する可能性があります（無料枠内で収まる想定）

## 参考資料

- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [Amazon Cognito Developer Guide](https://docs.aws.amazon.com/cognito/latest/developerguide/)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/v2/guide/)
