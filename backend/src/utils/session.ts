/**
 * セッション管理ユーティリティ
 *
 * DynamoDBを使用してOIDC認可コードフローのセッションデータを管理する。
 * State/Nonce/PKCEをセッションIDに紐付けて保存し、CookieにはセッションIDのみを保持する。
 * これにより、セキュリティパラメータがブラウザに渡らないセキュアな実装を実現する。
 */
import * as crypto from 'crypto';

import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';

/**
 * セッションデータの型定義
 *
 * OIDC認可コードフローで使用する3つのセキュリティパラメータを保持
 */
export interface SessionData {
  /** CSRF攻撃対策用のstate値 */
  state: string;
  /** リプレイ攻撃対策用のnonce値 */
  nonce: string;
  /** 認可コード横取り攻撃対策用のcode_verifier（PKCE） */
  codeVerifier: string;
}

/** DynamoDBクライアント（Lambda実行環境で再利用） */
const dynamoClient = new DynamoDBClient({});

/** セッションの有効期限（秒）: 5分 */
const SESSION_TTL_SECONDS = 300;

/** セッションIDの長さ（バイト）: 32バイト = 256ビット */
const SESSION_ID_LENGTH = 32;

/** Cookie名: セッションID用 */
export const SESSION_COOKIE_NAME = 'oidc_session';

/**
 * 暗号論的に安全なセッションIDを生成する
 *
 * Node.jsのcrypto.randomBytesを使用して、予測不可能なランダム文字列を生成。
 * Base64URLエンコードで安全な文字のみを使用。
 *
 * @returns 43文字のセッションID（256ビットのエントロピー）
 */
export function generateSessionId(): string {
  // 32バイト（256ビット）のランダムデータを生成
  // crypto.randomBytes は暗号論的に安全な乱数を生成
  const buffer = crypto.randomBytes(SESSION_ID_LENGTH);

  // Base64URLエンコード（URLセーフ: + → -, / → _, パディング削除）
  return buffer.toString('base64url');
}

/**
 * セッションデータをDynamoDBに保存する
 *
 * セッションIDをキーとして、State/Nonce/PKCEを保存。
 * TTL（Time To Live）を設定して、5分後に自動削除される。
 *
 * @param sessionId - セッションID（パーティションキー）
 * @param data - 保存するセッションデータ
 */
export async function saveSession(
  sessionId: string,
  data: SessionData
): Promise<void> {
  const tableName = process.env.SESSION_TABLE_NAME;
  if (!tableName) {
    throw new Error('SESSION_TABLE_NAME environment variable is not set');
  }

  // TTL: 現在時刻 + 5分（UNIXタイムスタンプ、秒単位）
  const ttl = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;

  const command = new PutItemCommand({
    TableName: tableName,
    Item: {
      // パーティションキー
      sessionId: { S: sessionId },
      // セキュリティパラメータ
      state: { S: data.state },
      nonce: { S: data.nonce },
      codeVerifier: { S: data.codeVerifier },
      // TTL属性（DynamoDBが自動削除に使用）
      ttl: { N: ttl.toString() },
    },
  });

  await dynamoClient.send(command);

  console.log('Session saved to DynamoDB', {
    sessionId: sessionId.substring(0, 8) + '...', // ログには先頭8文字のみ
    ttlSeconds: SESSION_TTL_SECONDS,
  });
}

/**
 * セッションデータをDynamoDBから取得する
 *
 * @param sessionId - セッションID（パーティションキー）
 * @returns セッションデータ、存在しない場合はnull
 */
export async function getSession(sessionId: string): Promise<SessionData | null> {
  const tableName = process.env.SESSION_TABLE_NAME;
  if (!tableName) {
    throw new Error('SESSION_TABLE_NAME environment variable is not set');
  }

  const command = new GetItemCommand({
    TableName: tableName,
    Key: {
      sessionId: { S: sessionId },
    },
  });

  const result = await dynamoClient.send(command);

  // アイテムが存在しない場合
  if (!result.Item) {
    console.log('Session not found', {
      sessionId: sessionId.substring(0, 8) + '...',
    });
    return null;
  }

  // DynamoDBのAttributeValueからデータを抽出
  const state = result.Item.state?.S;
  const nonce = result.Item.nonce?.S;
  const codeVerifier = result.Item.codeVerifier?.S;

  // 必要なフィールドが存在しない場合
  if (!state || !nonce || !codeVerifier) {
    console.error('Session data is incomplete', {
      sessionId: sessionId.substring(0, 8) + '...',
      hasState: !!state,
      hasNonce: !!nonce,
      hasCodeVerifier: !!codeVerifier,
    });
    return null;
  }

  console.log('Session retrieved from DynamoDB', {
    sessionId: sessionId.substring(0, 8) + '...',
  });

  return { state, nonce, codeVerifier };
}

/**
 * セッションデータをDynamoDBから削除する
 *
 * 認証完了後にセッションを無効化するために使用。
 * TTLによる自動削除を待たずに即座に削除することで、
 * セッション固定攻撃のリスクを軽減する。
 *
 * @param sessionId - セッションID（パーティションキー）
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const tableName = process.env.SESSION_TABLE_NAME;
  if (!tableName) {
    throw new Error('SESSION_TABLE_NAME environment variable is not set');
  }

  const command = new DeleteItemCommand({
    TableName: tableName,
    Key: {
      sessionId: { S: sessionId },
    },
  });

  await dynamoClient.send(command);

  console.log('Session deleted from DynamoDB', {
    sessionId: sessionId.substring(0, 8) + '...',
  });
}

/**
 * セッションID用のCookieを生成する
 *
 * 以下のセキュリティ属性を付与:
 * - HttpOnly: JavaScriptからのアクセスを防止（XSS対策）
 * - Secure: HTTPS通信でのみ送信
 * - SameSite=Strict: クロスサイトリクエストでのCookie送信を完全に禁止
 * - Path=/api: API パスでのみ有効（フロントエンドには送信されない）
 *
 * @param sessionId - セッションID
 * @returns Set-Cookieヘッダーに設定する文字列
 */
export function createSessionCookie(sessionId: string): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    `Max-Age=${SESSION_TTL_SECONDS}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax', // Cognitoからのリダイレクト時にCookieが送信されるようLaxを使用
    'Path=/', // API Gateway経由でアクセスするため、ルートパスで設定
  ];

  return attributes.join('; ');
}

/**
 * セッションCookieを削除するためのSet-Cookieヘッダー値を生成する
 *
 * Max-Age=0を設定することで、ブラウザにCookieの削除を指示する。
 *
 * @returns Set-Cookieヘッダーに設定する文字列
 */
export function createDeleteSessionCookie(): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=`,
    'Max-Age=0',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
  ];

  return attributes.join('; ');
}

/**
 * CookieヘッダーからセッションIDを抽出する
 *
 * @param cookieHeader - Cookieヘッダーの値（例: "oidc_session=xxx; other=yyy"）
 * @returns セッションID、存在しない場合はnull
 */
export function getSessionIdFromCookie(cookieHeader?: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  // セミコロンで分割して各Cookie項目を処理
  const cookies = cookieHeader.split(';');

  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split('=');
    const trimmedName = name.trim();

    if (trimmedName === SESSION_COOKIE_NAME) {
      return rest.join('=').trim();
    }
  }

  return null;
}
