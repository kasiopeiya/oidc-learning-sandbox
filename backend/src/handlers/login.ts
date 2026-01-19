/**
 * /api/auth/login ハンドラー
 *
 * OIDC認可コードフローの開始点。
 * 認可リクエストURLを生成し、Cognito（OP）にリダイレクトする。
 *
 * 処理フロー:
 * 1. state, nonce, code_verifier を生成
 * 2. code_challenge を計算（PKCE）
 * 3. 生成した値を Cookie に保存
 * 4. 認可URLを構築して302リダイレクト
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

/**
 * ログインエンドポイントのハンドラー
 *
 * @param event - API Gateway からのイベント
 * @returns 302 リダイレクトレスポンス（Cognito 認可エンドポイントへ）
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Login handler invoked', {
    path: event.path,
    httpMethod: event.httpMethod,
  });

  // TODO: Issue #7 で以下の処理を実装
  // 1. state, nonce, code_verifier を生成（各32バイトのランダム文字列）
  // 2. code_challenge を計算（SHA256 + Base64URL）
  // 3. 生成した値を Cookie に保存
  // 4. 認可URLを構築して302リダイレクト

  // 雛形として、仮のレスポンスを返す
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Login endpoint is working. OIDC flow will be implemented in Issue #7.',
      environment: {
        COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID ? 'set' : 'not set',
        COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID ? 'set' : 'not set',
        COGNITO_DOMAIN: process.env.COGNITO_DOMAIN ? 'set' : 'not set',
        REDIRECT_URI: process.env.REDIRECT_URI ? 'set' : 'not set',
        FRONTEND_URL: process.env.FRONTEND_URL ? 'set' : 'not set',
      },
    }),
  };
};
