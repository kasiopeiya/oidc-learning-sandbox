/**
 * /api/auth/login ハンドラー
 *
 * OIDC認可コードフローの開始点。
 * 認可リクエストURLを生成し、Cognito（OP）にリダイレクトする。
 *
 * 処理フロー:
 * 1. state, nonce, code_verifier を生成（各32バイトの暗号論的に安全なランダム文字列）
 * 2. code_challenge を計算（SHA256 + Base64URL）
 * 3. 生成した値を HttpOnly, Secure, SameSite=Lax の Cookie に保存
 * 4. 認可URLを構築して302リダイレクト
 *
 * セキュリティパラメータの役割:
 * - state: CSRF攻撃対策 - 認可リクエストとコールバックの紐付け
 * - nonce: リプレイ攻撃対策 - IDトークンと認可リクエストの紐付け
 * - code_verifier/code_challenge (PKCE): 認可コード横取り攻撃対策
 */
import {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

import { createOidcCookies } from '../utils/cookie';
import { generateOidcSecurityParams } from '../utils/pkce';

/**
 * 認可リクエストで使用するOAuthスコープ
 *
 * - openid: OIDC必須スコープ（IDトークンを取得）
 * - email: メールアドレスを取得
 * - profile: プロフィール情報（名前など）を取得
 */
const OAUTH_SCOPES = 'openid email profile';

/**
 * ログインエンドポイントのハンドラー
 *
 * ブラウザから /api/auth/login にアクセスすると、
 * Cognito（OP）の認可エンドポイントにリダイレクトされる。
 *
 * @param event - API Gateway HTTP API (v2) からのイベント
 * @returns 302 リダイレクトレスポンス（Cognito 認可エンドポイントへ）
 */
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  console.log('Login handler invoked', {
    path: event.rawPath,
    method: event.requestContext.http.method,
  });

  // ============================================================
  // Step 1: セキュリティパラメータの生成
  // ============================================================

  // state, nonce, code_verifier, code_challenge を一括生成
  // - state: CSRF攻撃対策（Cookieに保存 → 認可URLに含める → コールバックで照合）
  // - nonce: リプレイ攻撃対策（Cookieに保存 → 認可URLに含める → IDトークン内のnonceと照合）
  // - code_verifier: PKCE用の秘密鍵（Cookieに保存 → トークン交換時に送信）
  // - code_challenge: code_verifierのSHA256ハッシュ（認可URLに含める）
  const { state, nonce, codeVerifier, codeChallenge } = generateOidcSecurityParams();

  console.log('Security parameters generated', {
    stateLength: state.length,
    nonceLength: nonce.length,
    codeVerifierLength: codeVerifier.length,
    codeChallengeLength: codeChallenge.length,
  });

  // ============================================================
  // Step 2: 認可URLの構築
  // ============================================================

  // 環境変数から必要な値を取得
  const cognitoDomain = process.env.COGNITO_DOMAIN;
  const clientId = process.env.COGNITO_CLIENT_ID;
  const redirectUri = process.env.REDIRECT_URI;

  // 環境変数が設定されていない場合はエラー
  if (!cognitoDomain || !clientId || !redirectUri) {
    console.error('Missing required environment variables', {
      COGNITO_DOMAIN: cognitoDomain ? 'set' : 'not set',
      COGNITO_CLIENT_ID: clientId ? 'set' : 'not set',
      REDIRECT_URI: redirectUri ? 'set' : 'not set',
    });

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Server configuration error' }),
    };
  }

  // 認可エンドポイントURL: ${COGNITO_DOMAIN}/oauth2/authorize
  const authorizeEndpoint = `${cognitoDomain}/oauth2/authorize`;

  // URLSearchParamsを使用してクエリパラメータを安全に構築
  // これにより特殊文字が適切にURLエンコードされる
  const queryParams = new URLSearchParams({
    // response_type=code: 認可コードフローを使用
    // 認可コードを受け取り、後でトークンエンドポイントでIDトークンに交換する
    response_type: 'code',

    // client_id: Cognito App Client ID
    // どのアプリケーションからのリクエストかを識別
    client_id: clientId,

    // redirect_uri: 認証後のリダイレクト先
    // Cognitoの App Client に設定したものと完全一致が必要
    redirect_uri: redirectUri,

    // scope: 取得する情報の範囲
    // openid は OIDC 必須、email/profile でユーザー情報を取得
    scope: OAUTH_SCOPES,

    // state: CSRF攻撃対策
    // コールバック時にCookieのstateと照合して正当なリクエストか検証
    state: state,

    // nonce: リプレイ攻撃対策
    // IDトークンに埋め込まれ、コールバック時にCookieのnonceと照合
    nonce: nonce,

    // code_challenge: PKCE用のハッシュ値（「鍵穴」）
    // トークン交換時に code_verifier（「鍵」）と照合される
    code_challenge: codeChallenge,

    // code_challenge_method: PKCEのハッシュ方式
    // S256 = SHA256 + Base64URL（推奨方式）
    code_challenge_method: 'S256',
  });

  // 最終的な認可URL
  const authorizationUrl = `${authorizeEndpoint}?${queryParams.toString()}`;

  console.log('Authorization URL constructed', {
    authorizeEndpoint,
    redirectUri,
  });

  // ============================================================
  // Step 3: Cookieの設定と302リダイレクト
  // ============================================================

  // セキュリティパラメータをCookieに保存
  // HttpOnly, Secure, SameSite=Lax で保護
  // - HttpOnly: JavaScriptからアクセス不可（XSS対策）
  // - Secure: HTTPS接続でのみ送信
  // - SameSite=Lax: クロスサイトリクエストでの送信を制限（CSRF対策）
  const cookies = createOidcCookies(state, nonce, codeVerifier);

  // 302 Found でCognitoの認可エンドポイントにリダイレクト
  // API Gateway HTTP API (v2) では cookies 配列を使用してCookieを設定
  return {
    statusCode: 302,
    headers: {
      Location: authorizationUrl,
    },
    // HTTP API v2 形式: cookies 配列で複数のCookieを設定
    cookies: cookies,
    body: '',
  };
};
