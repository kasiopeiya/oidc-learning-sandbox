# Issue #11: 口座作成API実装（/api/account）

### 背景 / 目的

OIDC認証完了後、アクセストークンで保護されたAPIを呼び出すパターンを学習する。
アクセストークンをDynamoDBで管理し、トークンがブラウザに渡らないセキュアな実装を実現する。

- 依存: #10
- ラベル: backend, frontend

### スコープ / 作業項目

**コールバック修正（callback.ts）**

- トークン交換後、アクセストークンをDynamoDBに保存（セッションIDで紐付け）
- セッションデータの削除タイミング調整（口座作成API呼び出し後に延期）

**口座作成API新規作成（account.ts）**

- CookieからセッションID取得
- DynamoDBからアクセストークン取得
- Cognito UserInfoエンドポイントでトークン検証
- 口座番号（ダミー）生成と返却
- 検証完了後のセッションデータ削除

**CDK修正**

- AccountFunction Lambdaの追加
- `/api/account` POSTルートの追加

**フロントエンド修正**

- callback.htmlに口座番号表示エリア追加
- ページロード時に `/api/account` を自動呼び出し
- 成功/エラー時の表示処理

### ゴール / 完了条件（Acceptance Criteria）

- [ ] アクセストークンがDynamoDBに保存されている（ブラウザに渡らない）
- [ ] `/api/account` POSTエンドポイントが作成されている
- [ ] アクセストークンをDynamoDBから取得して検証している
- [ ] UserInfoエンドポイントでトークン検証が実行されている
- [ ] 検証成功時に口座番号が返却される
- [ ] 検証失敗時に401エラーが返却される
- [ ] 口座作成完了後にセッションデータが削除されている
- [ ] callback.htmlで口座番号が自動表示される

### テスト観点

- ユニット: 口座番号生成ロジック、トークン検証
- 検証方法:
  - ブラウザからフロー全体を実行し、口座番号が表示されることを確認
  - 開発者ツールでCookieにアクセストークンが含まれていないことを確認
  - 無効なセッションIDで401エラーが返ることを確認

### フロー図

```
[トップ] 口座作成ボタン
    ↓
/api/auth/login
    ↓ セッションID → Cookie
    ↓ State/Nonce/PKCE → DynamoDB
    ↓
Cognito認証
    ↓
/api/auth/callback
    ↓ DynamoDB → State/PKCE検証
    ↓ トークン交換
    ↓ アクセストークン → DynamoDB
    ↓
/callback.html（自動実行）
    ↓ fetch('/api/account', { method: 'POST' })
    ↓
/api/account
    ↓ Cookie → セッションID取得
    ↓ DynamoDB → アクセストークン取得
    ↓ UserInfo検証
    ↓ 口座番号返却
    ↓ セッションデータ削除
    ↓
callback.htmlに口座番号表示
```

### 対象ファイル

| 操作 | ファイル                           |
| ---- | ---------------------------------- |
| 修正 | `cdk/lib/oidc-sandbox-stack.ts`    |
| 修正 | `backend/src/handlers/callback.ts` |
| 新規 | `backend/src/handlers/account.ts`  |
| 修正 | `frontend/src/app.ts`              |
| 修正 | `frontend/public/callback.html`    |
