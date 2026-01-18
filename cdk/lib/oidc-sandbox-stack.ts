import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { aws_cognito as cognito } from 'aws-cdk-lib';
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

    // TODO: Issue #3 - S3 + CloudFront構築
    // TODO: Issue #5 - API Gateway構築
    // TODO: Issue #6 - Lambda関数作成
  }
}
