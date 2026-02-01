import * as path from 'path'

import type { StackProps } from 'aws-cdk-lib'
import { CfnOutput, Duration, RemovalPolicy, SecretValue, Stack } from 'aws-cdk-lib'
import { aws_cloudfront as cloudfront } from 'aws-cdk-lib'
import { aws_cloudfront_origins as origins } from 'aws-cdk-lib'
import { aws_cognito as cognito } from 'aws-cdk-lib'
import { aws_dynamodb as dynamodb } from 'aws-cdk-lib'
import { aws_iam as iam } from 'aws-cdk-lib'
import { aws_lambda as lambda } from 'aws-cdk-lib'
import { aws_lambda_nodejs as nodejs } from 'aws-cdk-lib'
import { aws_s3 as s3 } from 'aws-cdk-lib'
import { aws_s3_deployment as s3deploy } from 'aws-cdk-lib'
import { aws_ssm as ssm } from 'aws-cdk-lib'
import { aws_secretsmanager as secretsmanager } from 'aws-cdk-lib'
import { Construct } from 'constructs'

/**
 * OIDC学習サンドボックスのメインスタック
 *
 * 以下のリソースを構築する:
 * - Amazon Cognito (OP: OpenID Provider)
 * - Amazon S3 + CloudFront (フロントエンド配信)
 * - AWS Lambda + Lambda Function URLs (RP: Relying Party)
 */
export class OidcSandboxStack extends Stack {
  /** Cognito User Pool - OIDCのOPとして機能 */
  public readonly userPool: cognito.UserPool

  /** Cognito User Pool Client - RPがOPと通信するためのクライアント */
  public readonly userPoolClient: cognito.UserPoolClient

  /** Cognito Domain - ホストUIのドメイン */
  public readonly userPoolDomain: cognito.UserPoolDomain

  /** S3バケット - フロントエンドの静的ファイルをホスティング */
  public readonly websiteBucket: s3.Bucket

  /** CloudFrontディストリビューション - HTTPSでコンテンツを配信 */
  public readonly distribution: cloudfront.Distribution

  /** Login Lambda関数 - 認可リクエストURL生成 */
  public readonly loginFunction: nodejs.NodejsFunction

  /** Callback Lambda関数 - トークン交換・検証 */
  public readonly callbackFunction: nodejs.NodejsFunction

  /** Account Lambda関数 - 口座作成API */
  public readonly accountFunction: nodejs.NodejsFunction

  /** セッション管理用DynamoDBテーブル - State/Nonce/PKCE/アクセストークンを保存 */
  public readonly sessionTable: dynamodb.Table

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // ============================================================
    // Cognito User Pool（OIDC の OP: OpenID Provider）
    // ============================================================

    // User Pool の作成
    // - ユーザーの登録・認証を管理するリソース
    // - OIDC の認可エンドポイント、トークンエンドポイントを提供
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      // サインイン設定: メールアドレスでログイン
      signInAliases: {
        email: true
      },
      // セルフサインアップを許可（ユーザー自身でアカウント作成可能）
      selfSignUpEnabled: true,
      // メール検証を必須にする
      // Cognito がデフォルトのメール送信機能を使用して検証コードを送信
      userVerification: {
        emailSubject: 'OIDC学習サンドボックス - メールアドレスの確認',
        emailBody: 'OIDC学習サンドボックスへのご登録ありがとうございます。確認コード: {####}',
        emailStyle: cognito.VerificationEmailStyle.CODE
      },
      // パスワードポリシー: Cognito のデフォルト設定を使用
      // （8文字以上、大文字・小文字・数字・記号を含む）
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true
      },
      // MFA: 学習用途のため無効
      mfa: cognito.Mfa.OFF,
      // アカウントリカバリー: メールで回復可能
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      // スタック削除時に User Pool も削除（学習用途のため）
      removalPolicy: RemovalPolicy.DESTROY
    })

    // ============================================================
    // Cognito User Pool Client（OIDC の RP が使用するクライアント）
    // ============================================================

    // App Client の作成
    // - Relying Party（RP）が Cognito と通信するために必要
    // - クライアントシークレットを持つ Confidential Client として設定
    // 注意: OAuth設定（callbackUrls, logoutUrls）は CloudFront 作成後に設定するため、
    //       ここでは oAuth を指定せず、後から CfnUserPoolClient で設定する
    this.userPoolClient = this.userPool.addClient('UserPoolClient', {
      // Confidential Client: クライアントシークレットを生成
      // バックエンド（Lambda）からトークンエンドポイントを呼び出す際に使用
      generateSecret: true,
      // トークンの有効期限設定
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30)
    })

    // ============================================================
    // Cognito Domain（ホストUI用ドメイン）
    // ============================================================

    // Cognito ドメインの設定
    // - Cognito が提供するログイン画面（ホストUI）にアクセスするためのドメイン
    // - 形式: https://<prefix>.auth.<region>.amazoncognito.com
    this.userPoolDomain = this.userPool.addDomain('UserPoolDomain', {
      // Cognito ドメインプレフィックス
      // Stack 名とアカウントIDを組み合わせてユニークな値を生成
      cognitoDomain: {
        domainPrefix: `${this.stackName.toLowerCase()}-${this.account}`
      }
    })

    // ============================================================
    // DynamoDBテーブル（セッション管理）
    // ============================================================

    // セッション管理用テーブルの作成
    // - State/Nonce/PKCE/アクセストークンをセッションIDに紐付けて保存
    // - TTL（Time To Live）で自動削除（5分）
    this.sessionTable = new dynamodb.Table(this, 'SessionTable', {
      // パーティションキー: セッションID
      partitionKey: {
        name: 'sessionId',
        type: dynamodb.AttributeType.STRING
      },
      // オンデマンドキャパシティ（学習用途のため従量課金）
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // TTL属性を有効化（ttl フィールドで自動削除）
      timeToLiveAttribute: 'ttl',
      // スタック削除時にテーブルも削除（学習用途のため）
      removalPolicy: RemovalPolicy.DESTROY
    })

    // ============================================================
    // S3バケット（フロントエンドの静的ファイル）
    // ============================================================

    // S3バケットの作成
    // - フロントエンドの HTML/JS/CSS を格納
    // - CloudFront 経由でのみアクセス可能（直接アクセスは不可）
    this.websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      // パブリックアクセスを全てブロック（CloudFront経由でのみアクセス）
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      // バージョニング無効（学習用途のため不要）
      versioned: false,
      // スタック削除時にバケットも削除（学習用途のため）
      removalPolicy: RemovalPolicy.DESTROY,
      // バケット削除時にオブジェクトも自動削除
      autoDeleteObjects: true
    })

    // ============================================================
    // CloudFrontディストリビューション（HTTPS配信）
    // ============================================================

    // CloudFront ディストリビューションの作成
    // - S3 の静的ファイルを HTTPS で配信
    // - OAC（Origin Access Control）で S3 へのアクセスを制御
    // - /api/* パスは Lambda Function URLs に転送（Lambda関数定義後に追加）
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      // デフォルトビヘイビア: S3バケットをオリジンとして設定
      // S3BucketOrigin.withOriginAccessControl を使用すると OAC が自動設定される
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.websiteBucket),
        // HTTPS へのリダイレクトを有効化
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      },
      // ルートアクセス時に返すファイル
      defaultRootObject: 'index.html',
      // 価格クラス: 北米・欧州のみ（コスト削減）
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      // SPA対応: 403/404エラー時にindex.htmlへフォールバック
      // React Routerのクライアントサイドルーティングを有効にするために必要
      // - /callback, /error などのパスに直接アクセスした場合、S3は404を返す
      // - CloudFrontがこれをキャッチしてindex.htmlを返すことで、SPAが正しく動作する
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html'
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html'
        }
      ]
    })

    // ============================================================
    // Cognito User Pool Client の OAuth 設定
    // ============================================================

    // CloudFront の URL が確定した後、CfnUserPoolClient を使って OAuth 設定を追加
    // L2 Construct では後から設定を変更できないため、L1 Construct（Cfn）を使用
    const cfnUserPoolClient = this.userPoolClient.node.defaultChild as cognito.CfnUserPoolClient

    // OAuth 2.0 / OIDC の設定を追加
    // - 認可コードフロー: 認可コードを受け取り、バックエンドでトークンに交換
    // - スコープ: openid（OIDC必須）、email、profile
    // - コールバックURL: CloudFront 経由の /api/auth/callback
    cfnUserPoolClient.allowedOAuthFlows = ['code']
    cfnUserPoolClient.allowedOAuthFlowsUserPoolClient = true
    cfnUserPoolClient.allowedOAuthScopes = ['openid', 'email', 'profile']
    cfnUserPoolClient.callbackUrLs = [
      `https://${this.distribution.distributionDomainName}/api/auth/callback`
    ]
    cfnUserPoolClient.logoutUrLs = [`https://${this.distribution.distributionDomainName}`]

    // ============================================================
    // S3へのフロントエンドファイルのデプロイ
    // ============================================================

    // BucketDeployment で frontend/dist の内容を S3 にアップロード
    // - CDK デプロイ時に自動的にファイルがアップロードされる
    // - CloudFront のキャッシュを無効化して、最新のファイルが配信されるようにする
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../frontend/dist'))],
      destinationBucket: this.websiteBucket,
      // CloudFront キャッシュの無効化
      distribution: this.distribution,
      distributionPaths: ['/*']
    })

    // ============================================================
    // Outputs（デプロイ後に確認するための出力）
    // ============================================================

    new CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID'
    })

    new CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID'
    })

    new CfnOutput(this, 'CognitoDomain', {
      value: this.userPoolDomain.domainName,
      description: 'Cognito Domain'
    })

    new CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL'
    })

    new CfnOutput(this, 'WebsiteBucketName', {
      value: this.websiteBucket.bucketName,
      description: 'S3 Bucket Name for Frontend'
    })

    // ============================================================
    // 定数定義: SecretManager のシークレット名
    // ============================================================
    // 樹幹参照エラーを避けるため、ここで定数を定義
    // Cognito User Pool Client のクライアントシークレットを Secrets Manager に保存する場合の名前
    const clientIdName = 'oidc-sandbox/client-id'
    const clientSecretName = 'oidc-sandbox/client-secret'

    // ============================================================
    // Lambda関数（OIDC の RP: Relying Party）
    // ============================================================

    // Lambda関数の共通設定
    // - Node.js 24.x: 最新の LTS バージョン
    // - arm64: コスト効率が良いアーキテクチャ
    // - メモリ 256MB: 認証処理には十分
    // - タイムアウト 10秒: トークン交換に余裕を持たせる
    // 注意: REDIRECT_URI は循環依存を避けるため、CloudFront ビヘイビア追加後に設定する
    const lambdaCommonProps = {
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(10),
      // 環境変数: OIDC Provider（OP）情報と URL
      // OIDC 標準の用語を使用し、Cognito 以外の OP（Auth0、Keycloak 等）にも対応可能
      environment: {
        // OIDC Issuer URL（OP の識別子）
        // Cognito の場合: https://cognito-idp.{region}.amazonaws.com/{userPoolId}
        // OIDC Discovery: {OIDC_ISSUER}/.well-known/openid-configuration
        OIDC_ISSUER: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}`,
        // OIDC Client ID（OP に登録されたクライアント識別子）
        OIDC_CLIENT_ID_KEY: clientIdName,
        // OIDC Client Secretを保存したSecrets Managerのシークレット名
        OIDC_CLIENT_SECRET_KEY: clientSecretName,
        // セッション管理用DynamoDBテーブル名
        SESSION_TABLE_NAME: this.sessionTable.tableName,
        // SSM Parameter Store のパラメータ名（CloudFront URL を取得するため）
        // 循環参照を避けるため、固定値を設定し実行時に SSM API で値を取得
        SSM_CLOUDFRONT_URL_PARAM: '/oidc-sandbox/cloudfront-url'
      },
      // esbuild によるバンドル設定
      bundling: {
        // 外部パッケージとして扱わない（全てバンドルに含める）
        externalModules: []
      }
    }

    // Login Lambda関数
    // - /api/auth/login エンドポイントを処理
    // - 認可リクエスト URL を生成し、OP にリダイレクト
    this.loginFunction = new nodejs.NodejsFunction(this, 'LoginFunction', {
      ...lambdaCommonProps,
      entry: path.join(__dirname, '../../backend/src/handlers/login.ts'),
      handler: 'handler',
      description: 'OIDC認可リクエストURL生成・リダイレクト'
    })

    // Callback Lambda関数
    // - /api/auth/callback エンドポイントを処理
    // - 認可コードをトークンに交換し、IDトークンを検証
    this.callbackFunction = new nodejs.NodejsFunction(this, 'CallbackFunction', {
      ...lambdaCommonProps,
      entry: path.join(__dirname, '../../backend/src/handlers/callback.ts'),
      handler: 'handler',
      description: 'OIDCコールバック処理（トークン交換・検証）'
    })

    // Account Lambda関数
    // - /api/account エンドポイントを処理
    // - アクセストークンで保護されたAPIの実装例
    // - OP の UserInfo エンドポイントでトークンを検証
    this.accountFunction = new nodejs.NodejsFunction(this, 'AccountFunction', {
      ...lambdaCommonProps,
      entry: path.join(__dirname, '../../backend/src/handlers/account.ts'),
      handler: 'handler',
      description: '口座作成API（アクセストークン検証）'
    })

    // ============================================================
    // Lambda Function URLs（API Gateway の代替）
    // ============================================================

    // Login Lambda Function URL
    // - CloudFront から直接 Lambda を呼び出すためのエンドポイント
    // - authType: AWS_IAM により、CloudFront OAC 経由でのみアクセス可能
    const loginFunctionUrl = this.loginFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM
    })

    // Callback Lambda Function URL
    const callbackFunctionUrl = this.callbackFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM
    })

    // Account Lambda Function URL
    const accountFunctionUrl = this.accountFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM
    })

    // ============================================================
    // CloudFront ビヘイビアの追加（Lambda Function URLs 用）
    // ============================================================

    // FunctionUrlOrigin.withOriginAccessControl を使用することで OAC が自動設定される
    // これにより CloudFront 経由でのみ Lambda Function URL にアクセス可能になる

    // /api/auth/login パスを Login Lambda Function URL に転送
    this.distribution.addBehavior(
      '/api/auth/login',
      origins.FunctionUrlOrigin.withOriginAccessControl(loginFunctionUrl),
      {
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD
      }
    )

    // /api/auth/callback パスを Callback Lambda Function URL に転送
    this.distribution.addBehavior(
      '/api/auth/callback',
      origins.FunctionUrlOrigin.withOriginAccessControl(callbackFunctionUrl),
      {
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD
      }
    )

    // /api/account パスを Account Lambda Function URL に転送
    this.distribution.addBehavior(
      '/api/account',
      origins.FunctionUrlOrigin.withOriginAccessControl(accountFunctionUrl),
      {
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL
      }
    )

    // ============================================================
    // SSM Parameter Store（CloudFront URL の保存）
    // ============================================================

    // CloudFront URL を SSM Parameter Store に保存
    // Lambda 関数は固定のパラメータ名を持ち、実行時に SSM API で値を取得する
    // これにより CloudFormation テンプレートレベルでの循環参照を回避
    const ssmParamName = '/oidc-sandbox/cloudfront-url'
    new ssm.StringParameter(this, 'CloudFrontUrlParam', {
      parameterName: ssmParamName,
      stringValue: `https://${this.distribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL for OIDC redirect'
    })

    // ============================================================
    // Secrets Manager Secret の作成
    // ============================================================

    // Cognito の Client ID を Secrets Manager に保存
    // userPoolClientId は文字列なので SecretValue.unsafePlainText() でラップ
    new secretsmanager.Secret(this, 'ClientId', {
      secretName: clientIdName,
      secretStringValue: SecretValue.unsafePlainText(this.userPoolClient.userPoolClientId),
      description: 'OIDC Client ID for Cognito User Pool Client',
      // スタック削除時にSecretも削除（学習用のため）
      removalPolicy: RemovalPolicy.DESTROY
    })

    // Cognito の Client Secret を Secrets Manager に保存
    // userPoolClientSecret は SecretValue 型なので直接渡せる
    new secretsmanager.Secret(this, 'ClientSecret', {
      secretName: clientSecretName,
      secretStringValue: this.userPoolClient.userPoolClientSecret,
      description: 'OIDC Client Secret for Cognito User Pool Client',
      // スタック削除時にSecretも削除（学習用のため）
      removalPolicy: RemovalPolicy.DESTROY
    })

    // ============================================================
    // Lambda 関数への権限付与
    // ============================================================

    // grantRead ではなく addToRolePolicy で直接 IAM ポリシーを追加
    // SSM リソースへの参照を避けることで循環参照を回避
    const ssmReadPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ssm:GetParameter'],
      resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter${ssmParamName}`]
    })

    this.loginFunction.addToRolePolicy(ssmReadPolicy)
    this.callbackFunction.addToRolePolicy(ssmReadPolicy)

    // Secrets Manager からクライアントシークレットを取得する権限を付与
    // L2メソッド（grantRead）を使用するとSecrets Managerリソースへの参照が発生し循環参照になるため、
    // addToRolePolicy でワイルドカードリソースを指定して直接IAMポリシーを追加
    const secretsReadPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: ['*']
    })

    this.loginFunction.addToRolePolicy(secretsReadPolicy)
    this.callbackFunction.addToRolePolicy(secretsReadPolicy)
    this.accountFunction.addToRolePolicy(secretsReadPolicy)

    // Lambda Function URLs の出力
    new CfnOutput(this, 'LoginFunctionUrl', {
      value: loginFunctionUrl.url,
      description: 'Login Lambda Function URL'
    })

    new CfnOutput(this, 'CallbackFunctionUrl', {
      value: callbackFunctionUrl.url,
      description: 'Callback Lambda Function URL'
    })

    new CfnOutput(this, 'AccountFunctionUrl', {
      value: accountFunctionUrl.url,
      description: 'Account Lambda Function URL'
    })

    // ============================================================
    // Lambda関数へのDynamoDB権限付与
    // ============================================================

    // Login関数: セッション作成（PutItem）
    this.sessionTable.grantWriteData(this.loginFunction)

    // Callback関数: セッション取得・削除・保存（GetItem, DeleteItem, PutItem）
    this.sessionTable.grantReadWriteData(this.callbackFunction)

    // Account関数: セッション取得・削除（GetItem, DeleteItem）
    this.sessionTable.grantReadWriteData(this.accountFunction)
  }
}
