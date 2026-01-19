/**
 * /api/auth/callback ハンドラー
 *
 * Cognito（OP）からのコールバックを処理し、トークン交換・検証を行う。
 *
 * 処理フロー:
 * 1. URLパラメータから code, state を取得
 * 2. Cookieから state, nonce, code_verifier を取得
 * 3. State 検証（CSRF対策）
 * 4. トークンエンドポイントで認可コードをトークンに交換
 * 5. IDトークンの署名検証
 * 6. Nonce 検証（リプレイ攻撃対策）
 * 7. 検証成功: 成功ページにリダイレクト
 * 8. 検証失敗: エラーページにリダイレクト
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

/**
 * コールバックエンドポイントのハンドラー
 *
 * @param event - API Gateway からのイベント
 * @returns 302 リダイレクトレスポンス（成功時: callback.html、失敗時: error.html）
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Callback handler invoked', {
    path: event.path,
    httpMethod: event.httpMethod,
    queryStringParameters: event.queryStringParameters,
  });

  // TODO: Issue #8 で以下の処理を実装
  // 1. URLパラメータから code, state を取得
  // 2. Cookieから state, nonce, code_verifier を取得
  // 3. openid-client の client.callback() を呼び出し
  //    - State 検証
  //    - トークン交換
  //    - IDトークンの署名検証
  //    - Nonce 検証
  // 4. 成功時: /callback.html にリダイレクト
  // 5. 失敗時: /error.html にリダイレクト

  // 雛形として、仮のレスポンスを返す
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Callback endpoint is working. OIDC flow will be implemented in Issue #8.',
      queryParams: event.queryStringParameters,
      environment: {
        COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID ? 'set' : 'not set',
        COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID ? 'set' : 'not set',
        COGNITO_CLIENT_SECRET: process.env.COGNITO_CLIENT_SECRET ? 'set' : 'not set',
        COGNITO_DOMAIN: process.env.COGNITO_DOMAIN ? 'set' : 'not set',
        REDIRECT_URI: process.env.REDIRECT_URI ? 'set' : 'not set',
        FRONTEND_URL: process.env.FRONTEND_URL ? 'set' : 'not set',
      },
    }),
  };
};
