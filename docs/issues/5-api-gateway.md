# Issue #5: API Gateway (HTTP API) 構築

### 背景 / 目的

バックエンドAPIのエントリーポイントとなるHTTP APIを構築する。CloudFrontの `/api/*` パスからAPI Gatewayに転送し、フロントエンドと同一ドメインでAPIを提供する。

- 依存: #1
- ラベル: infra

### スコープ / 作業項目

- HTTP API の作成
- CloudFront の `/api/*` ビヘイビア設定
- キャッシュ無効化設定

### ゴール / 完了条件（Acceptance Criteria）

- [ ] HTTP API が作成されている
- [ ] CloudFront の `/api/*` パスが API Gateway に転送される
- [ ] API Gateway のエンドポイントURLがCDK出力に表示される
- [ ] キャッシュが無効化されている（CachingDisabled）

### テスト観点

- 検証方法: CloudFront 経由で `/api/` にアクセスしてレスポンスを確認
