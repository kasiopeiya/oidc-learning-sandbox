/**
 * /api/auth/login ハンドラー
 *
 * OIDC認可コードフローの開始点。
 * 認可リクエストURLを生成し、OP（OpenID Provider）にリダイレクトする。
 *
 * 処理フロー:
 * 1. セッションIDを生成（暗号論的に安全なランダム文字列）
 * 2. state, nonce, code_verifier を生成（各32バイト）
 * 3. code_challenge を計算（SHA256 + Base64URL）
 * 4. セッションIDをキーにして、state/nonce/code_verifier を DynamoDB に保存
 * 5. セッションIDを HttpOnly, Secure, SameSite=Lax の Cookie に保存
 * 6. OIDC Discovery から認可エンドポイントを取得
 * 7. 認可URLを構築して302リダイレクト
 *
 * セキュリティパラメータの役割:
 * - state: CSRF攻撃対策 - 認可リクエストとコールバックの紐付け
 * - nonce: リプレイ攻撃対策 - IDトークンと認可リクエストの紐付け
 * - code_verifier/code_challenge (PKCE): 認可コード横取り攻撃対策
 *
 * DynamoDB管理のメリット:
 * - セキュリティパラメータがブラウザに渡らない（XSS対策）
 * - サーバーサイドで一元管理できる
 * - TTLで自動削除される
 */
import {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

import { getAuthorizationEndpoint, getOidcEnvVars } from '../utils/oidc-config';
import { generateOidcSecurityParams } from '../utils/pkce';
import {
  createSessionCookie,
  generateSessionId,
  saveSession,
} from '../utils/session';

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
 * OP（OpenID Provider）の認可エンドポイントにリダイレクトされる。
 *
 * @param event - API Gateway HTTP API (v2) からのイベント
 * @returns 302 リダイレクトレスポンス（OP 認可エンドポイントへ）
 */
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  console.log('Login handler invoked', {
    path: event.rawPath,
    method: event.requestContext.http.method,
  });

  // ============================================================
  // Step 1: セッションIDとセキュリティパラメータの生成
  // ============================================================

  // セッションIDを生成（256ビットのランダム文字列）
  // このIDをCookieに保存し、DynamoDBのキーとして使用
  const sessionId = generateSessionId();

  // state, nonce, code_verifier, code_challenge を一括生成
  // - state: CSRF攻撃対策（DynamoDBに保存 → 認可URLに含める → コールバックで照合）
  // - nonce: リプレイ攻撃対策（DynamoDBに保存 → 認可URLに含める → IDトークン内のnonceと照合）
  // - code_verifier: PKCE用の秘密鍵（DynamoDBに保存 → トークン交換時に送信）
  // - code_challenge: code_verifierのSHA256ハッシュ（認可URLに含める）
  const { state, nonce, codeVerifier, codeChallenge } = generateOidcSecurityParams();

  console.log('Session and security parameters generated', {
    sessionIdLength: sessionId.length,
    stateLength: state.length,
    nonceLength: nonce.length,
    codeVerifierLength: codeVerifier.length,
    codeChallengeLength: codeChallenge.length,
  });

  // ============================================================
  // Step 2: セッションデータをDynamoDBに保存
  // ============================================================

  // セッションIDをキーにして、セキュリティパラメータをDynamoDBに保存
  // TTL（5分）が設定され、自動的に削除される
  try {
    await saveSession(sessionId, { state, nonce, codeVerifier });
  } catch (error) {
    console.error('Failed to save session to DynamoDB', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to initialize session' }),
    };
  }

  // ============================================================
  // Step 3: OIDC Discovery から認可エンドポイントを取得
  // ============================================================

  let authorizeEndpoint: string;
  let clientId: string;
  let redirectUri: string;

  try {
    // 環境変数から OIDC 設定を取得
    const envVars = getOidcEnvVars();
    clientId = envVars.clientId;
    redirectUri = envVars.redirectUri;

    // OIDC Discovery を実行して認可エンドポイントを取得
    // これにより、OP が Cognito、Auth0、Keycloak 等に関わらず動作する
    authorizeEndpoint = await getAuthorizationEndpoint();
  } catch (error) {
    console.error('Failed to get OIDC configuration', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Server configuration error' }),
    };
  }

  // ============================================================
  // Step 4: 認可URLの構築
  // ============================================================

  // URLSearchParamsを使用してクエリパラメータを安全に構築
  // これにより特殊文字が適切にURLエンコードされる
  const queryParams = new URLSearchParams({
    // response_type=code: 認可コードフローを使用
    // 認可コードを受け取り、後でトークンエンドポイントでIDトークンに交換する
    response_type: 'code',

    // client_id: OP に登録されたクライアント ID
    // どのアプリケーションからのリクエストかを識別
    client_id: clientId,

    // redirect_uri: 認証後のリダイレクト先
    // OP に設定したものと完全一致が必要
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
  // Step 5: セッションCookieの設定と302リダイレクト
  // ============================================================

  // セッションIDをCookieに保存（セキュリティパラメータはDynamoDBに保存済み）
  // HttpOnly, Secure, SameSite=Lax で保護
  // - HttpOnly: JavaScriptからアクセス不可（XSS対策）
  // - Secure: HTTPS接続でのみ送信
  // - SameSite=Lax: OPからのリダイレクト時にCookieが送信されるよう設定
  const sessionCookie = createSessionCookie(sessionId);

  // 302 Found でOPの認可エンドポイントにリダイレクト
  // API Gateway HTTP API (v2) では cookies 配列を使用してCookieを設定
  return {
    statusCode: 302,
    headers: {
      Location: authorizationUrl,
    },
    // HTTP API v2 形式: セッションIDのみをCookieに保存
    cookies: [sessionCookie],
    body: '',
  };
};
