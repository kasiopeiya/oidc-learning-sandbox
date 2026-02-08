# ADR-006: CDK スナップショットテストなし

## ステータス

採用

## 日付

2026-01-15

## コンテキスト

CDK では、生成される CloudFormation テンプレートを保存し、変更時に差分を検出する**スナップショットテスト**が一般的に推奨されます。

### スナップショットテストとは

```typescript
import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
import { OidcSandboxStack } from '../lib/oidc-sandbox-stack'

test('Snapshot test', () => {
  const app = new cdk.App()
  const stack = new OidcSandboxStack(app, 'TestStack')
  const template = Template.fromStack(stack)
  expect(template.toJSON()).toMatchSnapshot() // CloudFormation テンプレートを保存
})
```

### スナップショットテストのメリット

- 意図しないインフラ変更を検出できる
- レビュー時に CloudFormation の差分を確認できる
- リグレッションを防止できる

## 決定

**CDK スナップショットテストは実施しません。**

## 理由

### 採用理由

| 観点     | 理由                                            |
| -------- | ----------------------------------------------- |
| 規模     | 小規模な学習用プロジェクト（単一スタック）      |
| 変更頻度 | 頻繁な変更は想定しない                          |
| 運用     | 個人利用のため、意図しない変更のリスクが低い    |
| 目的     | OIDC の学習が主目的であり、CDK のテストは範囲外 |
| 複雑性   | テストコードの保守コストが学習用途には過剰      |

### 代替手段

スナップショットテストの代わりに、以下の方法で品質を担保します：

1. **`cdk diff` による変更確認**
   - デプロイ前に `cdk diff` で変更内容を確認
   - 意図しない変更がないか目視でチェック

2. **結合テストによる動作確認**
   - デプロイ後に Playwright で結合テストを実施
   - インフラが正しく動作することを確認

## 影響

- `cdk/test/` ディレクトリにスナップショットテストは含まれない
- インフラ変更時は `cdk diff` と結合テストで品質を担保
- 本番環境に移行する場合はスナップショットテストの導入を推奨

## 本番環境での推奨事項

本番環境やチーム開発では、以下の理由からスナップショットテストを導入すべきです：

- 複数人での開発で意図しない変更を防止
- CI/CD パイプラインでの自動チェック
- インフラ変更のレビュープロセスに組み込む

## 参照

- [CDK Testing 公式ドキュメント](https://docs.aws.amazon.com/cdk/v2/guide/testing.html)
- 結合テスト: `integration-tests/`
