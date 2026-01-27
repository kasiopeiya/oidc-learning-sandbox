/**
 * /api/account ハンドラーのテスト
 */
import {
  DynamoDBClient,
  GetItemCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as client from 'openid-client';
import { APIGatewayProxyEventV2 } from 'aws-lambda';

import { handler } from './account';
import { clearSecretCache } from '../utils/secrets';
import { clearConfigCache } from '../utils/oidc-config';

// AWSクライアントのモック
const dynamoMock = mockClient(DynamoDBClient);
const secretsMock = mockClient(SecretsManagerClient);

// openid-clientのdiscovery関数をモック
vi.mock('openid-client', async () => {
  const actual = await vi.importActual<typeof client>('openid-client');
  return {
    ...actual,
    discovery: vi.fn(),
  };
});

// グローバルfetchのモック
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// テスト用のAPIGatewayイベントを生成するヘルパー
function createMockEvent(
  overrides: Partial<APIGatewayProxyEventV2> = {}
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /api/account',
    rawPath: '/api/account',
    rawQueryString: '',
    headers: {
      'content-type': 'application/json',
    },
    cookies: ['oidc_session=session-id-123'],
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      domainName: 'test.execute-api.ap-northeast-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method: 'POST',
        path: '/api/account',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
      requestId: 'request-id',
      routeKey: 'POST /api/account',
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200000,
    },
    isBase64Encoded: false,
    ...overrides,
  };
}

describe('account handler', () => {
  beforeEach(() => {
    // モックをリセット
    dynamoMock.reset();
    secretsMock.reset();
    mockFetch.mockReset();
    vi.clearAllMocks();
    // キャッシュをクリア
    clearSecretCache();
    clearConfigCache();
    // 環境変数をリセット
    vi.unstubAllEnvs();
    // 環境変数設定
    vi.stubEnv('SESSION_TABLE_NAME', 'test-session-table');
    vi.stubEnv('OIDC_ISSUER', 'https://cognito-idp.ap-northeast-1.amazonaws.com/pool-id');
    vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id');
    vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // 共通のモック設定
  function setupMocks() {
    // DynamoDBモック: 認証済みセッション取得
    dynamoMock.on(GetItemCommand).resolves({
      Item: {
        sessionId: { S: 'session-id-123' },
        accessToken: { S: 'test-access-token' },
        email: { S: 'test@example.com' },
        sub: { S: 'user-sub-123' },
        authenticated: { BOOL: true },
      },
    });
    dynamoMock.on(DeleteItemCommand).resolves({});

    // Secrets Managerモック
    secretsMock
      .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
      .resolves({ SecretString: 'test-client-id' })
      .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
      .resolves({ SecretString: 'test-client-secret' });

    // openid-clientモック
    const mockConfig = {
      serverMetadata: () => ({
        userinfo_endpoint: 'https://auth.example.com/oauth2/userInfo',
      }),
    } as unknown as client.Configuration;
    vi.mocked(client.discovery).mockResolvedValue(mockConfig);

    // fetchモック: UserInfoエンドポイント成功
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          sub: 'user-sub-123',
          email: 'test@example.com',
        }),
    });
  }

  describe('正常系', () => {
    it('口座番号を含む成功レスポンスを返す', async () => {
      // モック設定
      setupMocks();

      // 実行
      const result = await handler(createMockEvent());

      // 検証
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body || '');
      expect(body.accountNumber).toBeDefined();
      expect(body.accountNumber).toMatch(/^\d{10}$/); // 10桁の数字
      expect(body.email).toBe('test@example.com');
      expect(body.sub).toBe('user-sub-123');
    });

    it('セッションが削除される', async () => {
      // モック設定
      setupMocks();

      // 実行
      await handler(createMockEvent());

      // 検証: セッションが削除された
      const deleteCalls = dynamoMock.commandCalls(DeleteItemCommand);
      expect(deleteCalls).toHaveLength(1);
      expect(deleteCalls[0].args[0].input.Key?.sessionId?.S).toBe('session-id-123');
    });

    it('セッションCookie削除用のヘッダーが設定される', async () => {
      // モック設定
      setupMocks();

      // 実行
      const result = await handler(createMockEvent());

      // 検証
      expect(result.cookies).toBeDefined();
      expect(result.cookies?.[0]).toContain('oidc_session=');
      expect(result.cookies?.[0]).toContain('Max-Age=0');
    });

    it('UserInfoエンドポイントが正しく呼ばれる', async () => {
      // モック設定
      setupMocks();

      // 実行
      await handler(createMockEvent());

      // 検証
      expect(mockFetch).toHaveBeenCalledWith(
        'https://auth.example.com/oauth2/userInfo',
        expect.objectContaining({
          method: 'GET',
          headers: {
            Authorization: 'Bearer test-access-token',
          },
        })
      );
    });
  });

  describe('異常系', () => {
    it('セッションCookieがない場合は401エラーを返す', async () => {
      // 実行
      const event = createMockEvent({
        cookies: [],
      });
      const result = await handler(event);

      // 検証
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body || '');
      expect(body.code).toBe('missing_session');
    });

    it('セッションがDynamoDBにない場合は401エラーを返す', async () => {
      // モック設定
      dynamoMock.on(GetItemCommand).resolves({ Item: undefined });

      // 実行
      const result = await handler(createMockEvent());

      // 検証
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body || '');
      expect(body.code).toBe('session_not_found');
    });

    it('認証済みフラグがないセッションの場合は401エラーを返す', async () => {
      // モック設定: authenticatedがfalse
      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          sessionId: { S: 'session-id-123' },
          accessToken: { S: 'test-access-token' },
          email: { S: 'test@example.com' },
          sub: { S: 'user-sub-123' },
          authenticated: { BOOL: false },
        },
      });

      // 実行
      const result = await handler(createMockEvent());

      // 検証
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body || '');
      expect(body.code).toBe('session_not_found');
    });

    it('DynamoDB GetItem失敗時は500エラーを返す', async () => {
      // モック設定
      dynamoMock.on(GetItemCommand).rejects(new Error('DynamoDB Error'));

      // 実行
      const result = await handler(createMockEvent());

      // 検証
      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body || '');
      expect(body.code).toBe('session_error');
    });

    it('UserInfoエンドポイントが失敗した場合は401エラーを返す', async () => {
      // モック設定
      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          sessionId: { S: 'session-id-123' },
          accessToken: { S: 'test-access-token' },
          email: { S: 'test@example.com' },
          sub: { S: 'user-sub-123' },
          authenticated: { BOOL: true },
        },
      });
      dynamoMock.on(DeleteItemCommand).resolves({});
      secretsMock
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
        .resolves({ SecretString: 'test-client-id' })
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
        .resolves({ SecretString: 'test-client-secret' });

      const mockConfig = {
        serverMetadata: () => ({
          userinfo_endpoint: 'https://auth.example.com/oauth2/userInfo',
        }),
      } as unknown as client.Configuration;
      vi.mocked(client.discovery).mockResolvedValue(mockConfig);

      // fetchモック: 401エラー
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      // 実行
      const result = await handler(createMockEvent());

      // 検証
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body || '');
      expect(body.code).toBe('invalid_token');
    });

    it('UserInfoエンドポイントがネットワークエラーの場合は401エラーを返す', async () => {
      // モック設定
      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          sessionId: { S: 'session-id-123' },
          accessToken: { S: 'test-access-token' },
          email: { S: 'test@example.com' },
          sub: { S: 'user-sub-123' },
          authenticated: { BOOL: true },
        },
      });
      dynamoMock.on(DeleteItemCommand).resolves({});
      secretsMock
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
        .resolves({ SecretString: 'test-client-id' })
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
        .resolves({ SecretString: 'test-client-secret' });

      const mockConfig = {
        serverMetadata: () => ({
          userinfo_endpoint: 'https://auth.example.com/oauth2/userInfo',
        }),
      } as unknown as client.Configuration;
      vi.mocked(client.discovery).mockResolvedValue(mockConfig);

      // fetchモック: ネットワークエラー
      mockFetch.mockRejectedValue(new Error('Network error'));

      // 実行
      const result = await handler(createMockEvent());

      // 検証
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body || '');
      expect(body.code).toBe('invalid_token');
    });

    it('OIDC Discovery失敗時は401エラーを返す', async () => {
      // モック設定
      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          sessionId: { S: 'session-id-123' },
          accessToken: { S: 'test-access-token' },
          email: { S: 'test@example.com' },
          sub: { S: 'user-sub-123' },
          authenticated: { BOOL: true },
        },
      });
      dynamoMock.on(DeleteItemCommand).resolves({});
      secretsMock
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
        .resolves({ SecretString: 'test-client-id' })
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
        .resolves({ SecretString: 'test-client-secret' });

      // OIDC Discovery失敗
      vi.mocked(client.discovery).mockRejectedValue(new Error('Discovery failed'));

      // 実行
      const result = await handler(createMockEvent());

      // 検証
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body || '');
      expect(body.code).toBe('invalid_token');
    });

    it('トークン検証失敗時にセッションが削除される', async () => {
      // モック設定
      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          sessionId: { S: 'session-id-123' },
          accessToken: { S: 'test-access-token' },
          email: { S: 'test@example.com' },
          sub: { S: 'user-sub-123' },
          authenticated: { BOOL: true },
        },
      });
      dynamoMock.on(DeleteItemCommand).resolves({});
      secretsMock
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
        .resolves({ SecretString: 'test-client-id' })
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
        .resolves({ SecretString: 'test-client-secret' });

      const mockConfig = {
        serverMetadata: () => ({
          userinfo_endpoint: 'https://auth.example.com/oauth2/userInfo',
        }),
      } as unknown as client.Configuration;
      vi.mocked(client.discovery).mockResolvedValue(mockConfig);

      // fetchモック: 401エラー
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      // 実行
      await handler(createMockEvent());

      // 検証: セッションが削除された
      const deleteCalls = dynamoMock.commandCalls(DeleteItemCommand);
      expect(deleteCalls).toHaveLength(1);
    });

    it('トークン検証失敗時にセッションCookie削除用のヘッダーが設定される', async () => {
      // モック設定
      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          sessionId: { S: 'session-id-123' },
          accessToken: { S: 'test-access-token' },
          email: { S: 'test@example.com' },
          sub: { S: 'user-sub-123' },
          authenticated: { BOOL: true },
        },
      });
      dynamoMock.on(DeleteItemCommand).resolves({});
      secretsMock
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
        .resolves({ SecretString: 'test-client-id' })
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
        .resolves({ SecretString: 'test-client-secret' });

      const mockConfig = {
        serverMetadata: () => ({
          userinfo_endpoint: 'https://auth.example.com/oauth2/userInfo',
        }),
      } as unknown as client.Configuration;
      vi.mocked(client.discovery).mockResolvedValue(mockConfig);

      // fetchモック: 401エラー
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      // 実行
      const result = await handler(createMockEvent());

      // 検証
      expect(result.cookies).toBeDefined();
      expect(result.cookies?.[0]).toContain('Max-Age=0');
    });

    it('SESSION_TABLE_NAME環境変数未設定時は500エラーを返す', async () => {
      // 環境変数を削除
      vi.stubEnv('SESSION_TABLE_NAME', '');

      // モック設定
      dynamoMock.on(GetItemCommand).rejects(
        new Error('SESSION_TABLE_NAME environment variable is not set')
      );

      // 実行
      const result = await handler(createMockEvent());

      // 検証
      expect(result.statusCode).toBe(500);
    });
  });
});
