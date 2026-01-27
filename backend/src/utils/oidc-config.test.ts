/**
 * OIDC Configuration ユーティリティのテスト
 */
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import { mockClient } from 'aws-sdk-client-mock'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as client from 'openid-client'

import {
  getOidcEnvVars,
  getOidcConfig,
  getAuthorizationEndpoint,
  getUserInfoEndpoint,
  clearConfigCache
} from './oidc-config'
import { clearSecretCache } from './secrets'

// Secrets Managerクライアントのモック
const secretsMock = mockClient(SecretsManagerClient)

// openid-clientのdiscovery関数をモック
vi.mock('openid-client', async () => {
  const actual = await vi.importActual<typeof client>('openid-client')
  return {
    ...actual,
    discovery: vi.fn()
  }
})

describe('oidc-config', () => {
  beforeEach(() => {
    // モックをリセット
    secretsMock.reset()
    vi.clearAllMocks()
    // キャッシュをクリア
    clearConfigCache()
    clearSecretCache()
    // 環境変数をリセット
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('正常系', () => {
    describe('getOidcEnvVars', () => {
      it('Issuer、Client ID、Client Secretを取得する', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_ISSUER', 'https://cognito-idp.ap-northeast-1.amazonaws.com/pool-id')
        vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')
        vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')

        // モック設定
        secretsMock
          .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
          .resolves({ SecretString: 'test-client-id' })
          .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
          .resolves({ SecretString: 'test-client-secret' })

        // 実行
        const result = await getOidcEnvVars()

        // 検証
        expect(result.issuer).toBe('https://cognito-idp.ap-northeast-1.amazonaws.com/pool-id')
        expect(result.clientId).toBe('test-client-id')
        expect(result.clientSecret).toBe('test-client-secret')
      })
    })

    describe('getOidcConfig', () => {
      it('OIDC Discoveryを実行してConfigurationを取得する', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_ISSUER', 'https://cognito-idp.ap-northeast-1.amazonaws.com/pool-id')
        vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')
        vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')

        // モック設定
        secretsMock
          .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
          .resolves({ SecretString: 'test-client-id' })
          .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
          .resolves({ SecretString: 'test-client-secret' })

        // openid-clientのdiscoveryをモック
        const mockConfig = {
          serverMetadata: () => ({
            authorization_endpoint: 'https://auth.example.com/authorize',
            token_endpoint: 'https://auth.example.com/token',
            userinfo_endpoint: 'https://auth.example.com/userinfo',
            jwks_uri: 'https://auth.example.com/.well-known/jwks.json'
          })
        } as unknown as client.Configuration

        vi.mocked(client.discovery).mockResolvedValue(mockConfig)

        // 実行
        const result = await getOidcConfig()

        // 検証
        expect(result).toBe(mockConfig)
        expect(client.discovery).toHaveBeenCalledTimes(1)
      })

      it('2回目以降はキャッシュから取得する', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_ISSUER', 'https://cognito-idp.ap-northeast-1.amazonaws.com/pool-id')
        vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')
        vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')

        // モック設定
        secretsMock
          .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
          .resolves({ SecretString: 'test-client-id' })
          .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
          .resolves({ SecretString: 'test-client-secret' })

        const mockConfig = {
          serverMetadata: () => ({})
        } as unknown as client.Configuration

        vi.mocked(client.discovery).mockResolvedValue(mockConfig)

        // 実行: 1回目
        await getOidcConfig()
        // 実行: 2回目
        await getOidcConfig()

        // 検証: discoveryは1回だけ呼ばれる
        expect(client.discovery).toHaveBeenCalledTimes(1)
      })
    })

    describe('getAuthorizationEndpoint', () => {
      it('認可エンドポイントURLを取得する', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_ISSUER', 'https://cognito-idp.ap-northeast-1.amazonaws.com/pool-id')
        vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')
        vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')

        // モック設定
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
        const result = await getAuthorizationEndpoint()

        // 検証
        expect(result).toBe('https://auth.example.com/oauth2/authorize')
      })
    })

    describe('getUserInfoEndpoint', () => {
      it('UserInfoエンドポイントURLを取得する', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_ISSUER', 'https://cognito-idp.ap-northeast-1.amazonaws.com/pool-id')
        vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')
        vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')

        // モック設定
        secretsMock
          .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
          .resolves({ SecretString: 'test-client-id' })
          .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
          .resolves({ SecretString: 'test-client-secret' })

        const mockConfig = {
          serverMetadata: () => ({
            userinfo_endpoint: 'https://auth.example.com/oauth2/userInfo'
          })
        } as unknown as client.Configuration

        vi.mocked(client.discovery).mockResolvedValue(mockConfig)

        // 実行
        const result = await getUserInfoEndpoint()

        // 検証
        expect(result).toBe('https://auth.example.com/oauth2/userInfo')
      })
    })

    describe('clearConfigCache', () => {
      it('キャッシュをクリアすると再度discoveryが呼ばれる', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_ISSUER', 'https://cognito-idp.ap-northeast-1.amazonaws.com/pool-id')
        vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')
        vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')

        // モック設定
        secretsMock
          .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
          .resolves({ SecretString: 'test-client-id' })
          .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
          .resolves({ SecretString: 'test-client-secret' })

        const mockConfig = {
          serverMetadata: () => ({})
        } as unknown as client.Configuration

        vi.mocked(client.discovery).mockResolvedValue(mockConfig)

        // 実行: 1回目
        await getOidcConfig()
        // キャッシュクリア
        clearConfigCache()
        clearSecretCache()
        // 実行: 2回目
        await getOidcConfig()

        // 検証: discoveryが2回呼ばれる
        expect(client.discovery).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('異常系', () => {
    describe('getOidcEnvVars', () => {
      it('OIDC_ISSUER環境変数が未設定の場合はエラーをスローする', async () => {
        // 環境変数設定（ISSUERなし）
        delete process.env.OIDC_ISSUER
        vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')
        vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')

        // 実行・検証
        await expect(getOidcEnvVars()).rejects.toThrow(
          'OIDC_ISSUER environment variable is not set'
        )
      })

      it('OIDC_ISSUER環境変数が空文字列の場合はエラーをスローする', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_ISSUER', '')
        vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')
        vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')

        // 実行・検証
        await expect(getOidcEnvVars()).rejects.toThrow(
          'OIDC_ISSUER environment variable is not set'
        )
      })

      it('Client ID取得失敗時はエラーをスローする', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_ISSUER', 'https://example.com')
        vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')
        vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')

        // モック設定: Client ID取得でエラー
        secretsMock
          .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
          .rejects(new Error('Secrets Manager Error'))

        // 実行・検証
        await expect(getOidcEnvVars()).rejects.toThrow('Secrets Manager Error')
      })

      it('Client Secret取得失敗時はエラーをスローする', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_ISSUER', 'https://example.com')
        vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')
        vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')

        // モック設定
        secretsMock
          .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
          .resolves({ SecretString: 'test-client-id' })
          .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
          .rejects(new Error('Secrets Manager Error'))

        // 実行・検証
        await expect(getOidcEnvVars()).rejects.toThrow('Secrets Manager Error')
      })
    })

    describe('getOidcConfig', () => {
      it('OIDC Discovery失敗時はエラーをスローする', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_ISSUER', 'https://invalid-issuer.example.com')
        vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')
        vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')

        // モック設定
        secretsMock
          .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
          .resolves({ SecretString: 'test-client-id' })
          .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
          .resolves({ SecretString: 'test-client-secret' })

        // openid-clientのdiscoveryをエラーでモック
        vi.mocked(client.discovery).mockRejectedValue(
          new Error('OIDC Discovery failed: 404 Not Found')
        )

        // 実行・検証
        await expect(getOidcConfig()).rejects.toThrow('OIDC Discovery failed: 404 Not Found')
      })

      it('ネットワークエラー時はエラーをスローする', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_ISSUER', 'https://example.com')
        vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')
        vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')

        // モック設定
        secretsMock
          .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
          .resolves({ SecretString: 'test-client-id' })
          .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
          .resolves({ SecretString: 'test-client-secret' })

        const networkError = new TypeError('fetch failed')
        vi.mocked(client.discovery).mockRejectedValue(networkError)

        // 実行・検証
        await expect(getOidcConfig()).rejects.toThrow('fetch failed')
      })
    })

    describe('getAuthorizationEndpoint', () => {
      it('authorization_endpointが存在しない場合はエラーをスローする', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_ISSUER', 'https://example.com')
        vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')
        vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')

        // モック設定
        secretsMock
          .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
          .resolves({ SecretString: 'test-client-id' })
          .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
          .resolves({ SecretString: 'test-client-secret' })

        // authorization_endpointがないメタデータ
        const mockConfig = {
          serverMetadata: () => ({
            token_endpoint: 'https://auth.example.com/token'
          })
        } as unknown as client.Configuration

        vi.mocked(client.discovery).mockResolvedValue(mockConfig)

        // 実行・検証
        await expect(getAuthorizationEndpoint()).rejects.toThrow(
          'authorization_endpoint not found in OIDC Discovery'
        )
      })
    })

    describe('getUserInfoEndpoint', () => {
      it('userinfo_endpointが存在しない場合はエラーをスローする', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_ISSUER', 'https://example.com')
        vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')
        vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')

        // モック設定
        secretsMock
          .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-id' })
          .resolves({ SecretString: 'test-client-id' })
          .on(GetSecretValueCommand, { SecretId: 'oidc-sandbox/client-secret' })
          .resolves({ SecretString: 'test-client-secret' })

        // userinfo_endpointがないメタデータ
        const mockConfig = {
          serverMetadata: () => ({
            authorization_endpoint: 'https://auth.example.com/authorize'
          })
        } as unknown as client.Configuration

        vi.mocked(client.discovery).mockResolvedValue(mockConfig)

        // 実行・検証
        await expect(getUserInfoEndpoint()).rejects.toThrow(
          'userinfo_endpoint not found in OIDC Discovery'
        )
      })
    })
  })
})
