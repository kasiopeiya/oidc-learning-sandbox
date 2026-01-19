import * as path from 'path';

import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { aws_apigatewayv2 as apigw } from 'aws-cdk-lib';
import { aws_apigatewayv2_integrations as integrations } from 'aws-cdk-lib';
import { aws_cloudfront as cloudfront } from 'aws-cdk-lib';
import { aws_cloudfront_origins as origins } from 'aws-cdk-lib';
import { aws_cognito as cognito } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { aws_lambda_nodejs as nodejs } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_s3_deployment as s3deploy } from 'aws-cdk-lib';
import { Construct } from 'constructs';

/**
 * OIDC学習サンドボックスのメインスタック
 *
 * 以下のリソースを構築する:
 * - Amazon Cognito (OP: OpenID Provider)
 * - Amazon S3 + CloudFront (フロントエンド配信)
 * - Amazon API Gateway + Lambda (RP: Relying Party)
 */
export class OidcSandboxStack extends Stack {
  /** Cognito User Pool - OIDCのOPとして機能 */
  public readonly userPool: cognito.UserPool;

  /** Cognito User Pool Client - RPがOPと通信するためのクライアント */
  public readonly userPoolClient: cognito.UserPoolClient;

  /** Cognito Domain - ホストUIのドメイン */
  public readonly userPoolDomain: cognito.UserPoolDomain;

  /** S3バケット - フロントエンドの静的ファイルをホスティング */
  public readonly websiteBucket: s3.Bucket;

  /** CloudFrontディストリビューション - HTTPSでコンテンツを配信 */
  public readonly distribution: cloudfront.Distribution;

  /** HTTP API - バックエンドAPIのエントリーポイント */
  public readonly httpApi: apigw.HttpApi;

  /** Login Lambda関数 - 認可リクエストURL生成 */
  public readonly loginFunction: nodejs.NodejsFunction;

  /** Callback Lambda関数 - トークン交換・検証 */
  public readonly callbackFunction: nodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // ============================================================
    // Cognito User Pool（OIDC の OP: OpenID Provider）
    // ============================================================

    // User Pool の作成
    // - ユーザーの登録・認証を管理するリソース
    // - OIDC の認可エンドポイント、トークンエンドポイントを提供
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      // サインイン設定: メールアドレスでログイン
      signInAliases: {
        email: true,
      },
      // セルフサインアップを許可（ユーザー自身でアカウント作成可能）
      selfSignUpEnabled: true,
      // メール検証を必須にする
      // Cognito がデフォルトのメール送信機能を使用して検証コードを送信
      userVerification: {
        emailSubject: 'OIDC学習サンドボックス - メールアドレスの確認',
        emailBody:
          'OIDC学習サンドボックスへのご登録ありがとうございます。確認コード: {####}',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      // パスワードポリシー: Cognito のデフォルト設定を使用
      // （8文字以上、大文字・小文字・数字・記号を含む）
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      // MFA: 学習用途のため無効
      mfa: cognito.Mfa.OFF,
      // アカウントリカバリー: メールで回復可能
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      // スタック削除時に User Pool も削除（学習用途のため）
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ============================================================
    // Cognito User Pool Client（OIDC の RP が使用するクライアント）
    // ============================================================

    // App Client の作成
    // - Relying Party（RP）が Cognito と通信するために必要
    // - クライアントシークレットを持つ Confidential Client として設定
    this.userPoolClient = this.userPool.addClient('UserPoolClient', {
      // Confidential Client: クライアントシークレットを生成
      // バックエンド（Lambda）からトークンエンドポイントを呼び出す際に使用
      generateSecret: true,
      // OAuth 2.0 / OIDC の設定
      oAuth: {
        // 認可コードフロー: OIDCの標準的なフロー
        // 認可コードを受け取り、バックエンドでトークンに交換する
        flows: {
          authorizationCodeGrant: true,
        },
        // OAuth スコープ: 取得するユーザー情報の範囲
        // - openid: OIDC 必須スコープ（ID トークンを取得）
        // - email: メールアドレスを取得
        // - profile: プロフィール情報（名前など）を取得
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        // コールバックURL: 認証後のリダイレクト先
        // CloudFront の URL は Issue #3 で設定するため、仮の値を設定
        // 本来は CloudFront デプロイ後に更新が必要
        callbackUrls: ['https://localhost/callback'],
        // サインアウトURL: ログアウト後のリダイレクト先
        logoutUrls: ['https://localhost'],
      },
      // トークンの有効期限設定
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      // PKCE を必須にする設定はクライアント側で実装
      // Cognito は PKCE パラメータがあれば自動的に検証する
    });

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
        domainPrefix: `${this.stackName.toLowerCase()}-${this.account}`,
      },
    });

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
      autoDeleteObjects: true,
    });

    // ============================================================
    // API Gateway HTTP API（バックエンドAPIのエントリーポイント）
    // ============================================================

    // HTTP API の作成
    // - REST API より安価で低レイテンシ
    // - Lambda との統合に必要な基本機能を提供
    // - CORS 設定は CloudFront 経由のため不要
    this.httpApi = new apigw.HttpApi(this, 'HttpApi', {
      // API 名は CDK が自動生成（スタック名がプレフィックスになる）
      description: 'OIDC学習サンドボックス - バックエンドAPI',
    });

    // API Gateway のエンドポイント URL からホスト名を抽出
    // 例: https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com
    // → xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com
    const apiEndpointUrl = this.httpApi.apiEndpoint;
    const apiDomainName = apiEndpointUrl.replace('https://', '');

    // ============================================================
    // CloudFrontディストリビューション（HTTPS配信）
    // ============================================================

    // CloudFront ディストリビューションの作成
    // - S3 の静的ファイルを HTTPS で配信
    // - OAC（Origin Access Control）で S3 へのアクセスを制御
    // - /api/* パスを API Gateway に転送
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      // デフォルトビヘイビア: S3バケットをオリジンとして設定
      // S3BucketOrigin.withOriginAccessControl を使用すると OAC が自動設定される
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.websiteBucket),
        // HTTPS へのリダイレクトを有効化
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      // /api/* パスを API Gateway に転送するビヘイビア
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(apiDomainName),
          // HTTPS へのリダイレクトを有効化
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          // API リクエストはキャッシュしない
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          // オリジンへのリクエストに全てのヘッダー、クエリ文字列、Cookie を転送
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          // GET, HEAD, OPTIONS, PUT, PATCH, POST, DELETE を許可
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
      },
      // ルートアクセス時に返すファイル
      defaultRootObject: 'index.html',
      // 価格クラス: 北米・欧州のみ（コスト削減）
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

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
      distributionPaths: ['/*'],
    });

    // ============================================================
    // Outputs（デプロイ後に確認するための出力）
    // ============================================================

    new CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new CfnOutput(this, 'CognitoDomain', {
      value: this.userPoolDomain.domainName,
      description: 'Cognito Domain',
    });

    new CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL',
    });

    new CfnOutput(this, 'WebsiteBucketName', {
      value: this.websiteBucket.bucketName,
      description: 'S3 Bucket Name for Frontend',
    });

    new CfnOutput(this, 'ApiEndpoint', {
      value: this.httpApi.apiEndpoint,
      description: 'API Gateway HTTP API Endpoint',
    });

    // ============================================================
    // Lambda関数（OIDC の RP: Relying Party）
    // ============================================================

    // Lambda関数の共通設定
    // - Node.js 24.x: 最新の LTS バージョン
    // - arm64: コスト効率が良いアーキテクチャ
    // - メモリ 256MB: 認証処理には十分
    // - タイムアウト 10秒: トークン交換に余裕を持たせる
    const lambdaCommonProps = {
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(10),
      // 環境変数: Cognito 情報と URL
      environment: {
        // Cognito User Pool ID
        COGNITO_USER_POOL_ID: this.userPool.userPoolId,
        // Cognito App Client ID
        COGNITO_CLIENT_ID: this.userPoolClient.userPoolClientId,
        // Cognito App Client Secret（Secrets Manager 推奨だが学習用途のため環境変数で保持）
        COGNITO_CLIENT_SECRET:
          this.userPoolClient.userPoolClientSecret.unsafeUnwrap(),
        // Cognito ドメイン（ホスト UI のベース URL）
        COGNITO_DOMAIN: `https://${this.userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`,
        // 認証後のリダイレクト先 URL（CloudFront 経由）
        REDIRECT_URI: `https://${this.distribution.distributionDomainName}/api/auth/callback`,
        // フロントエンドの URL（CloudFront）
        FRONTEND_URL: `https://${this.distribution.distributionDomainName}`,
      },
      // esbuild によるバンドル設定
      bundling: {
        // 外部パッケージとして扱わない（全てバンドルに含める）
        externalModules: [],
      },
    };

    // Login Lambda関数
    // - /api/auth/login エンドポイントを処理
    // - 認可リクエスト URL を生成し、Cognito にリダイレクト
    this.loginFunction = new nodejs.NodejsFunction(this, 'LoginFunction', {
      ...lambdaCommonProps,
      entry: path.join(__dirname, '../../backend/src/handlers/login.ts'),
      handler: 'handler',
      description: 'OIDC認可リクエストURL生成・リダイレクト',
    });

    // Callback Lambda関数
    // - /api/auth/callback エンドポイントを処理
    // - 認可コードをトークンに交換し、IDトークンを検証
    this.callbackFunction = new nodejs.NodejsFunction(this, 'CallbackFunction', {
      ...lambdaCommonProps,
      entry: path.join(__dirname, '../../backend/src/handlers/callback.ts'),
      handler: 'handler',
      description: 'OIDCコールバック処理（トークン交換・検証）',
    });

    // ============================================================
    // API Gateway ルート定義
    // ============================================================

    // /api/auth/login ルート
    // - GET メソッドで認可リクエストを開始
    this.httpApi.addRoutes({
      path: '/api/auth/login',
      methods: [apigw.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        'LoginIntegration',
        this.loginFunction
      ),
    });

    // /api/auth/callback ルート
    // - GET メソッドで Cognito からのコールバックを処理
    this.httpApi.addRoutes({
      path: '/api/auth/callback',
      methods: [apigw.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        'CallbackIntegration',
        this.callbackFunction
      ),
    });
  }
}
