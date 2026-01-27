/**
 * /api/auth/callback ハンドラーのテスト
 */
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as client from 'openid-client';
import { APIGatewayProxyEventV2 } from 'aws-lambda';

import { handler } from './callback';
import { clearParameterCache } from '../utils/ssm';
import { clearSecretCache } from '../utils/secrets';
import { clearConfigCache } from '../utils/oidc-config';

// AWSクライアントのモック
const dynamoMock = mockClient(DynamoDBClient);
const ssmMock = mockClient(SSMClient);
const secretsMock = mockClient(SecretsManagerClient);

// openid-clientのモック
vi.mock('openid-client', async () => {
  const actual = await vi.importActual<typeof client>('openid-client');
  return {
    ...actual,
    discovery: vi.fn(),
    authorizationCodeGrant: vi.fn(),
    AuthorizationResponseError: actual.AuthorizationResponseError,
    ResponseBodyError: actual.ResponseBodyError,
    ClientError: actual.ClientError,
  };
});

// テスト用のAPIGatewayイベントを生成するヘルパー
function createMockEvent(
  overrides: Partial<APIGatewayProxyEventV2> = {}
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'GET /api/auth/callback',
    rawPath: '/api/auth/callback',
    rawQueryString: 'code=auth-code&state=test-state',
    headers: {},
    queryStringParameters: {
      code: 'auth-code',
      state: 'test-state',
    },
    cookies: ['oidc_session=session-id-123'],
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      domainName: 'test.execute-api.ap-northeast-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method: 'GET',
        path: '/api/auth/callback',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
      },
      requestId: 'request-id',
      routeKey: 'GET /api/auth/callback',
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200000,
    },
    isBase64Encoded: false,
    ...overrides,
  };
}

describe('callback handler', () => {
  beforeEach(() => {
    // モックをリセット
    dynamoMock.reset();
    ssmMock.reset();
    secretsMock.reset();
    vi.clearAllMocks();
    // キャッシュをクリア
    clearParameterCache();
    clearSecretCache();
    clearConfigCache();
    // 環境変数をリセット
    vi.unstubAllEnvs();
    // 環境変数設定
    vi.stubEnv('SESSION_TABLE_NAME', 'test-session-table');
    vi.stubEnv('OIDC_ISSUER', 'https://cognito-idp.ap-northeast-1.amazonaws.com/pool-id');
    vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id');
    vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret');
    vi.stubEnv('SSM_CLOUDFRONT_URL_PARAM', '/oidc-sandbox/cloudfront-url');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // 共通のモック設定
  function setupMocks() {
    // DynamoDBモック: セッション取得
    dynamoMock.on(GetItemCommand).resolves({
      Item: {
        sessionId: { S: 'session-id-123' },
        state: { S: 'test-state' },
        nonce: { S: 'test-nonce' },
        codeVerifier: { S: 'test-code-verifier' },
      },
    });
    dynamoMock.on(PutItemCommand).resolves({});
    dynamoMock.on(DeleteItemCommand).resolves({});

    // SSMモック
    ssmMock.on(GetParameterCommand).resolves({
      Parameter: { Value: 'https://example.cloudfront.net' },
    });

    // Secrets Managerモック
    secretsMock
      .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
      .resolves({ SecretString: 'test-client-id' })
      .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
      .resolves({ SecretString: 'test-client-secret' });

    // openid-clientモック
    const mockConfig = {
      serverMetadata: () => ({
        authorization_endpoint: 'https://auth.example.com/oauth2/authorize',
        token_endpoint: 'https://auth.example.com/oauth2/token',
      }),
    } as unknown as client.Configuration;
    vi.mocked(client.discovery).mockResolvedValue(mockConfig);
  }

  describe('正常系', () => {
    it('トークン交換成功時は/callbackへリダイレクトする', async () => {
      // モック設定
      setupMocks();

      // トークン交換成功
      const mockTokenResponse = {
        access_token: 'test-access-token',
        claims: () => ({
          sub: 'user-sub-123',
          email: 'test@example.com',
          email_verified: true,
        }),
      };
      vi.mocked(client.authorizationCodeGrant).mockResolvedValue(
        mockTokenResponse as unknown as client.TokenEndpointResponse
      );

      // 実行
      const result = await handler(createMockEvent());

      // 検証
      expect(result.statusCode).toBe(302);
      expect(result.headers?.Location).toBe('/callback');
    });

    it('認証済みセッションがDynamoDBに保存される', async () => {
      // モック設定
      setupMocks();

      const mockTokenResponse = {
        access_token: 'test-access-token',
        claims: () => ({
          sub: 'user-sub-123',
          email: 'test@example.com',
        }),
      };
      vi.mocked(client.authorizationCodeGrant).mockResolvedValue(
        mockTokenResponse as unknown as client.TokenEndpointResponse
      );

      // 実行
      await handler(createMockEvent());

      // 検証: 認証済みセッションが保存された
      const putCalls = dynamoMock.commandCalls(PutItemCommand);
      expect(putCalls.length).toBeGreaterThan(0);
      const lastPutCall = putCalls[putCalls.length - 1];
      expect(lastPutCall.args[0].input.Item?.accessToken?.S).toBe('test-access-token');
      expect(lastPutCall.args[0].input.Item?.email?.S).toBe('test@example.com');
      expect(lastPutCall.args[0].input.Item?.sub?.S).toBe('user-sub-123');
      expect(lastPutCall.args[0].input.Item?.authenticated?.BOOL).toBe(true);
    });

    it('セッションCookieが再設定される', async () => {
      // モック設定
      setupMocks();

      const mockTokenResponse = {
        access_token: 'test-access-token',
        claims: () => ({
          sub: 'user-sub-123',
          email: 'test@example.com',
        }),
      };
      vi.mocked(client.authorizationCodeGrant).mockResolvedValue(
        mockTokenResponse as unknown as client.TokenEndpointResponse
      );

      // 実行
      const result = await handler(createMockEvent());

      // 検証
      expect(result.cookies).toBeDefined();
      expect(result.cookies?.[0]).toContain('oidc_session=');
    });
  });

  describe('異常系', () => {
    it('エラーパラメータがある場合は/errorへリダイレクトする', async () => {
      // 実行
      const event = createMockEvent({
        queryStringParameters: {
          error: 'access_denied',
          error_description: 'User cancelled',
        },
      });
      const result = await handler(event);

      // 検証
      expect(result.statusCode).toBe(302);
      expect(result.headers?.Location).toBe('/error?error=access_denied');
    });

    it('OPからのエラー（access_denied以外）は/error?error=op_errorへリダイレクトする', async () => {
      // 実行
      const event = createMockEvent({
        queryStringParameters: {
          error: 'server_error',
          error_description: 'Internal error',
        },
      });
      const result = await handler(event);

      // 検証
      expect(result.statusCode).toBe(302);
      expect(result.headers?.Location).toBe('/error?error=op_error');
    });

    it('認可コードがない場合は/error?error=missing_codeへリダイレクトする', async () => {
      // 実行
      const event = createMockEvent({
        queryStringParameters: {
          state: 'test-state',
        },
      });
      const result = await handler(event);

      // 検証
      expect(result.statusCode).toBe(302);
      expect(result.headers?.Location).toBe('/error?error=missing_code');
    });

    it('セッションCookieがない場合は/error?error=missing_sessionへリダイレクトする', async () => {
      // 実行
      const event = createMockEvent({
        cookies: [],
      });
      const result = await handler(event);

      // 検証
      expect(result.statusCode).toBe(302);
      expect(result.headers?.Location).toBe('/error?error=missing_session');
    });

    it('セッションがDynamoDBにない場合は/error?error=missing_sessionへリダイレクトする', async () => {
      // モック設定
      dynamoMock.on(GetItemCommand).resolves({ Item: undefined });

      // 実行
      const result = await handler(createMockEvent());

      // 検証
      expect(result.statusCode).toBe(302);
      expect(result.headers?.Location).toBe('/error?error=missing_session');
    });

    it('DynamoDB GetItem失敗時は/error?error=missing_sessionへリダイレクトする', async () => {
      // モック設定
      dynamoMock.on(GetItemCommand).rejects(new Error('DynamoDB Error'));

      // 実行
      const result = await handler(createMockEvent());

      // 検証
      expect(result.statusCode).toBe(302);
      expect(result.headers?.Location).toBe('/error?error=missing_session');
    });

    it('OIDC Discovery失敗時は/error?error=network_errorへリダイレクトする', async () => {
      // モック設定
      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          sessionId: { S: 'session-id-123' },
          state: { S: 'test-state' },
          nonce: { S: 'test-nonce' },
          codeVerifier: { S: 'test-code-verifier' },
        },
      });
      dynamoMock.on(DeleteItemCommand).resolves({});
      secretsMock
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
        .resolves({ SecretString: 'test-client-id' })
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
        .resolves({ SecretString: 'test-client-secret' });

      // OIDC Discovery失敗
      vi.mocked(client.discovery).mockRejectedValue(new Error('Discovery Error'));

      // 実行
      const result = await handler(createMockEvent());

      // 検証
      expect(result.statusCode).toBe(302);
      expect(result.headers?.Location).toBe('/error?error=network_error');
    });

    it('トークン交換失敗時は/error?error=authentication_failedへリダイレクトする', async () => {
      // モック設定
      setupMocks();

      // トークン交換失敗
      vi.mocked(client.authorizationCodeGrant).mockRejectedValue(
        new Error('Token exchange failed')
      );

      // 実行
      const result = await handler(createMockEvent());

      // 検証
      expect(result.statusCode).toBe(302);
      expect(result.headers?.Location).toBe('/error?error=authentication_failed');
    });

    it('IDトークンのclaimsがない場合は/error?error=authentication_failedへリダイレクトする', async () => {
      // モック設定
      setupMocks();

      const mockTokenResponse = {
        access_token: 'test-access-token',
        claims: () => null,
      };
      vi.mocked(client.authorizationCodeGrant).mockResolvedValue(
        mockTokenResponse as unknown as client.TokenEndpointResponse
      );

      // 実行
      const result = await handler(createMockEvent());

      // 検証
      expect(result.statusCode).toBe(302);
      expect(result.headers?.Location).toBe('/error?error=authentication_failed');
    });

    it('アクセストークンがない場合は/error?error=authentication_failedへリダイレクトする', async () => {
      // モック設定
      setupMocks();

      const mockTokenResponse = {
        access_token: undefined,
        claims: () => ({
          sub: 'user-sub-123',
          email: 'test@example.com',
        }),
      };
      vi.mocked(client.authorizationCodeGrant).mockResolvedValue(
        mockTokenResponse as unknown as client.TokenEndpointResponse
      );

      // 実行
      const result = await handler(createMockEvent());

      // 検証
      expect(result.statusCode).toBe(302);
      expect(result.headers?.Location).toBe('/error?error=authentication_failed');
    });

    it('認証済みセッション保存失敗時は/error?error=authentication_failedへリダイレクトする', async () => {
      // モック設定
      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          sessionId: { S: 'session-id-123' },
          state: { S: 'test-state' },
          nonce: { S: 'test-nonce' },
          codeVerifier: { S: 'test-code-verifier' },
        },
      });
      // PutItemでエラー
      dynamoMock.on(PutItemCommand).rejects(new Error('DynamoDB PutItem Error'));
      dynamoMock.on(DeleteItemCommand).resolves({});
      ssmMock.on(GetParameterCommand).resolves({
        Parameter: { Value: 'https://example.cloudfront.net' },
      });
      secretsMock
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
        .resolves({ SecretString: 'test-client-id' })
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
        .resolves({ SecretString: 'test-client-secret' });

      const mockConfig = {
        serverMetadata: () => ({}),
      } as unknown as client.Configuration;
      vi.mocked(client.discovery).mockResolvedValue(mockConfig);

      const mockTokenResponse = {
        access_token: 'test-access-token',
        claims: () => ({
          sub: 'user-sub-123',
          email: 'test@example.com',
        }),
      };
      vi.mocked(client.authorizationCodeGrant).mockResolvedValue(
        mockTokenResponse as unknown as client.TokenEndpointResponse
      );

      // 実行
      const result = await handler(createMockEvent());

      // 検証
      expect(result.statusCode).toBe(302);
      expect(result.headers?.Location).toBe('/error?error=authentication_failed');
    });

    it('ネットワークエラー（TypeError）時は/error?error=network_errorへリダイレクトする', async () => {
      // モック設定
      setupMocks();

      // TypeErrorをスロー（ネットワークエラー）
      vi.mocked(client.authorizationCodeGrant).mockRejectedValue(
        new TypeError('fetch failed')
      );

      // 実行
      const result = await handler(createMockEvent());

      // 検証
      expect(result.statusCode).toBe(302);
      expect(result.headers?.Location).toBe('/error?error=network_error');
    });

    it('トークン交換失敗時にセッションが削除される', async () => {
      // モック設定
      setupMocks();

      vi.mocked(client.authorizationCodeGrant).mockRejectedValue(
        new Error('Token exchange failed')
      );

      // 実行
      await handler(createMockEvent());

      // 検証: セッションが削除された
      const deleteCalls = dynamoMock.commandCalls(DeleteItemCommand);
      expect(deleteCalls.length).toBeGreaterThan(0);
    });
  });
});
