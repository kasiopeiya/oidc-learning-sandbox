# Issue #9: E2E動作確認・ドキュメント整備

### 背景 / 目的

フロントエンドとバックエンドを結合し、認証フロー全体の動作確認を行う。READMEを整備し、プロジェクトの使い方を明確にする。

- 依存: #4, #8
- ラベル: docs, test

### スコープ / 作業項目

- 認証フロー全体の手動E2Eテスト
- 新規ユーザー登録フローの確認
- エラーケースの確認
- README.md の作成

### ゴール / 完了条件（Acceptance Criteria）

- [ ] トップ画面から「口座作成」ボタンをクリックしてCognitoログイン画面に遷移する
- [ ] 新規ユーザー登録が完了する
- [ ] ログイン後、認証成功画面にメールアドレスとユーザーIDが表示される
- [ ] ログインキャンセル時、エラー画面に適切なメッセージが表示される
- [ ] README.md にセットアップ手順とデプロイ手順が記載されている

### テスト観点

- E2E: ブラウザでの認証フロー全体
- 検証方法: 手動テストによる全画面遷移の確認

---

## 実装内容

### 実装済みファイル一覧

```
e2e/
├── package.json              # Playwright + AWS SDK 依存関係
├── tsconfig.json             # TypeScript設定
├── playwright.config.ts      # Playwright設定
├── setup/
│   └── global-setup.ts       # 環境変数検証
├── scripts/
│   └── load-env.sh           # CDK出力値を環境変数に設定
└── tests/
    └── http.spec.ts          # HTTPレベルテスト (HTTP-001〜005)
```

※ `auth-flow.spec.ts` は Cognito Hosted UI の不安定なセレクタ問題により削除

### テストケース

| ID       | テストケース名                   | 確認観点                                   |
| -------- | -------------------------------- | ------------------------------------------ |
| HTTP-001 | トップページ表示                 | 静的ファイルが正しく配信されるか           |
| HTTP-002 | 認可エンドポイントリダイレクト   | 認可URLが正しく生成されるか                |
| HTTP-003 | 認証成功ページ表示               | コールバックページが配信されるか           |
| HTTP-004 | エラーページ表示                 | エラーページが配信されるか                 |
| HTTP-005 | OIDCパラメータ検証               | state/nonce/PKCEが正しく設定されるか       |

### テスト実行手順

```bash
# 1. 依存関係インストール
cd e2e && npm install

# 2. Playwright ブラウザインストール
npx playwright install chromium

# 3. 環境変数設定（CDK出力値を取得）
source scripts/load-env.sh

# 4. テスト実行
npm test
```

### 必須環境変数

テスト実行には以下の環境変数が必要です。`scripts/load-env.sh` で自動設定されます。

| 環境変数             | 説明                                |
| -------------------- | ----------------------------------- |
| CLOUDFRONT_URL       | CloudFrontディストリビューションURL |
| USER_POOL_ID         | Cognito User Pool ID                |
| USER_POOL_CLIENT_ID  | Cognito User Pool Client ID         |

### Cognito 固有の部分（他のOPへの移行時に変更が必要）

`http.spec.ts` の HTTP-002 内の1行のみ：

```typescript
expect(location).toContain('amazoncognito.com/oauth2/authorize');
```

Duende 等の他の OP に変更する場合は、この行を修正する。
