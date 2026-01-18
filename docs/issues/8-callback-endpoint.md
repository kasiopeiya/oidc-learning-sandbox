# Issue #8: コールバック実装（/api/auth/callback）

### 背景 / 目的

認可コードを受け取り、トークン交換とIDトークン検証を行い、成功/エラー画面にリダイレクトする。openid-clientライブラリを使用してセキュアな検証を実装する。

- 依存: #7
- ラベル: backend

### スコープ / 作業項目

- openid-client ライブラリの導入
- OIDC Discovery によるOP情報取得
- トークン交換リクエスト
- State/Nonce/PKCE/署名/有効期限の検証
- 成功時・エラー時のリダイレクト処理
- Cookie のクリーンアップ

### ゴール / 完了条件（Acceptance Criteria）

- [ ] openid-client ライブラリを使用してトークン交換が実装されている
- [ ] State検証が実行されている（Cookie vs URLパラメータ）
- [ ] PKCE検証が実行されている（code_verifier送信）
- [ ] IDトークンの署名検証、Nonce検証、有効期限検証が実行されている
- [ ] 成功時: `/callback.html?email=xxx&sub=xxx` にリダイレクトされる
- [ ] エラー時: `/error.html?error=エラーコード` にリダイレクトされる
- [ ] 検証用Cookieが削除されている

### テスト観点

- ユニット: エラーコード判定ロジック
- 検証方法: 正常系・異常系（ログインキャンセル等）の動作確認
