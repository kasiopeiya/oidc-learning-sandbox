/**
 * /api/account ハンドラー
 *
 * 口座作成APIエンドポイント。
 * アクセストークンで保護されたAPIのパターンを学習するための実装。
 *
 * 処理フロー:
 * 1. CookieからセッションIDを取得
 * 2. DynamoDBからアクセストークンを取得
 * 3. Cognito UserInfoエンドポイントでトークン検証
 * 4. 口座番号（ダミー）を生成して返却
 * 5. セッションデータをDynamoDBから削除
 *
 * セキュリティポイント:
 * - アクセストークンはブラウザに渡らない（DynamoDBで管理）
 * - UserInfoエンドポイントでトークンの有効性を検証
 * - 処理完了後にセッションを即座に削除
 */
import * as crypto from 'crypto';

import {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda';

import {
  createDeleteSessionCookie,
  deleteSession,
  getAuthenticatedSession,
  getSessionIdFromCookie,
} from '../utils/session';

/**
 * 口座作成APIのレスポンス型
 */
interface AccountResponse {
  /** 生成された口座番号 */
  accountNumber: string;
  /** ユーザーのメールアドレス */
  email: string;
  /** ユーザーの一意識別子 */
  sub: string;
}

/**
 * エラーレスポンス型
 */
interface ErrorResponse {
  /** エラーメッセージ */
  error: string;
  /** エラーコード */
  code: string;
}

/**
 * Cognito UserInfoエンドポイントからユーザー情報を取得する
 *
 * アクセストークンの有効性を検証し、ユーザー情報を取得する。
 * トークンが無効な場合はnullを返す。
 *
 * @param accessToken - Cognitoのアクセストークン
 * @returns ユーザー情報（sub, email）、無効な場合はnull
 */
async function verifyTokenWithUserInfo(
  accessToken: string
): Promise<{ sub: string; email: string } | null> {
  const userPoolId = process.env.COGNITO_USER_POOL_ID!;
  const region = userPoolId.split('_')[0]; // ap-northeast-1_XXXXX → ap-northeast-1

  // Cognito UserInfo エンドポイントのURL
  // 形式: https://cognito-idp.{region}.amazonaws.com/{userPoolId}/oauth2/userInfo
  const userInfoUrl = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/oauth2/userInfo`;

  console.log('Calling UserInfo endpoint', { userInfoUrl });

  try {
    // UserInfoエンドポイントにアクセストークンを送信
    // Bearer認証を使用
    const response = await fetch(userInfoUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // レスポンスステータスを確認
    if (!response.ok) {
      console.error('UserInfo request failed', {
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    // ユーザー情報をパース
    const userInfo = (await response.json()) as { sub: string; email: string };

    console.log('UserInfo response received', {
      sub: userInfo.sub,
      email: userInfo.email,
    });

    return {
      sub: userInfo.sub,
      email: userInfo.email,
    };
  } catch (error) {
    console.error('UserInfo request error', error);
    return null;
  }
}

/**
 * ダミーの口座番号を生成する
 *
 * 学習用途のため、ランダムな10桁の数字を生成。
 * 本番環境では、データベースと連携した一意な口座番号生成ロジックを実装する。
 *
 * 異常ケース:
 * - crypto.randomInt がシステムエントロピー不足などで例外を投げる可能性
 * - 本番環境ではDB一意制約違反などが発生する可能性
 *
 * @returns 10桁の口座番号（文字列）、生成失敗時はnull
 */
function generateAccountNumber(): string | null {
  try {
    // 10桁のランダムな数字を生成
    // crypto.randomInt を使用して暗号論的に安全な乱数を生成
    // 範囲: 1000000000 〜 9999999999（10桁の数字）
    const accountNumber = crypto.randomInt(1000000000, 9999999999).toString();

    console.log('Account number generated', {
      accountNumber: accountNumber.substring(0, 4) + '******', // ログには一部のみ
    });

    return accountNumber;
  } catch (error) {
    // crypto.randomInt は以下のケースで例外を投げる可能性がある:
    // - システムエントロピーが不足している場合（非常にレアだが理論上あり得る）
    // - 引数が不正な場合（固定値なので通常は発生しない）
    console.error('Failed to generate account number', error);
    return null;
  }
}

/**
 * JSONレスポンスを生成するヘルパー関数
 *
 * @param statusCode - HTTPステータスコード
 * @param body - レスポンスボディ
 * @param cookies - 設定するCookie（オプション）
 * @returns API Gatewayレスポンス
 */
function jsonResponse(
  statusCode: number,
  body: AccountResponse | ErrorResponse,
  cookies?: string[]
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    cookies,
    body: JSON.stringify(body),
  };
}

/**
 * 口座作成APIのハンドラー
 *
 * 認証済みユーザーに対して口座番号を生成して返却する。
 * アクセストークンの検証はCognito UserInfoエンドポイントで行う。
 *
 * @param event - API Gateway HTTP API (v2) からのイベント
 * @returns JSONレスポンス（成功時: 口座番号、失敗時: エラー）
 */
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  console.log('Account handler invoked', {
    path: event.rawPath,
    method: event.requestContext.http.method,
  });

  // ============================================================
  // Step 1: CookieからセッションIDを取得
  // ============================================================

  // Cookieヘッダーを解析してセッションIDを取得
  const cookieHeader = event.cookies?.join('; ') || '';
  const sessionId = getSessionIdFromCookie(cookieHeader);

  console.log('Session ID from cookie', {
    hasSessionId: !!sessionId,
  });

  // セッションIDが存在しない場合は401エラー
  if (!sessionId) {
    console.error('Missing session ID in cookie');
    return jsonResponse(401, {
      error: '認証が必要です',
      code: 'missing_session',
    });
  }

  // ============================================================
  // Step 2: DynamoDBからアクセストークンを取得
  // ============================================================

  let accessToken: string;
  let email: string;
  let sub: string;

  try {
    const sessionData = await getAuthenticatedSession(sessionId);

    // セッションが存在しない場合は401エラー
    if (!sessionData) {
      console.error('Authenticated session not found', {
        sessionId: sessionId.substring(0, 8) + '...',
      });
      return jsonResponse(401, {
        error: '認証が必要です。再度ログインしてください。',
        code: 'session_not_found',
      });
    }

    accessToken = sessionData.accessToken;
    email = sessionData.email;
    sub = sessionData.sub;

    console.log('Access token retrieved from DynamoDB', {
      hasAccessToken: !!accessToken,
    });
  } catch (error) {
    console.error('Failed to get session from DynamoDB', error);
    return jsonResponse(500, {
      error: 'セッション情報の取得に失敗しました',
      code: 'session_error',
    });
  }

  // ============================================================
  // Step 3: Cognito UserInfoエンドポイントでトークン検証
  // ============================================================

  const userInfo = await verifyTokenWithUserInfo(accessToken);

  // トークンが無効な場合は401エラー
  if (!userInfo) {
    console.error('Token verification failed');

    // 無効なセッションを削除
    try {
      await deleteSession(sessionId);
    } catch (deleteError) {
      console.warn('Failed to delete invalid session', deleteError);
    }

    return jsonResponse(
      401,
      {
        error: 'アクセストークンが無効です。再度ログインしてください。',
        code: 'invalid_token',
      },
      [createDeleteSessionCookie()]
    );
  }

  // ============================================================
  // Step 4: 口座番号を生成
  // ============================================================

  const accountNumber = generateAccountNumber();

  // 口座番号生成に失敗した場合は500エラー
  if (!accountNumber) {
    console.error('Account number generation failed');
    return jsonResponse(500, {
      error: '口座番号の生成に失敗しました。もう一度お試しください。',
      code: 'account_generation_error',
    });
  }

  // ============================================================
  // Step 5: セッションデータを削除
  // ============================================================

  // 口座作成完了後にセッションを削除（セキュリティのため即座に無効化）
  try {
    await deleteSession(sessionId);
    console.log('Session deleted after account creation');
  } catch (deleteError) {
    // 削除に失敗してもTTLで自動削除されるため、警告ログのみ
    console.warn('Failed to delete session after account creation', deleteError);
  }

  // ============================================================
  // Step 6: 成功レスポンスを返却
  // ============================================================

  console.log('Account creation successful', {
    email,
    sub,
    accountNumber: accountNumber.substring(0, 4) + '******',
  });

  // セッションCookieを削除して口座情報を返却
  return jsonResponse(
    200,
    {
      accountNumber,
      email,
      sub,
    },
    [createDeleteSessionCookie()]
  );
};
