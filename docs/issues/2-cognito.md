# Issue #2: Cognito User Pool構築

### 背景 / 目的

OIDCのOP（OpenID Provider）として機能するCognito User PoolとApp Clientを構築する。認可コードフローの認証基盤となる。

- 依存: #1
- ラベル: infra

### スコープ / 作業項目

- User Pool の作成（email サインイン、セルフサインアップ許可）
- App Client の作成（Confidential Client、PKCE有効）
- OAuth スコープの設定（openid, email, profile）
- Cognito Domain の設定

### ゴール / 完了条件（Acceptance Criteria）

- [ ] User Pool が作成され、emailでサインイン可能な設定になっている
- [ ] App Client が Confidential Client として作成されている
- [ ] PKCE（S256）が有効になっている
- [ ] OAuth スコープに openid, email, profile が設定されている
- [ ] Cognito Domain が設定されている
- [ ] `npx cdk deploy` でリソースが作成される

### テスト観点

- 検証方法: AWS Console で User Pool と App Client の設定を確認
