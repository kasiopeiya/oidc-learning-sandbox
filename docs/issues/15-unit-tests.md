# Issue #15: バックエンド・フロントエンドの単体テスト実装

### 背景 / 目的

現在、プロジェクトには結合テスト（Playwright E2E）のみが存在し、単体テストが不足している。
コードの品質を保証し、リファクタリングや機能追加時の安全性を高めるため、バックエンドとフロントエンドの単体テストを導入する。

- 依存: なし
- ラベル: test, backend, frontend

### スコープ / 作業項目

#### 1. テスト環境のセットアップ

**バックエンド（backend/）**

- [ ] `vitest` と関連パッケージのインストール
  - `vitest`, `@vitest/ui`, `@vitest/coverage-v8`
  - AWS SDK モック用: `aws-sdk-client-mock`
- [ ] `vitest.config.ts` の作成
  - TypeScript パス解決設定
  - カバレッジ設定（レポート出力のみ、目標値なし）
- [ ] `backend/package.json` にテストスクリプト追加
  - `test`: テスト実行
  - `test:ui`: Vitest UI起動
  - `test:coverage`: カバレッジレポート生成

**フロントエンド（frontend/）**

- [ ] `vitest` と関連パッケージのインストール
  - `vitest`, `@vitest/ui`, `@vitest/coverage-v8`
  - React テスト用: `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
- [ ] `vitest.config.ts` の作成（Vite設定と統合）
  - React Testing Library セットアップ
  - jsdom 環境設定
- [ ] `frontend/package.json` にテストスクリプト追加

#### 2. バックエンドのテスト実装

**⚠️ 重要: すべての関数について正常系と異常系の両方を必ずテストすること**

**utils/ のテスト**

- [ ] `cookie.test.ts`
  - 正常系:
    - Cookie生成（有効な値）
    - Cookieパース（正しいフォーマット）
    - Cookie削除（Max-Age=0の検証）
  - 異常系:
    - 不正なCookie文字列のパース
    - 空文字列・null・undefinedの処理
    - 不正な文字を含むCookieの処理

- [ ] `pkce.test.ts`
  - 正常系:
    - Code Verifier 生成（長さ・文字種の検証）
    - Code Challenge 生成（SHA256ハッシュ検証）
    - ランダム性の検証（複数回実行して重複がないこと）
  - 異常系:
    - 空のverifierからのchallenge生成
    - 不正なverifier形式の処理

- [ ] `session.test.ts`
  - 正常系:
    - Session生成（DynamoDB PutItem成功）
    - Session検証（DynamoDB GetItem成功、TTL未切れ）
    - Session削除（DynamoDB DeleteItem成功）
  - 異常系:
    - DynamoDB PutItem失敗時のエラー処理
    - DynamoDB GetItem失敗時のエラー処理
    - 存在しないSessionの検証（GetItemでnull）
    - TTL切れSessionの検証
    - DynamoDB DeleteItem失敗時のエラー処理
    - ネットワークタイムアウト

- [ ] `ssm.test.ts`
  - 正常系:
    - SSM Parameter Store からの値取得成功
    - キャッシュ機能の検証（2回目以降はキャッシュから取得）
  - 異常系:
    - パラメータが存在しない場合（ParameterNotFound）
    - GetParameterコマンド実行失敗
    - 空文字列のパラメータ
    - ネットワークエラー

- [ ] `secrets.test.ts`
  - 正常系:
    - Secrets Manager からの値取得成功
    - キャッシュ機能の検証
  - 異常系:
    - シークレットが存在しない場合（ResourceNotFoundException）
    - GetSecretValueコマンド実行失敗
    - 空文字列のシークレット
    - ネットワークエラー
    - JSONパースエラー（シークレットが不正なJSON形式）

- [ ] `oidc-config.test.ts`
  - 正常系:
    - OIDC Discovery エンドポイント取得成功
    - Client ID/Secret 取得成功（Secrets Manager モック）
  - 異常系:
    - Discovery エンドポイントが404を返す
    - Discovery エンドポイントが不正なJSON
    - Client ID/Secret取得失敗（Secrets Managerエラー）
    - 環境変数未設定時のエラー

**handlers/ のテスト**

- [ ] `login.test.ts`
  - 正常系:
    - 認可リクエストURL生成
    - State/Nonce/PKCE パラメータの生成・保存
    - リダイレクトレスポンス（302）の検証
  - 異常系:
    - OIDC設定取得失敗時の500エラー
    - Session保存失敗時のエラー処理
    - 環境変数未設定時のエラー
    - DynamoDB書き込みエラー

- [ ] `callback.test.ts`
  - 正常系:
    - 認可コード受け取り
    - トークン交換リクエスト成功
    - IDトークン検証（署名検証、Nonce検証）
    - Session生成成功
  - 異常系:
    - 認可コードが存在しない（queryStringParametersが空）
    - State不一致エラー
    - Stateが存在しない（Session未保存）
    - トークンエンドポイントが4xx/5xxエラー
    - トークンエンドポイントがタイムアウト
    - IDトークン署名検証失敗
    - Nonce不一致エラー
    - Session保存失敗
    - 不正なIDトークンフォーマット

- [ ] `account.test.ts`
  - 正常系:
    - Session検証成功
    - 口座作成API成功（DynamoDB書き込み）
  - 異常系:
    - 未認証時のエラーレスポンス（401）
    - Sessionが存在しない
    - SessionがTTL切れ
    - DynamoDB書き込み失敗
    - リクエストボディが不正（バリデーションエラー）
    - 重複する口座作成リクエスト

#### 3. フロントエンドのテスト実装

**⚠️ 重要: すべてのコンポーネント・関数について正常系と異常系の両方を必ずテストすること**

**utils/ のテスト**

- [ ] `api.test.ts`
  - 正常系:
    - API呼び出し成功（200レスポンス）
    - JSONレスポンスの正しいパース
    - 各エンドポイント（/api/auth/login, /api/account など）の呼び出し
  - 異常系:
    - ネットワークエラー（fetch失敗）
    - 4xxレスポンス（クライアントエラー）
    - 5xxレスポンス（サーバーエラー）
    - タイムアウト
    - 不正なJSONレスポンス
    - 空のレスポンスボディ

**contexts/ のテスト**

- [ ] `AuthContext.test.tsx`
  - 正常系:
    - Context の初期状態（未認証）
    - ログイン状態の更新
    - ログアウト処理
    - ユーザー情報の保存・取得
  - 異常系:
    - Context外での使用（useAuthフックのエラー）
    - 不正なユーザーデータの処理
    - null/undefinedの処理

**pages/ のテスト**

- [ ] `IndexPage.test.tsx`
  - 正常系:
    - 初期表示（「口座作成」ボタンの存在）
    - 認証済み時の表示（ユーザー情報、口座作成フォーム）
    - ボタンクリックイベント
    - 口座作成API呼び出し成功
  - 異常系:
    - API呼び出し失敗時のエラー表示
    - ネットワークエラー時の処理
    - バリデーションエラー（入力値不正）
    - 未入力時の処理

- [ ] `CallbackPage.test.tsx`
  - 正常系:
    - URLクエリパラメータ解析（code, state）
    - 認証成功メッセージ表示
    - ユーザー情報の取得・表示
  - 異常系:
    - クエリパラメータが存在しない
    - errorパラメータが含まれる場合
    - API呼び出し失敗
    - 不正なレスポンス形式

- [ ] `ErrorPage.test.tsx`
  - 正常系:
    - エラーメッセージ表示
    - エラー種別による表示切り替え（access_denied, server_error など）
  - 異常系:
    - 未知のエラー種別の処理
    - エラーパラメータが存在しない場合
    - エラーメッセージが空の場合

**App/main のテスト**

- [ ] `App.test.tsx`
  - 正常系:
    - ルーティング設定の検証（/, /callback, /error）
    - AuthContext Provider の配置
    - 各ルートの正しいレンダリング
  - 異常系:
    - 存在しないルートへのアクセス（404）
    - ルーティングエラー時の処理

#### 4. ドキュメント整備

- [ ] `docs/testing-strategy.md` の作成
  - 単体テスト vs 結合テストの方針
  - モック戦略
  - テスト実行手順

- [ ] `README.md` にテスト実行手順を追加
  - 単体テスト実行方法
  - カバレッジレポート確認方法

### ゴール / 完了条件（Acceptance Criteria）

- [ ] backend/ のすべての関数に単体テストが実装されている
- [ ] frontend/ のすべてのコンポーネント・関数に単体テストが実装されている
- [ ] **すべての関数・コンポーネントについて正常系と異常系の両方がテストされている**
- [ ] `npm test` でバックエンド・フロントエンドのテストが実行できる
- [ ] カバレッジレポートが生成できる（目標値は設定しないが、レポートは確認可能）
- [ ] すべてのテストがパスする
- [ ] AWS SDK（DynamoDB、SSM、Secrets Manager）が適切にモック化されている
- [ ] テスト実行手順がドキュメント化されている
- [ ] 各テストファイルに、異常系テストケースが網羅的に含まれている

### テスト観点

**正常系テスト（Happy Path）**
- **ユーティリティ関数**: 正しい入力値に対する期待される出力の検証
- **AWS SDK操作**: モックされたAWS SDKが正しく呼び出され、期待される結果を返すこと
- **React コンポーネント**: ユーザーインタラクション、条件分岐による表示切り替え
- **非同期処理**: Promise、async/await の正しい動作検証

**異常系テスト（Error Cases）- 必須**
- **不正な入力値**: null、undefined、空文字列、不正な型、境界値外の値
- **外部サービスエラー**: AWS SDK のエラー（DynamoDB、SSM、Secrets Manager）
  - ResourceNotFoundException（リソース未存在）
  - ParameterNotFound（パラメータ未存在）
  - ネットワークタイムアウト
  - 権限エラー（AccessDenied）
  - サービス障害（ServiceException）
- **HTTPエラー**: 4xx（クライアントエラー）、5xx（サーバーエラー）、ネットワークエラー
- **認証・認可エラー**:
  - State不一致
  - Nonce不一致
  - Session未存在・期限切れ
  - トークン検証失敗
- **データフォーマットエラー**: 不正なJSON、不正なCookie、不正なクエリパラメータ
- **境界値・エッジケース**: 空配列、空オブジェクト、極端に長い文字列

**テスト実装の原則**
- すべての関数・コンポーネントについて、**最低1つの正常系と1つ以上の異常系**をテストする
- エラーハンドリングロジックが存在する場合、そのすべての分岐をテストする
- try-catchブロックがある場合、catchブロックに到達するテストを必ず作成する
- 異常系テストでは、エラーメッセージやステータスコードを検証する

### 技術的な注意点

1. **AWS SDKモック戦略**
   - `aws-sdk-client-mock` を使用してDynamoDB、SSM、Secrets Managerをモック
   - 実際のAWSリソースへのアクセスは行わない
   - モックの初期化とクリーンアップを各テストファイルで適切に実施
   - **異常系テスト**: `.rejects()` を使用してエラーをモック
     ```typescript
     mockDynamoDB.on(PutItemCommand).rejects(new Error('DynamoDB Error'));
     ```

2. **React Testing Library のベストプラクティス**
   - ユーザー視点のテスト（`getByRole`, `getByText` など）
   - 実装詳細に依存しない（内部stateの直接テストを避ける）
   - 非同期処理は `waitFor`, `findBy*` を使用
   - **異常系テスト**: エラー表示の検証に `findByText` を使用

3. **テストの独立性**
   - 各テストは独立して実行可能であること
   - テスト間で状態を共有しない
   - `beforeEach`, `afterEach` でセットアップ・クリーンアップ
   - モックのリセットを必ず実施（`mockReset()`, `vi.clearAllMocks()`）

4. **環境変数のモック**
   - バックエンドの環境変数（`process.env`）は各テストでモック
   - `vi.stubEnv()` を使用
   - **異常系テスト**: 環境変数が未設定の状態もテスト

5. **TypeScript型定義**
   - テストコードもTypeScriptで記述
   - 型安全性を保ちつつテストを実装

6. **異常系テストの実装パターン**
   - `expect().rejects.toThrow()` を使用してエラーをキャッチ
   - エラーメッセージの内容を検証
   - HTTPステータスコードを検証（handlers）
   - `describe` ブロックで正常系と異常系を明確に分ける
     ```typescript
     describe('functionName', () => {
       describe('正常系', () => { /* ... */ });
       describe('異常系', () => { /* ... */ });
     });
     ```

### 対象ファイル

| 操作 | ファイル |
|------|----------|
| 新規 | `backend/vitest.config.ts` |
| 修正 | `backend/package.json` |
| 新規 | `backend/src/utils/cookie.test.ts` |
| 新規 | `backend/src/utils/pkce.test.ts` |
| 新規 | `backend/src/utils/session.test.ts` |
| 新規 | `backend/src/utils/ssm.test.ts` |
| 新規 | `backend/src/utils/secrets.test.ts` |
| 新規 | `backend/src/utils/oidc-config.test.ts` |
| 新規 | `backend/src/handlers/login.test.ts` |
| 新規 | `backend/src/handlers/callback.test.ts` |
| 新規 | `backend/src/handlers/account.test.ts` |
| 新規 | `frontend/vitest.config.ts` |
| 修正 | `frontend/package.json` |
| 新規 | `frontend/src/utils/api.test.ts` |
| 新規 | `frontend/src/contexts/AuthContext.test.tsx` |
| 新規 | `frontend/src/pages/IndexPage.test.tsx` |
| 新規 | `frontend/src/pages/CallbackPage.test.tsx` |
| 新規 | `frontend/src/pages/ErrorPage.test.tsx` |
| 新規 | `frontend/src/App.test.tsx` |
| 新規 | `docs/testing-strategy.md` |
| 修正 | `README.md` |

### 参考資料

- [Vitest - Getting Started](https://vitest.dev/guide/)
- [aws-sdk-client-mock](https://github.com/m-radzikowski/aws-sdk-client-mock)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Library - Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
