# Issue #16: Lambda Function URLsにOAC（Origin Access Control）を設定する

### 背景 / 目的

現在、Lambda Function URLsは `authType: NONE` で公開されており、CloudFrontを経由せずに直接アクセスが可能な状態である。
セキュリティを強化し、CloudFront経由でのみLambda関数を呼び出せるようにするため、OAC（Origin Access Control）を設定する。

**OACを導入するメリット:**

- **セキュリティ強化**: Lambda Function URLへの直接アクセスを防止
- **統一的なアクセス制御**: CloudFrontのWAFやレート制限を確実に適用
- **監査ログの一元化**: CloudFront経由のアクセスログで統一的な監視が可能
- **本番環境のベストプラクティス**: AWSが推奨する構成パターン

- 依存: #14（Lambda Function URLs導入のissue）
- ラベル: infra, cdk, security

### 現状の構成

```
CloudFront
  ├── /api/auth/login → Lambda Function URL (authType: NONE) ← 直接アクセス可能
  ├── /api/auth/callback → Lambda Function URL (authType: NONE) ← 直接アクセス可能
  └── /api/account → Lambda Function URL (authType: NONE) ← 直接アクセス可能
```

**問題点:**

- Lambda Function URLが公開されており、CloudFrontをバイパスして直接呼び出せる
- CloudFrontで設定したWAFやレート制限が回避される可能性がある

### 変更後の構成

```
CloudFront (OAC設定)
  ├── /api/auth/login → Lambda Function URL (authType: AWS_IAM) ← CloudFront経由のみ
  ├── /api/auth/callback → Lambda Function URL (authType: AWS_IAM) ← CloudFront経由のみ
  └── /api/account → Lambda Function URL (authType: AWS_IAM) ← CloudFront経由のみ
```

**セキュリティ強化:**

- Lambda Function URLはIAM認証必須となり、直接アクセスは拒否される
- CloudFrontがOACを使用してIAM署名付きリクエストを送信

### スコープ / 作業項目

**CDK修正 (`cdk/lib/oidc-sandbox-stack.ts`)**

1. **Lambda Function URLの認証タイプ変更**
   - `authType: NONE` → `authType: AWS_IAM` に変更
   - 各Lambda関数（login, callback, account）に適用

2. **CloudFront OACの作成**
   - Lambda Function URL用のOACを作成
   - 署名プロトコル: SigV4

3. **CloudFrontオリジンの変更**
   - `HttpOrigin` → `FunctionUrlOrigin`（OAC対応）に変更
   - OACをオリジンに関連付け

4. **Lambda関数のリソースベースポリシー設定**
   - CloudFrontからのアクセスのみを許可するポリシーを追加
   - `lambda:InvokeFunctionUrl` アクションを許可

**設計書の更新**

1. `docs/infrastructure-design.md`
   - 3.4.2節の認証設定を `AWS_IAM` + OAC に更新
   - セキュリティ考慮事項にOACを追加

### ゴール / 完了条件（Acceptance Criteria）

- [ ] Lambda Function URLの認証タイプが `AWS_IAM` になっている
- [ ] CloudFront OACが作成されている
- [ ] CloudFrontからLambda Function URLへのアクセスが正常に動作する
- [ ] Lambda Function URLへの直接アクセスが拒否される（403エラー）
- [ ] `/api/auth/login` へのアクセスでログインフローが開始される
- [ ] `/api/auth/callback` でコールバック処理が正常に動作する
- [ ] `/api/account` で口座作成APIが正常に動作する
- [ ] E2Eテスト（`integration-tests/`）が全てパスする

### テスト観点

- 検証方法:
  - デプロイ後、既存の認証フロー全体が動作することを確認
  - E2Eテストの実行
  - CloudFront経由でのAPI呼び出しが正常に動作することを確認
  - Lambda Function URLへの直接アクセスが拒否されることを確認（curlで検証）

### 技術的な注意点

1. **OACの仕組み**

   ```
   ユーザー → CloudFront → (OAC: SigV4署名) → Lambda Function URL (AWS_IAM認証)
   ```

   CloudFrontがリクエストに署名を付与し、LambdaがIAM認証で検証する

2. **CDK L2 Constructの使用**
   - `origins.FunctionUrlOrigin.withOriginAccessControl()` を使用するとOACが自動設定される
   - S3の `S3BucketOrigin.withOriginAccessControl()` と同様のパターン
   - **注意**: `new FunctionUrlOrigin()` コンストラクタではOACは設定されない

3. **リソースベースポリシーの自動設定**
   - `FunctionUrlOrigin` 使用時、CDKがLambda関数のリソースベースポリシーを自動設定
   - 手動でのポリシー追加は不要

4. **既存のFunction URLとの互換性**
   - `authType` を変更すると、既存のFunction URLへの直接アクセスは即座に拒否される
   - CloudFront経由のアクセスは継続して動作する

### 対象ファイル

| 操作 | ファイル                                                         |
| ---- | ---------------------------------------------------------------- |
| 修正 | `cdk/lib/oidc-sandbox-stack.ts`                                  |
| 修正 | `docs/infrastructure-design.md`                                  |
| 修正 | `docs/issues/14-lambda-function-urls.md`（技術的な注意点の更新） |

### 参考資料

- [Restrict access to an AWS Lambda function URL origin - AWS Documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-lambda.html)
- [aws-cdk-lib.aws_cloudfront_origins.FunctionUrlOrigin](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront_origins.FunctionUrlOrigin.html)
- [Lambda Function URL with IAM authentication](https://docs.aws.amazon.com/lambda/latest/dg/urls-auth.html)
