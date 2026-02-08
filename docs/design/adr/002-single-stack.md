# ADR-002: 単一スタック構成を採用

## ステータス

採用

## 日付

2026-01-15

## コンテキスト

CDK のスタック設計において、以下の選択肢がありました：

1. **分割スタック構成**
   - Stateful リソース（Cognito, S3, DynamoDB）と Stateless リソース（Lambda, CloudFront）を別スタックに分離
   - Stateful リソースの誤削除リスクを軽減
   - Stateless リソースのみ頻繁に更新可能

2. **単一スタック構成**
   - 全リソースを1つのスタックで管理
   - `cdk deploy` / `cdk destroy` のワンコマンドで環境構築・削除
   - シンプルな管理

## 決定

**単一スタック構成** を採用します。

## 理由

### 採用理由

1. **学習用途の特性**
   - 検証・学習が目的で、データの永続化要件が低い
   - 環境の構築と削除を頻繁に行う可能性がある

2. **運用の簡便性**
   - `cdk deploy` / `cdk destroy` のワンコマンドで完結
   - クロススタック参照（`Fn::ImportValue` など）の複雑さを回避

3. **個人利用**
   - 複数人でのチーム開発ではないため、Stateful リソースの誤削除リスクが低い

### トレードオフ

以下のリスクを受け入れます：

| リスク                    | 本番環境での対策           | 今回の判断               |
| ------------------------- | -------------------------- | ------------------------ |
| Stateful リソースの誤削除 | スタック分割 + 削除保護    | 個人利用のため許容       |
| 全リソースの再作成時間    | Stateful リソースは残す    | 学習用途で再作成は稀     |
| Lambda 更新時の影響範囲   | Stateless スタックのみ更新 | 単一スタックでも問題なし |

## 影響

- `cdk/bin/oidc-sandbox-app.ts` で1つのスタックのみ定義
- スタック削除時は全リソースが削除される（S3, Cognito, DynamoDB を含む）
- 本番環境に移行する場合はスタック分割を検討する必要がある

## スタック構成

```
oidc-sandbox-app (Stack)
├── Cognito User Pool        ← Stateful
├── Cognito User Pool Client
├── Cognito Domain
├── S3 Bucket                ← Stateful
├── CloudFront Distribution  ← Stateless
├── Lambda Functions         ← Stateless
│   ├── LoginFunction
│   ├── CallbackFunction
│   └── AccountFunction
└── DynamoDB Table           ← Stateful
```

## 参照

- CDK実装: `cdk/bin/oidc-sandbox-app.ts`, `cdk/lib/oidc-sandbox-stack.ts`
