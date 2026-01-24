# Issue #13: OPを差し替え可能にする

### 背景 / 目的

現在のRP実装はAmazon Cognitoを前提とした構成になっており、環境変数名やエンドポイントURL構築がCognito固有の形式に依存している。
OIDCの標準仕様に準拠することで、Cognito以外のOP（Auth0、Keycloak、Google等）にも容易に差し替えられるようにする。

これにより:
- 異なるOPでのOIDC認証フローを比較学習できる
- RP実装がOIDC標準に準拠していることを確認できる
- 実務で様々なOPと連携する際の参考になる

- 依存: #12
- ラベル: backend, cdk, docs

### 現状の課題

**CDK（環境変数）**
```typescript
environment: {
  COGNITO_USER_POOL_ID: ...,    // Cognito固有
  COGNITO_CLIENT_ID: ...,       // Cognito固有の命名
  COGNITO_CLIENT_SECRET: ...,   // Cognito固有の命名
  COGNITO_DOMAIN: ...,          // Cognito固有の命名
}
```

**login.ts**
- `COGNITO_DOMAIN`、`COGNITO_CLIENT_ID` を使用
- 認可エンドポイント: `${cognitoDomain}/oauth2/authorize`（Cognitoのパス構造を前提）

**callback.ts**
- Issuer URL: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`（Cognito固有の形式）
- `COGNITO_USER_POOL_ID`、`COGNITO_CLIENT_ID`、`COGNITO_CLIENT_SECRET` を使用

**account.ts**
- UserInfo URL: `${cognitoDomain}/oauth2/userInfo`（Cognitoのパス構造を前提）

### スコープ / 作業項目

**環境変数の標準化（CDK）**
- Cognito固有の環境変数名をOIDC標準の用語に変更
  - `COGNITO_USER_POOL_ID` → 削除（Issuerから自動取得）
  - `COGNITO_CLIENT_ID` → `OIDC_CLIENT_ID`
  - `COGNITO_CLIENT_SECRET` → `OIDC_CLIENT_SECRET`
  - `COGNITO_DOMAIN` → `OIDC_ISSUER`（Issuer URL）

**バックエンド: OIDC Discovery対応**
- `backend/src/utils/oidc-config.ts` を新規作成
  - openid-client の Configuration をモジュール間で共有
  - Discovery結果（authorization_endpoint、token_endpoint、userinfo_endpoint）をキャッシュ
- `login.ts` の修正
  - OIDC Discoveryから認可エンドポイントを取得
  - 環境変数名を `OIDC_*` に変更
- `callback.ts` の修正
  - Issuer URLを `OIDC_ISSUER` 環境変数から取得
  - Cognito固有のURL構築ロジックを削除
  - 共通 OIDC Config モジュールを使用
- `account.ts` の修正
  - OIDC Discoveryから UserInfo エンドポイントを取得
  - Cognito固有のURL構築ロジックを削除

**CDK修正**
- `cdk/lib/oidc-sandbox-stack.ts` の環境変数を更新
- Cognito Issuer URLの構築を一箇所に集約

**コメント・ドキュメント更新**
- 各ファイルのコメントから「Cognito」固有の記述を汎用化
- `docs/backend-design.md` に OIDC Discovery の説明を追加
- `docs/requirements.md` の将来機能から本項目を削除

### ゴール / 完了条件（Acceptance Criteria）

- [ ] 環境変数が `OIDC_ISSUER`、`OIDC_CLIENT_ID`、`OIDC_CLIENT_SECRET` に統一されている
- [ ] `COGNITO_USER_POOL_ID` 環境変数が削除されている
- [ ] login.ts が OIDC Discovery から認可エンドポイントを取得している
- [ ] callback.ts が `OIDC_ISSUER` 環境変数からIssuer URLを取得している
- [ ] account.ts が OIDC Discovery から UserInfo エンドポイントを取得している
- [ ] Cognito を OP として使用した場合に既存の認証フローが正常動作する
- [ ] コメント・ドキュメントが汎用化されている（Cognito固有の記述が最小限）
- [ ] `docs/requirements.md` の将来機能から本項目が削除されている

### テスト観点

- 検証方法:
  - デプロイ後、既存の認証フロー全体が動作することを確認
  - E2Eテスト（`cdk/test/e2e/oidc-flow.e2e.test.ts`）が全てパスする
  - （可能であれば）Cognito以外のOP（Auth0等）での動作確認

### 補足: OIDC標準エンドポイント

OIDCの標準では、Issuer URLから `/.well-known/openid-configuration` にアクセスすることで各種エンドポイントを動的に取得できる:

```json
{
  "issuer": "https://example.com",
  "authorization_endpoint": "https://example.com/oauth2/authorize",
  "token_endpoint": "https://example.com/oauth2/token",
  "userinfo_endpoint": "https://example.com/oauth2/userInfo",
  "jwks_uri": "https://example.com/.well-known/jwks.json"
}
```

openid-client ライブラリの `client.discovery()` を使用すれば、これらを自動的に取得・キャッシュできる。

### 対象ファイル

| 操作 | ファイル |
|------|----------|
| 新規 | `backend/src/utils/oidc-config.ts` |
| 修正 | `backend/src/handlers/login.ts` |
| 修正 | `backend/src/handlers/callback.ts` |
| 修正 | `backend/src/handlers/account.ts` |
| 修正 | `cdk/lib/oidc-sandbox-stack.ts` |
| 修正 | `docs/backend-design.md` |
| 修正 | `docs/requirements.md` |
