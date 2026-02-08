# ADR-003: NodejsFunction を採用

## ステータス

採用

## 日付

2026-01-15

## コンテキスト

CDK で Lambda 関数を定義する際、以下の選択肢がありました：

1. **aws-cdk-lib/aws-lambda の Function**
   - 標準の Lambda Construct
   - TypeScript のビルドとバンドルを手動で設定する必要がある

2. **aws-cdk-lib/aws-lambda-nodejs の NodejsFunction**
   - TypeScript を直接指定可能
   - esbuild で自動バンドル
   - tree-shaking による最適化

## 決定

**NodejsFunction** を採用します。

## 理由

### 採用理由

| 項目                | NodejsFunction          | 通常の Function     |
| ------------------- | ----------------------- | ------------------- |
| TypeScript サポート | ✅ 自動トランスパイル   | ❌ 手動ビルドが必要 |
| バンドル            | ✅ esbuild で自動       | ❌ 手動設定が必要   |
| tree-shaking        | ✅ 自動で不要コード削除 | ❌ なし             |
| 設定の簡潔さ        | ✅ シンプル             | ❌ 複雑             |

### 具体的なメリット

1. **開発効率の向上**
   - TypeScript のソースコードを直接 `entry` に指定できる
   - ビルドプロセスを CDK に任せられる

2. **デプロイサイズの最適化**
   - esbuild の tree-shaking により、使用していない依存関係が除外される
   - Lambda のコールドスタート時間が短縮される

3. **保守性の向上**
   - ビルド設定を CDK コード内で完結できる
   - 別途 webpack や tsup の設定ファイルが不要

### トレードオフ

以下の制約を受け入れます：

- Node.js ランタイム限定（他の言語では使用不可）
- esbuild の制約（native modules の扱いに注意が必要）

本プロジェクトは Node.js/TypeScript のみを使用するため、これらの制約は問題ありません。

## 影響

- CDK コードで `NodejsFunction` を使用
- `backend/src/handlers/` 配下の TypeScript ファイルを直接 `entry` に指定
- esbuild の設定（target, format など）は NodejsFunction のデフォルトを使用

## 実装例

```typescript
import { aws_lambda_nodejs as nodejs } from 'aws-cdk-lib'

const loginFunction = new nodejs.NodejsFunction(this, 'LoginFunction', {
  entry: path.join(__dirname, '../../backend/src/handlers/login.ts'),
  runtime: lambda.Runtime.NODEJS_24_X,
  architecture: lambda.Architecture.ARM_64,
  timeout: Duration.seconds(10),
  memorySize: 256
})
```

## 参照

- [NodejsFunction 公式ドキュメント](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda_nodejs-readme.html)
- CDK実装: `cdk/lib/oidc-sandbox-stack.ts`
