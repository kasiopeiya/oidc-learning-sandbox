# ADR-004: OAC + AWS_IAM 認証を採用

## ステータス

採用

## 日付

2026-01-15

## コンテキスト

CloudFront から Lambda Function URL へのアクセス制御方法として、以下の選択肢がありました：

1. **authType: NONE（認証なし）**
   - Lambda Function URL を公開状態にする
   - CloudFront 以外からも直接アクセス可能
   - セキュリティリスクが高い

2. **authType: AWS_IAM + CloudFront OAC**
   - Lambda Function URL を非公開にし、IAM 認証を要求
   - CloudFront が OAC（Origin Access Control）を使用して署名付きリクエストを送信
   - CloudFront 経由のみアクセス可能

## 決定

**authType: AWS_IAM + CloudFront OAC** を採用します。

## 理由

### 採用理由

1. **セキュリティ強化**
   - Lambda Function URL への直接アクセスを防止
   - CloudFront 経由のみアクセスを許可することで、攻撃対象を限定

2. **AWS ベストプラクティス準拠**
   - OAC は AWS が推奨する新しいアクセス制御方式
   - 旧方式の OAI（Origin Access Identity）よりも優れたセキュリティモデル

3. **CDK での実装が容易**
   - `FunctionUrlOrigin.withOriginAccessControl()` で OAC が自動設定される
   - IAM ポリシーも自動生成される

### OAC の仕組み

```
ユーザー → CloudFront → (OAC: SigV4署名) → Lambda Function URL (AWS_IAM認証)
```

- CloudFront が AWS Signature Version 4 で署名されたリクエストを送信
- Lambda Function URL は IAM 認証で CloudFront からのリクエストを検証
- 認証に成功した場合のみリクエストを処理

### S3 オリジンとの一貫性

S3 バケットも OAC で保護されており、アーキテクチャ全体で統一されたアクセス制御を実現：

```
CloudFront
├── S3 オリジン（OAC 経由）
└── Lambda Function URL オリジン（OAC + IAM 経由）
```

### トレードオフ

- 直接 Lambda Function URL を呼び出してテストする場合は、IAM 認証が必要
- ローカル開発時は CloudFront を経由せずにテストする方法を別途用意する必要がある

本プロジェクトでは、結合テストで CloudFront URL を使用するため、この制約は問題ありません。

## 影響

- CDK で `authType: lambda.FunctionUrlAuthType.AWS_IAM` を指定
- CloudFront のオリジンに `FunctionUrlOrigin.withOriginAccessControl()` を使用
- Lambda 関数への直接アクセスは拒否される（403 Forbidden）

## 実装例

```typescript
// Lambda Function URL の作成
const functionUrl = loginFunction.addFunctionUrl({
  authType: lambda.FunctionUrlAuthType.AWS_IAM
})

// CloudFront のオリジン設定
const loginOrigin = origins.FunctionUrlOrigin.withOriginAccessControl(functionUrl)
```

## 参照

- [Lambda Function URLs + OAC 公式ドキュメント](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-lambda.html)
- CDK実装: `cdk/lib/oidc-sandbox-stack.ts`
