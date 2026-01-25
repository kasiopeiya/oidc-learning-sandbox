# Issue #14: API Gatewayを廃止しLambda Function URLsに変更する

### 背景 / 目的

現在、バックエンドAPIはAPI Gateway HTTP APIを経由してLambda関数を呼び出している。
API Gatewayは多機能だが、本プロジェクトのような単純なユースケースではLambda Function URLsで十分であり、以下のメリットがある:

- **コスト削減**: API Gatewayの課金（リクエスト単価）が不要になる
- **シンプルな構成**: API Gatewayリソースの管理が不要になる
- **レイテンシ削減**: API Gatewayを経由しないことで若干のレイテンシ改善が期待できる
- **学習目的**: Lambda Function URLsの実践的な使用方法を学べる

- 依存: #5（API Gateway構築のissue。今回はその逆の作業）
- ラベル: infra, cdk

### 現状の構成

```
CloudFront
  └── /api/* → API Gateway HTTP API
                  ├── /api/auth/login → loginFunction
                  ├── /api/auth/callback → callbackFunction
                  └── /api/account → accountFunction
```

### 変更後の構成

```
CloudFront
  ├── /api/auth/login → Lambda Function URL (loginFunction)
  ├── /api/auth/callback → Lambda Function URL (callbackFunction)
  └── /api/account → Lambda Function URL (accountFunction)
```

### スコープ / 作業項目

**CDK修正 (`cdk/lib/oidc-sandbox-stack.ts`)**

1. **Lambda Function URLsの追加**
   - 各Lambda関数（login, callback, account）にFunction URLを追加
   - 認証タイプ: `NONE`（CloudFront経由のアクセスのため）
   - CORS設定: CloudFront経由のためLambda側では不要

2. **CloudFrontオリジンの変更**
   - API Gateway用の `/api/*` ビヘイビアを削除
   - 各Lambda Function URL用のビヘイビアを追加:
     - `/api/auth/login` → loginFunction URL
     - `/api/auth/callback` → callbackFunction URL
     - `/api/account` → accountFunction URL

3. **API Gatewayリソースの削除**
   - `HttpApi` の削除
   - `HttpLambdaIntegration` の削除
   - 関連するimportの削除

4. **CfnOutputの更新**
   - `ApiEndpoint` を削除または Lambda Function URLs に変更

5. **循環参照の解決（Parameter Store方式）**
   - `ssm.StringParameter`でCloudFront URLをSSM Parameter Storeに保存
   - パラメータ名: `/oidc-sandbox/cloudfront-url`（固定値）
   - Lambda関数の環境変数から `REDIRECT_URI` を削除
   - 代わりに `SSM_CLOUDFRONT_URL_PARAM` 環境変数に固定のパラメータ名を設定
   - Lambda関数にSSM読み取り権限を付与（`grantRead`ではなく`addToRolePolicy`で直接指定し、SSMリソースへの参照を回避）

**バックエンドLambda関数の修正**

1. **イベントフォーマット（確認のみ）**
   - イベント型: `APIGatewayProxyEventV2` (Lambda Function URLsは同じPayload Format Version 2.0を使用)
   - レスポンス型: 変更なし
   - ※ 現在HTTP API（v2）を使用しているため、イベント形式の変更は不要

2. **REDIRECT_URI取得方法の変更**
   - `login.ts`: 環境変数 → SSM Parameter Store から取得に変更
   - `callback.ts`: 環境変数 → SSM Parameter Store から取得に変更
   - SSMパラメータの値をキャッシュして、毎回のAPI呼び出しを回避

**設計書の更新**

1. `docs/infrastructure-design.md`
   - システム全体構成図の更新（API GatewayをLambda Function URLsに変更）
   - CloudFrontのルーティング説明の更新
   - リクエストフローの更新
   - セクション3.4「Amazon API Gateway」を「Lambda Function URLs」に変更
   - スタック構成図の更新
   - コスト見積もりの更新（API Gateway課金の削除）

2. `docs/backend-design.md`
   - シーケンス図内のAPI Gateway言及を削除
   - リクエストフローの更新

3. `docs/requirements.md`
   - 技術スタック欄の更新（バックエンド: API Gateway + Lambda → Lambda Function URLs）
   - 将来機能から本項目を削除（実装済みに移動）

### ゴール / 完了条件（Acceptance Criteria）

- [ ] API Gateway HTTP API が削除されている
- [ ] 各Lambda関数にFunction URLが設定されている
- [ ] CloudFrontから各Lambda Function URLへのルーティングが正しく設定されている
- [ ] SSM Parameter StoreにCloudFront URLが保存されている
- [ ] Lambda関数がSSMからREDIRECT_URIを取得できている
- [ ] `/api/auth/login` へのアクセスでログインフローが開始される
- [ ] `/api/auth/callback` でコールバック処理が正常に動作する
- [ ] `/api/account` で口座作成APIが正常に動作する
- [ ] E2Eテスト（`integration-tests/`）が全てパスする

### テスト観点

- 検証方法:
  - デプロイ後、既存の認証フロー全体が動作することを確認
  - E2Eテストの実行
  - CloudFront経由でのAPI呼び出しが正常に動作することを確認
  - Lambda Function URLの直接呼び出しが可能であることを確認（オプション）

### 技術的な注意点

1. **Lambda Function URLのIAM認証**
   - 学習用途のため `AuthType: NONE` を使用
   - 本番環境では `AuthType: AWS_IAM` + CloudFront OACの使用を検討

2. **CloudFrontビヘイビアのパス設定**
   - Lambda Function URLsはパスをそのまま受け取るため、CloudFrontでのパス書き換えは不要
   - キャッシュ無効化設定を各ビヘイビアに適用

3. **イベントフォーマットの互換性**
   - HTTP API（Payload Format 2.0）とLambda Function URLsは同じイベント形式を使用
   - 既存のハンドラーコードは最小限の変更で動作する見込み

4. **循環参照の問題と解決策**

   Lambda Function URLsに移行すると、以下の循環参照が発生する:

   ```
   UserPoolClient → CloudFront (callbackUrLs設定で distributionDomainName 参照)
       ↑                ↓
   Lambda Function ← Function URL
   (UserPoolClient参照)
   ```

   **根本原因の分析**:
   1. **UserPoolClient** → **CloudFront**: CfnUserPoolClientの`callbackUrLs`設定で`distribution.distributionDomainName`を参照
   2. **CloudFront** → **Lambda Function URLs**: `addBehavior()`でFunction URLオリジンを追加
   3. **Lambda Function URLs** → **Lambda Functions**: Function URLはLambda関数のサブリソース
   4. **Lambda Functions** → **UserPoolClient**: 環境変数で`userPoolClient.userPoolClientId`や`userPoolClient.userPoolClientSecret`を参照

   これにより完全な循環依存が形成される。

   **解決策**: Secrets Manager方式

   Lambda関数がUserPoolClientを直接参照しないようにする:

   1. **ClientIdとClientSecretをSecrets Managerに保存**
      - `secretsmanager.Secret`でClientIdとClientSecretを保存
      - シークレット名は固定値（`oidc-sandbox/client-id`, `oidc-sandbox/client-secret`）
      - Secrets ManagerがUserPoolClientの値を参照するが、Lambda関数はSecrets Managerリソースを参照しない

   2. **Lambda関数の環境変数変更**
      - `OIDC_CLIENT_ID`、`OIDC_CLIENT_SECRET`を削除（直接参照を断つ）
      - `OIDC_CLIENT_ID_KEY`、`OIDC_CLIENT_SECRET_KEY`を追加（シークレット名の文字列）

   3. **Lambda IAMポリシーの重要な制約**
      - **L2メソッド（`grantRead`）を使用してはいけない**
      - `addToRolePolicy`でIAMポリシーを直接追加
      - リソースは**ワイルドカード（`*`）**で指定（すべてのSecrets Managerシークレットを取得可能にする）
      - 特定のシークレットARNを指定すると、Secrets Managerリソースへの参照が発生し循環参照になる

   4. **Lambda関数でSecrets Managerから取得**
      - 実行時にSecrets Manager APIでシークレットを取得
      - Lambda初期化時にキャッシュして効率化

   5. **SSM Parameter StoreでCloudFront URL管理**（既存の方式維持）
      - CloudFront URLは引き続きSSM Parameter Storeに保存
      - Lambda関数は実行時にSSM APIで取得

   ```
   【CloudFormation依存関係】（循環を解消）
   Secrets Manager → UserPoolClient（値のみ参照）
   UserPoolClient → CloudFront → Function URL → Lambda Function
                                                     ↓
                                            IAMポリシーはワイルドカード
                                            （リソース参照なし）

   【実行時】
   Lambda関数 → Secrets Manager API → ClientId/ClientSecret取得
            → SSM API → CloudFront URL取得
   ```

   **CDK実装例**:

   ```typescript
   // シークレット名（固定値）
   const clientIdName = 'oidc-sandbox/client-id';
   const clientSecretName = 'oidc-sandbox/client-secret';

   // Lambda環境変数にはシークレット名のみ設定
   environment: {
     OIDC_CLIENT_ID_KEY: clientIdName,
     OIDC_CLIENT_SECRET_KEY: clientSecretName,
   },

   // Secrets ManagerにClientIdとClientSecretを保存
   new secretsmanager.Secret(this, 'ClientId', {
     secretName: clientIdName,
     secretStringValue: SecretValue.unsafePlainText(
       this.userPoolClient.userPoolClientId
     ),
   });

   new secretsmanager.Secret(this, 'ClientSecret', {
     secretName: clientSecretName,
     secretStringValue: this.userPoolClient.userPoolClientSecret,
   });

   // Lambda IAMポリシー（L2メソッドを使わない、ワイルドカードリソース）
   const secretsReadPolicy = new iam.PolicyStatement({
     effect: iam.Effect.ALLOW,
     actions: ['secretsmanager:GetSecretValue'],
     resources: ['*'],  // ワイルドカードで循環参照を回避
   });

   this.loginFunction.addToRolePolicy(secretsReadPolicy);
   this.callbackFunction.addToRolePolicy(secretsReadPolicy);
   ```

   **メリット**:
   - CloudFormationテンプレートレベルで循環依存を解消
   - クライアントシークレットをSecrets Managerで安全に管理（ベストプラクティス）
   - Lambda環境変数に平文のシークレットを保存しない（セキュリティ向上）

   **注意点**:
   - IAMポリシーのリソースをワイルドカードにするのは学習用途のため
   - 本番環境ではCondition句やタグベースの制限を検討

### 対象ファイル

| 操作 | ファイル |
|------|----------|
| 修正 | `cdk/lib/oidc-sandbox-stack.ts` |
| 修正 | `backend/src/handlers/login.ts` |
| 修正 | `backend/src/handlers/callback.ts` |
| 確認 | `backend/src/handlers/account.ts` |
| 修正 | `backend/src/utils/oidc-config.ts` (Secrets Manager経由でClientId/ClientSecretを取得) |
| 新規 | `backend/src/utils/secrets.ts` (Secrets Manager取得ユーティリティ) |
| 既存 | `backend/src/utils/ssm.ts` (SSMパラメータ取得ユーティリティ、変更なし) |
| 修正 | `docs/infrastructure-design.md` |
| 修正 | `docs/backend-design.md` |
| 修正 | `docs/requirements.md` |

### 参考資料

- [Lambda Function URLs - AWS Documentation](https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html)
- [CloudFront with Lambda Function URLs](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DownloadDistS3AndCustomOrigins.html)
