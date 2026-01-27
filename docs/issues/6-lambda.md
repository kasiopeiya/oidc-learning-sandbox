# Issue #6: Lambda関数の雛形作成

### 背景 / 目的

認証ハンドラーのLambda関数を作成し、API Gatewayと連携させる。OIDC RPロジックを実装する土台となる。

- 依存: #5
- ラベル: backend, infra

### スコープ / 作業項目

- `backend/` ディレクトリ構成の作成
- NodejsFunction による Lambda 関数定義
- 環境変数の設定（Cognito 情報、URL）
- API Gateway ルートの定義（/api/auth/login, /api/auth/callback）

### ゴール / 完了条件（Acceptance Criteria）

- [ ] `backend/` ディレクトリ構成が設計書通りに作成されている
- [ ] NodejsFunctionでLambda関数が定義されている
- [ ] ランタイムがNode.js 24.x、アーキテクチャがarm64に設定されている
- [ ] 環境変数（COGNITO\_\*, REDIRECT_URI, FRONTEND_URL）が設定されている
- [ ] `/api/auth/login` と `/api/auth/callback` のルートが定義されている
- [ ] デプロイ後、エンドポイントにアクセスして200/302レスポンスが返る

### テスト観点

- 検証方法: curl または ブラウザで各エンドポイントにアクセス
