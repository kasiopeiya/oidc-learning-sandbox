# テスト戦略

## 概要

本プロジェクトでは、コードの品質を保証し、リファクタリングや機能追加時の安全性を高めるため、以下のテスト戦略を採用しています。

## テストの種類

### 単体テスト

ユーティリティ関数、コンポーネント、ハンドラーを対象とした小さな単位のテスト。

- **テストフレームワーク**: Vitest
- **対象**: バックエンド（Lambda関数）、フロントエンド（React）

### 結合テスト（E2E）

HTTPレベルでの認証フロー検証。

- **テストフレームワーク**: Playwright
- **対象**: `/integration-tests/` ディレクトリ
- **詳細**: [Issue #9](./issues/9-integration-test.md) 参照

## バックエンドテスト

### テスト対象

| ファイル               | 説明                                    | テストファイル        |
| ---------------------- | --------------------------------------- | --------------------- |
| `utils/cookie.ts`      | Cookie操作ユーティリティ                | `cookie.test.ts`      |
| `utils/pkce.ts`        | PKCE（state, nonce, code_verifier）生成 | `pkce.test.ts`        |
| `utils/session.ts`     | DynamoDBセッション管理                  | `session.test.ts`     |
| `utils/ssm.ts`         | SSM Parameter Store取得                 | `ssm.test.ts`         |
| `utils/secrets.ts`     | Secrets Manager取得                     | `secrets.test.ts`     |
| `utils/oidc-config.ts` | OIDC Discovery設定取得                  | `oidc-config.test.ts` |
| `handlers/login.ts`    | 認可リクエストハンドラー                | `login.test.ts`       |
| `handlers/callback.ts` | コールバックハンドラー                  | `callback.test.ts`    |
| `handlers/account.ts`  | 口座作成ハンドラー                      | `account.test.ts`     |

### モック戦略

#### AWS SDK

`aws-sdk-client-mock` を使用してAWS SDKをモック化。

```typescript
import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'

const dynamoMock = mockClient(DynamoDBClient)

// 正常系
dynamoMock.on(PutItemCommand).resolves({})

// 異常系
dynamoMock.on(PutItemCommand).rejects(new Error('DynamoDB Error'))
```

#### openid-client

`vi.mock()` を使用してOIDC Discoveryをモック化。

```typescript
vi.mock('openid-client', async () => {
  const actual = await vi.importActual('openid-client')
  return {
    ...actual,
    discovery: vi.fn()
  }
})
```

### テスト実行

```bash
cd backend

# テスト実行
npm test

# ウォッチモード
npm run test:watch

# UI付きテスト
npm run test:ui

# カバレッジレポート生成
npm run test:coverage
```

## フロントエンドテスト

### テスト対象

| ファイル                   | 説明                      | テストファイル          |
| -------------------------- | ------------------------- | ----------------------- |
| `utils/api.ts`             | API呼び出しユーティリティ | `api.test.ts`           |
| `contexts/AuthContext.tsx` | 認証状態Context           | `AuthContext.test.tsx`  |
| `pages/IndexPage.tsx`      | トップページ              | `IndexPage.test.tsx`    |
| `pages/CallbackPage.tsx`   | 認証成功ページ            | `CallbackPage.test.tsx` |
| `pages/ErrorPage.tsx`      | エラーページ              | `ErrorPage.test.tsx`    |
| `App.tsx`                  | ルーティング設定          | `App.test.tsx`          |

### テストライブラリ

- **React Testing Library**: コンポーネントテスト
- **jsdom**: ブラウザ環境シミュレーション

### モック戦略

#### fetch API

```typescript
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// 正常系
mockFetch.mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ accountNumber: '1234567890' })
})

// 異常系
mockFetch.mockRejectedValue(new Error('Network error'))
```

#### ルーティング

```typescript
import { MemoryRouter } from 'react-router-dom';

render(
  <MemoryRouter initialEntries={['/error?error=access_denied']}>
    <ErrorPage />
  </MemoryRouter>
);
```

### テスト実行

```bash
cd frontend

# テスト実行
npm test

# ウォッチモード
npm run test:watch

# UI付きテスト
npm run test:ui

# カバレッジレポート生成
npm run test:coverage
```

## テストの原則

### 正常系と異常系

すべての関数・コンポーネントについて、正常系と異常系の両方をテストします。

```typescript
describe('functionName', () => {
  describe('正常系', () => {
    it('期待される動作をする', () => {
      /* ... */
    })
  })

  describe('異常系', () => {
    it('エラー時は適切に処理する', () => {
      /* ... */
    })
  })
})
```

### 異常系テストの観点

- **不正な入力値**: null、undefined、空文字列、不正な型
- **外部サービスエラー**: AWS SDK のエラー（DynamoDB、SSM、Secrets Manager）
- **HTTPエラー**: 4xx、5xx、ネットワークエラー
- **認証・認可エラー**: State不一致、Nonce不一致、Session未存在
- **データフォーマットエラー**: 不正なJSON、不正なCookie

### テストの独立性

- 各テストは独立して実行可能
- テスト間で状態を共有しない
- `beforeEach`/`afterEach` でセットアップ・クリーンアップ

```typescript
beforeEach(() => {
  dynamoMock.reset()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllEnvs()
})
```

## カバレッジ

カバレッジ目標値は設定しませんが、レポートは生成可能です。

```bash
# バックエンド
cd backend && npm run test:coverage

# フロントエンド
cd frontend && npm run test:coverage
```

レポートは各ディレクトリの `coverage/` に出力されます。

## 参考資料

- [Vitest - Getting Started](https://vitest.dev/guide/)
- [aws-sdk-client-mock](https://github.com/m-radzikowski/aws-sdk-client-mock)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
