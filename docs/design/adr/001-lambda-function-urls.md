# ADR-001: Lambda Function URLs を選択

## ステータス

採用

## 日付

2026-01-15

## コンテキスト

バックエンドAPIの公開方法として、以下の選択肢がありました：

1. **API Gateway (HTTP API / REST API)**
   - AWS標準のAPIゲートウェイサービス
   - 豊富な機能（スロットリング、APIキー管理、カスタムドメインなど）
   - 追加のコスト発生

2. **Lambda Function URLs**
   - Lambda関数に直接HTTPSエンドポイントを付与
   - シンプルな構成
   - Lambda料金のみで追加コストなし

## 決定

**Lambda Function URLs** を採用します。

## 理由

### 採用理由

1. **学習用途に適したシンプルさ**
   - OIDC学習が主目的であり、API Gateway の高度な機能は不要
   - インフラ構成を最小限にし、学習者が理解しやすくする

2. **コスト削減**
   - Lambda の料金のみで、API Gateway の追加課金が発生しない
   - 無料枠内で運用可能

3. **CloudFront との組み合わせ**
   - CloudFront + OAC で Lambda Function URL を保護できる
   - 単一ドメインでフロントエンドとバックエンドを提供可能

### トレードオフ

以下の機能は利用できませんが、学習用途では不要と判断：

| API Gateway の機能       | 必要性                                 |
| ------------------------ | -------------------------------------- |
| リクエストスロットリング | ✗ 学習用途で大量リクエストは想定しない |
| APIキー管理              | ✗ 認証はOIDCで実施                     |
| カスタムドメイン設定     | ✗ CloudFrontのデフォルトドメインで十分 |
| 詳細なアクセスログ       | ✗ Lambda の CloudWatch Logs で十分     |

## 影響

- CDK の実装がシンプルになる（`addFunctionUrl()` のみ）
- 本番環境に移行する場合は API Gateway への移行を検討する必要がある
- CloudFront のビヘイビア設定で各 Lambda Function URL をオリジンとして登録

## 参照

- [Lambda Function URLs 公式ドキュメント](https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html)
- CDK実装: `cdk/lib/oidc-sandbox-stack.ts`
