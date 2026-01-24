/**
 * OIDC Configuration ユーティリティ
 *
 * openid-client ライブラリを使用して OIDC Discovery を実行し、
 * OP（OpenID Provider）の設定情報を取得・キャッシュする。
 *
 * OIDC Discovery により、以下のエンドポイントを自動取得:
 * - authorization_endpoint: 認可エンドポイント
 * - token_endpoint: トークンエンドポイント
 * - userinfo_endpoint: UserInfo エンドポイント
 * - jwks_uri: JWKSエンドポイント（公開鍵の取得先）
 *
 * これにより、Cognito以外のOP（Auth0、Keycloak、Google等）にも対応可能。
 */
import * as client from 'openid-client';

/**
 * OIDC Configuration のキャッシュ
 *
 * Lambda のウォームスタート時に再利用することで、
 * OIDC Discovery のリクエストを削減する。
 */
let cachedConfig: client.Configuration | null = null;

/**
 * キャッシュされた Issuer URL
 *
 * 環境変数が変更された場合にキャッシュを無効化するために使用。
 */
let cachedIssuer: string | null = null;

/**
 * 環境変数から OIDC 設定を取得
 *
 * @returns OIDC 設定オブジェクト
 * @throws 必要な環境変数が設定されていない場合
 */
export function getOidcEnvVars(): {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const issuer = process.env.OIDC_ISSUER;
  const clientId = process.env.OIDC_CLIENT_ID;
  const clientSecret = process.env.OIDC_CLIENT_SECRET;
  const redirectUri = process.env.REDIRECT_URI;

  // 必要な環境変数の存在確認
  if (!issuer || !clientId || !clientSecret || !redirectUri) {
    console.error('Missing required OIDC environment variables', {
      OIDC_ISSUER: issuer ? 'set' : 'not set',
      OIDC_CLIENT_ID: clientId ? 'set' : 'not set',
      OIDC_CLIENT_SECRET: clientSecret ? 'set' : 'not set',
      REDIRECT_URI: redirectUri ? 'set' : 'not set',
    });
    throw new Error('Missing required OIDC environment variables');
  }

  return { issuer, clientId, clientSecret, redirectUri };
}

/**
 * OIDC Discovery を実行して Configuration を取得
 *
 * Issuer URL の /.well-known/openid-configuration にアクセスし、
 * 各種エンドポイントの情報を自動取得する。
 *
 * @returns openid-client の Configuration インスタンス
 * @throws Discovery に失敗した場合
 */
export async function getOidcConfig(): Promise<client.Configuration> {
  const { issuer, clientId, clientSecret } = getOidcEnvVars();

  // Issuer が変更された場合はキャッシュを無効化
  if (cachedConfig && cachedIssuer === issuer) {
    return cachedConfig;
  }

  const issuerUrl = new URL(issuer);

  console.log('Starting OIDC Discovery', { issuerUrl: issuerUrl.toString() });

  // OIDC Discovery を実行
  // - /.well-known/openid-configuration にアクセス
  // - authorization_endpoint, token_endpoint, userinfo_endpoint, jwks_uri などを自動取得
  cachedConfig = await client.discovery(
    issuerUrl,
    clientId,
    clientSecret // ClientSecretPost がデフォルトで使用される
  );

  cachedIssuer = issuer;

  console.log('OIDC Discovery completed');

  return cachedConfig;
}

/**
 * 認可エンドポイント URL を取得
 *
 * OIDC Discovery から取得した authorization_endpoint を返す。
 *
 * @returns 認可エンドポイント URL
 * @throws Discovery に失敗した場合、または認可エンドポイントが存在しない場合
 */
export async function getAuthorizationEndpoint(): Promise<string> {
  const config = await getOidcConfig();

  // ServerMetadata から authorization_endpoint を取得
  const authorizationEndpoint = config.serverMetadata().authorization_endpoint;

  if (!authorizationEndpoint) {
    throw new Error('authorization_endpoint not found in OIDC Discovery');
  }

  return authorizationEndpoint;
}

/**
 * UserInfo エンドポイント URL を取得
 *
 * OIDC Discovery から取得した userinfo_endpoint を返す。
 *
 * @returns UserInfo エンドポイント URL
 * @throws Discovery に失敗した場合、または UserInfo エンドポイントが存在しない場合
 */
export async function getUserInfoEndpoint(): Promise<string> {
  const config = await getOidcConfig();

  // ServerMetadata から userinfo_endpoint を取得
  const userInfoEndpoint = config.serverMetadata().userinfo_endpoint;

  if (!userInfoEndpoint) {
    throw new Error('userinfo_endpoint not found in OIDC Discovery');
  }

  return userInfoEndpoint;
}

/**
 * キャッシュをクリア（テスト用）
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  cachedIssuer = null;
}
