/**
 * /api/auth/login ハンドラーのテスト
 */
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { mockClient } from 'aws-sdk-client-mock'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as client from 'openid-client'
import { APIGatewayProxyEventV2 } from 'aws-lambda'

import { handler } from './login'
import { clearParameterCache } from '../utils/ssm'
import { clearSecretCache } from '../utils/secrets'
import { clearConfigCache } from '../utils/oidc-config'

// AWSクライアントのモック
const dynamoMock = mockClient(DynamoDBClient)
const ssmMock = mockClient(SSMClient)
const secretsMock = mockClient(SecretsManagerClient)

// openid-clientのdiscovery関数をモック
vi.mock('openid-client', async () => {
  const actual = await vi.importActual<typeof client>('openid-client')
  return {
    ...actual,
    discovery: vi.fn()
  }
})

// テスト用のAPIGatewayイベントを生成するヘルパー
function createMockEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'GET /api/auth/login',
    rawPath: '/api/auth/login',
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      domainName: 'test.execute-api.ap-northeast-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method: 'GET',
        path: '/api/auth/login',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent'
      },
      requestId: 'request-id',
      routeKey: 'GET /api/auth/login',
      stage: '$default',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 1704067200000
    },
    isBase64Encoded: false,
    ...overrides
  }
}

describe('login handler', () => {
  beforeEach(() => {
    // モックをリセット
    dynamoMock.reset()
    ssmMock.reset()
    secretsMock.reset()
    vi.clearAllMocks()
    // キャッシュをクリア
    clearParameterCache()
    clearSecretCache()
    clearConfigCache()
    // 環境変数をリセット
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('正常系', () => {
    it('認可エンドポイントへの302リダイレクトを返す', async () => {
      // 環境変数設定
      vi.stubEnv('SESSION_TABLE_NAME', 'test-session-table')
      vi.stubEnv('OIDC_ISSUER', 'https://cognito-idp.ap-northeast-1.amazonaws.com/pool-id')
      vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')
      vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')
      vi.stubEnv('SSM_CLOUDFRONT_URL_PARAM', '/oidc-sandbox/cloudfront-url')

      // DynamoDBモック
      dynamoMock.on(PutItemCommand).resolves({})

      // SSMモック
      ssmMock.on(GetParameterCommand).resolves({
        Parameter: {
          Name: '/oidc-sandbox/cloudfront-url',
          Value: 'https://example.cloudfront.net'
        }
      })

      // Secrets Managerモック
      secretsMock
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
        .resolves({ SecretString: 'test-client-id' })
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
        .resolves({ SecretString: 'test-client-secret' })

      // openid-clientモック
      const mockConfig = {
        serverMetadata: () => ({
          authorization_endpoint: 'https://auth.example.com/oauth2/authorize'
        })
      } as unknown as client.Configuration
      vi.mocked(client.discovery).mockResolvedValue(mockConfig)

      // 実行
      const event = createMockEvent()
      const result = await handler(event)

      // 検証
      expect(result.statusCode).toBe(302)
      expect(result.headers?.Location).toContain('https://auth.example.com/oauth2/authorize')
    })

    it('認可URLに必要なパラメータが含まれている', async () => {
      // 環境変数設定
      vi.stubEnv('SESSION_TABLE_NAME', 'test-session-table')
      vi.stubEnv('OIDC_ISSUER', 'https://cognito-idp.ap-northeast-1.amazonaws.com/pool-id')
      vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')
      vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')
      vi.stubEnv('SSM_CLOUDFRONT_URL_PARAM', '/oidc-sandbox/cloudfront-url')

      // モック設定
      dynamoMock.on(PutItemCommand).resolves({})
      ssmMock.on(GetParameterCommand).resolves({
        Parameter: { Value: 'https://example.cloudfront.net' }
      })
      secretsMock
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
        .resolves({ SecretString: 'test-client-id' })
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
        .resolves({ SecretString: 'test-client-secret' })

      const mockConfig = {
        serverMetadata: () => ({
          authorization_endpoint: 'https://auth.example.com/oauth2/authorize'
        })
      } as unknown as client.Configuration
      vi.mocked(client.discovery).mockResolvedValue(mockConfig)

      // 実行
      const result = await handler(createMockEvent())

      // 検証
      const locationUrl = new URL(result.headers?.Location as string)
      expect(locationUrl.searchParams.get('response_type')).toBe('code')
      expect(locationUrl.searchParams.get('client_id')).toBe('test-client-id')
      expect(locationUrl.searchParams.get('redirect_uri')).toBe(
        'https://example.cloudfront.net/api/auth/callback'
      )
      expect(locationUrl.searchParams.get('scope')).toBe('openid email profile')
      expect(locationUrl.searchParams.get('state')).toBeTruthy()
      expect(locationUrl.searchParams.get('nonce')).toBeTruthy()
      expect(locationUrl.searchParams.get('code_challenge')).toBeTruthy()
      expect(locationUrl.searchParams.get('code_challenge_method')).toBe('S256')
    })

    it('セッションCookieが設定される', async () => {
      // 環境変数設定
      vi.stubEnv('SESSION_TABLE_NAME', 'test-session-table')
      vi.stubEnv('OIDC_ISSUER', 'https://cognito-idp.ap-northeast-1.amazonaws.com/pool-id')
      vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')
      vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')
      vi.stubEnv('SSM_CLOUDFRONT_URL_PARAM', '/oidc-sandbox/cloudfront-url')

      // モック設定
      dynamoMock.on(PutItemCommand).resolves({})
      ssmMock.on(GetParameterCommand).resolves({
        Parameter: { Value: 'https://example.cloudfront.net' }
      })
      secretsMock
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
        .resolves({ SecretString: 'test-client-id' })
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
        .resolves({ SecretString: 'test-client-secret' })

      const mockConfig = {
        serverMetadata: () => ({
          authorization_endpoint: 'https://auth.example.com/oauth2/authorize'
        })
      } as unknown as client.Configuration
      vi.mocked(client.discovery).mockResolvedValue(mockConfig)

      // 実行
      const result = await handler(createMockEvent())

      // 検証: セッションCookieが設定されている
      expect(result.cookies).toBeDefined()
      expect(result.cookies?.length).toBeGreaterThan(0)
      expect(result.cookies?.[0]).toContain('oidc_session=')
      expect(result.cookies?.[0]).toContain('HttpOnly')
      expect(result.cookies?.[0]).toContain('Secure')
    })

    it('セッションデータがDynamoDBに保存される', async () => {
      // 環境変数設定
      vi.stubEnv('SESSION_TABLE_NAME', 'test-session-table')
      vi.stubEnv('OIDC_ISSUER', 'https://cognito-idp.ap-northeast-1.amazonaws.com/pool-id')
      vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')
      vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')
      vi.stubEnv('SSM_CLOUDFRONT_URL_PARAM', '/oidc-sandbox/cloudfront-url')

      // モック設定
      dynamoMock.on(PutItemCommand).resolves({})
      ssmMock.on(GetParameterCommand).resolves({
        Parameter: { Value: 'https://example.cloudfront.net' }
      })
      secretsMock
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
        .resolves({ SecretString: 'test-client-id' })
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
        .resolves({ SecretString: 'test-client-secret' })

      const mockConfig = {
        serverMetadata: () => ({
          authorization_endpoint: 'https://auth.example.com/oauth2/authorize'
        })
      } as unknown as client.Configuration
      vi.mocked(client.discovery).mockResolvedValue(mockConfig)

      // 実行
      await handler(createMockEvent())

      // 検証: DynamoDBにセッションが保存された
      const putCalls = dynamoMock.commandCalls(PutItemCommand)
      expect(putCalls).toHaveLength(1)
      expect(putCalls[0].args[0].input.TableName).toBe('test-session-table')
      expect(putCalls[0].args[0].input.Item?.state?.S).toBeTruthy()
      expect(putCalls[0].args[0].input.Item?.nonce?.S).toBeTruthy()
      expect(putCalls[0].args[0].input.Item?.codeVerifier?.S).toBeTruthy()
    })
  })

  describe('異常系', () => {
    it('DynamoDBへのセッション保存失敗時は500エラーを返す', async () => {
      // 環境変数設定
      vi.stubEnv('SESSION_TABLE_NAME', 'test-session-table')
      vi.stubEnv('OIDC_ISSUER', 'https://cognito-idp.ap-northeast-1.amazonaws.com/pool-id')
      vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')
      vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')
      vi.stubEnv('SSM_CLOUDFRONT_URL_PARAM', '/oidc-sandbox/cloudfront-url')

      // DynamoDBモック: エラー
      dynamoMock.on(PutItemCommand).rejects(new Error('DynamoDB Error'))

      // 実行
      const result = await handler(createMockEvent())

      // 検証
      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body || '')).toEqual({
        error: 'Failed to initialize session'
      })
    })

    it('OIDC Discovery失敗時は500エラーを返す', async () => {
      // 環境変数設定
      vi.stubEnv('SESSION_TABLE_NAME', 'test-session-table')
      vi.stubEnv('OIDC_ISSUER', 'https://cognito-idp.ap-northeast-1.amazonaws.com/pool-id')
      vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')
      vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')
      vi.stubEnv('SSM_CLOUDFRONT_URL_PARAM', '/oidc-sandbox/cloudfront-url')

      // モック設定
      dynamoMock.on(PutItemCommand).resolves({})
      ssmMock.on(GetParameterCommand).resolves({
        Parameter: { Value: 'https://example.cloudfront.net' }
      })
      secretsMock
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
        .resolves({ SecretString: 'test-client-id' })
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
        .resolves({ SecretString: 'test-client-secret' })

      // OIDC Discoveryモック: エラー
      vi.mocked(client.discovery).mockRejectedValue(new Error('OIDC Discovery Error'))

      // 実行
      const result = await handler(createMockEvent())

      // 検証
      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body || '')).toEqual({
        error: 'Server configuration error'
      })
    })

    it('SSMパラメータ取得失敗時は500エラーを返す', async () => {
      // 環境変数設定
      vi.stubEnv('SESSION_TABLE_NAME', 'test-session-table')
      vi.stubEnv('OIDC_ISSUER', 'https://cognito-idp.ap-northeast-1.amazonaws.com/pool-id')
      vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')
      vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')
      vi.stubEnv('SSM_CLOUDFRONT_URL_PARAM', '/oidc-sandbox/cloudfront-url')

      // モック設定
      dynamoMock.on(PutItemCommand).resolves({})
      ssmMock.on(GetParameterCommand).rejects(new Error('SSM Error'))
      secretsMock
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
        .resolves({ SecretString: 'test-client-id' })
        .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
        .resolves({ SecretString: 'test-client-secret' })

      const mockConfig = {
        serverMetadata: () => ({
          authorization_endpoint: 'https://auth.example.com/oauth2/authorize'
        })
      } as unknown as client.Configuration
      vi.mocked(client.discovery).mockResolvedValue(mockConfig)

      // 実行
      const result = await handler(createMockEvent())

      // 検証
      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body || '')).toEqual({
        error: 'Server configuration error'
      })
    })

    it('Secrets Manager取得失敗時は500エラーを返す', async () => {
      // 環境変数設定
      vi.stubEnv('SESSION_TABLE_NAME', 'test-session-table')
      vi.stubEnv('OIDC_ISSUER', 'https://cognito-idp.ap-northeast-1.amazonaws.com/pool-id')
      vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')
      vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')
      vi.stubEnv('SSM_CLOUDFRONT_URL_PARAM', '/oidc-sandbox/cloudfront-url')

      // モック設定
      dynamoMock.on(PutItemCommand).resolves({})
      ssmMock.on(GetParameterCommand).resolves({
        Parameter: { Value: 'https://example.cloudfront.net' }
      })
      // Secrets Manager: エラー
      secretsMock.on(GetSecretValueCommand).rejects(new Error('Secrets Manager Error'))

      // 実行
      const result = await handler(createMockEvent())

      // 検証
      expect(result.statusCode).toBe(500)
      expect(JSON.parse(result.body || '')).toEqual({
        error: 'Server configuration error'
      })
    })

    it('SESSION_TABLE_NAME環境変数未設定時は500エラーを返す', async () => {
      // 環境変数設定（SESSION_TABLE_NAMEなし）
      vi.stubEnv('SESSION_TABLE_NAME', '')
      vi.stubEnv('OIDC_ISSUER', 'https://cognito-idp.ap-northeast-1.amazonaws.com/pool-id')
      vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')
      vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')

      // 実行
      const result = await handler(createMockEvent())

      // 検証
      expect(result.statusCode).toBe(500)
    })
  })
})
