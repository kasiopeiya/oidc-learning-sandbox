# プロジェクト構成

## 1. ディレクトリ構成

```
oidc-sandbox/
├── CLAUDE.md                       # Claude Code 実装ルール
├── docs/                           # 設計書
│   ├── infrastructure-design.md
│   ├── backend-design.md
│   └── frontend-design.md
├── cdk/                            # AWS CDK（インフラ定義）
│   ├── bin/
│   │   └── app.ts                  # CDK アプリのエントリーポイント
│   ├── lib/
│   │   └── oidc-sandbox-stack.ts   # メインスタック定義
│   ├── parameter.ts                # 環境別パラメータ設定
│   ├── cdk.json
│   ├── package.json
│   └── tsconfig.json
├── backend/                        # Lambda 関数
│   ├── src/
│   │   └── auth-handler.ts         # 認証ハンドラー
│   ├── package.json
│   └── tsconfig.json
├── frontend/                       # フロントエンド（S3 配置）
│   ├── src/
│   │   └── app.ts                  # フロントエンドロジック
│   ├── public/
│   │   ├── index.html              # トップページ
│   │   └── callback.html           # コールバックページ
│   ├── dist/                       # ビルド成果物（S3 にデプロイ）
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

---

## 2. 各ディレクトリの役割

| ディレクトリ | 役割 | 言語 |
|-------------|------|------|
| `docs/` | 設計書 | Markdown |
| `cdk/` | AWS インフラ定義 | TypeScript |
| `backend/` | Lambda 関数（OIDC RP ロジック） | TypeScript |
| `frontend/` | ブラウザで動作する UI | TypeScript |

---

## 3. デプロイコマンド

### 3.1 初回セットアップ

```bash
# リポジトリのクローン
git clone <repository-url>
cd oidc-sandbox

# 依存関係のインストール
cd cdk && npm install
cd ../backend && npm install
cd ../frontend && npm install

# CDK ブートストラップ（AWS アカウントに対して初回のみ）
cd ../cdk
npx cdk bootstrap
```

### 3.2 デプロイ

```bash
# フロントエンドのビルド
cd frontend
npm run build

# CDK デプロイ
cd ../cdk
npx cdk deploy
```

デプロイ完了後、CloudFront の URL が出力されます。

### 3.3 削除

```bash
cd cdk
npx cdk destroy
```

すべての AWS リソースが削除されます。
