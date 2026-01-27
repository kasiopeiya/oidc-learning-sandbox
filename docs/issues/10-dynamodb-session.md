# Issue #10: セッション管理のDynamoDB移行

### 背景 / 目的

現在Cookie で管理しているState/Nonce/PKCEをDynamoDBで管理する方式に移行する。
セッションIDをCookieで保持し、セキュリティパラメータはサーバーサイドで一元管理することで、よりセキュアな実装を実現する。

- 依存: #7, #8
- ラベル: backend, infrastructure

### スコープ / 作業項目

**インフラ（CDK）**

- セッション管理用DynamoDBテーブルの追加（TTL有効）
- Lambda関数へのDynamoDB権限付与

**認可リクエスト修正（login.ts）**

- セッションID生成とCookie設定（HttpOnly, Secure, SameSite=Strict）
- State/Nonce/PKCEをDynamoDBに保存（セッションIDをキーに）
- 既存のCookie保存ロジックを削除

**コールバック修正（callback.ts）**

- CookieからセッションID取得
- DynamoDBからState/Nonce/PKCE取得
- 検証ロジックの修正（Cookie参照→DynamoDB参照）
- 検証完了後のセッションデータ削除

**共通ユーティリティ**

- セッション操作用ユーティリティ関数の作成

### ゴール / 完了条件（Acceptance Criteria）

- [ ] DynamoDBテーブルが作成されている（TTL有効、5分程度）
- [ ] セッションIDがHttpOnly, Secure, SameSite=Strict Cookieで管理されている
- [ ] State/Nonce/PKCEがDynamoDBに保存されている
- [ ] コールバック時にDynamoDBからState/PKCE を取得して検証している
- [ ] 検証完了後にセッションデータが削除されている
- [ ] 既存のCookie保存ロジックが削除されている
- [ ] 既存の認証フローが正常に動作する

### テスト観点

- ユニット: セッションID生成、DynamoDB操作
- 検証方法:
  - ブラウザから認証フロー全体を実行し、正常に完了することを確認
  - DynamoDBコンソールでセッションデータの保存・削除を確認
  - 開発者ツールでCookieにState/Nonce/PKCEが含まれていないことを確認

### 対象ファイル

| 操作 | ファイル                           |
| ---- | ---------------------------------- |
| 修正 | `cdk/lib/oidc-sandbox-stack.ts`    |
| 修正 | `backend/src/handlers/login.ts`    |
| 修正 | `backend/src/handlers/callback.ts` |
| 新規 | `backend/src/utils/session.ts`     |
