# Issue #7: 認可リクエスト実装（/api/auth/login）

### 背景 / 目的

State, Nonce, PKCEを生成し、Cognitoの認可エンドポイントへリダイレクトする処理を実装する。CSRF攻撃、リプレイ攻撃、認可コード横取り攻撃を防ぐセキュリティパラメータを正しく生成・保存する。

- 依存: #2, #6
- ラベル: backend

### スコープ / 作業項目

- state, nonce, code_verifier の暗号論的生成
- code_challenge の計算（SHA256 + Base64URL）
- セキュアな Cookie 設定（HttpOnly, Secure, SameSite=Lax）
- 認可URLの構築と302リダイレクト

### ゴール / 完了条件（Acceptance Criteria）

- [ ] state, nonce, code_verifier が暗号論的に安全な方法で生成されている
- [ ] code_challenge が SHA256 + Base64URL で計算されている
- [ ] 生成した値が HttpOnly, Secure, SameSite=Lax の Cookie に保存されている
- [ ] 認可URLが正しいパラメータで構築されている（response_type, client_id, redirect_uri, scope, state, nonce, code_challenge, code_challenge_method）
- [ ] 302リダイレクトでCognitoの認可エンドポイントに遷移する
- [ ] ブラウザからアクセスしてCognitoログイン画面が表示される

### テスト観点

- ユニット: state/nonce/PKCE生成ロジック
- 検証方法: ブラウザの開発者ツールでCookie設定とリダイレクトURLを確認
