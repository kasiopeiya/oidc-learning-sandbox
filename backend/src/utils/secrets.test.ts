/**
 * Secrets Manager ユーティリティのテスト
 */
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import { mockClient } from 'aws-sdk-client-mock'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { getClientId, getClientSecret, clearSecretCache } from './secrets'

// Secrets Managerクライアントのモック
const secretsMock = mockClient(SecretsManagerClient)

describe('secrets', () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    secretsMock.reset()
    // キャッシュをクリア
    clearSecretCache()
    // 環境変数をリセット
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('正常系', () => {
    describe('getClientId', () => {
      it('Secrets ManagerからClient IDを取得する', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')

        // モック設定
        secretsMock.on(GetSecretValueCommand).resolves({
          SecretString: 'test-client-id'
        })

        // 実行
        const result = await getClientId()

        // 検証
        expect(result).toBe('test-client-id')
      })

      it('2回目以降はキャッシュから取得する', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')

        // モック設定
        secretsMock.on(GetSecretValueCommand).resolves({
          SecretString: 'cached-client-id'
        })

        // 実行: 1回目
        const result1 = await getClientId()
        // 実行: 2回目
        const result2 = await getClientId()

        // 検証
        expect(result1).toBe('cached-client-id')
        expect(result2).toBe('cached-client-id')
        // Secrets Manager APIは1回だけ呼ばれる
        expect(secretsMock.calls()).toHaveLength(1)
      })
    })

    describe('getClientSecret', () => {
      it('Secrets ManagerからClient Secretを取得する', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')

        // モック設定
        secretsMock.on(GetSecretValueCommand).resolves({
          SecretString: 'test-client-secret'
        })

        // 実行
        const result = await getClientSecret()

        // 検証
        expect(result).toBe('test-client-secret')
      })

      it('2回目以降はキャッシュから取得する', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')

        // モック設定
        secretsMock.on(GetSecretValueCommand).resolves({
          SecretString: 'cached-client-secret'
        })

        // 実行: 1回目
        const result1 = await getClientSecret()
        // 実行: 2回目
        const result2 = await getClientSecret()

        // 検証
        expect(result1).toBe('cached-client-secret')
        expect(result2).toBe('cached-client-secret')
        // Secrets Manager APIは1回だけ呼ばれる
        expect(secretsMock.calls()).toHaveLength(1)
      })
    })

    describe('clearSecretCache', () => {
      it('キャッシュをクリアすると再度Secrets Manager APIが呼ばれる', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')

        // モック設定
        secretsMock.on(GetSecretValueCommand).resolves({
          SecretString: 'value'
        })

        // 実行: 1回目
        await getClientId()
        // キャッシュクリア
        clearSecretCache()
        // 実行: 2回目（キャッシュクリア後）
        await getClientId()

        // 検証: 2回呼ばれる
        expect(secretsMock.calls()).toHaveLength(2)
      })
    })
  })

  describe('異常系', () => {
    describe('getClientId', () => {
      it('環境変数が設定されていない場合はエラーをスローする', async () => {
        // 環境変数が設定されていない状態
        delete process.env.OIDC_CLIENT_ID_KEY

        // 実行・検証
        await expect(getClientId()).rejects.toThrow(
          'OIDC_CLIENT_ID_KEY environment variable is not set'
        )
      })

      it('環境変数が空文字列の場合はエラーをスローする', async () => {
        // 環境変数設定（空文字列）
        vi.stubEnv('OIDC_CLIENT_ID_KEY', '')

        // 実行・検証
        await expect(getClientId()).rejects.toThrow(
          'OIDC_CLIENT_ID_KEY environment variable is not set'
        )
      })

      it('シークレットが存在しない場合はエラーをスローする', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')

        // モック設定: ResourceNotFoundException
        const notFoundError = new Error("Secrets Manager can't find the specified secret.")
        notFoundError.name = 'ResourceNotFoundException'
        secretsMock.on(GetSecretValueCommand).rejects(notFoundError)

        // 実行・検証
        await expect(getClientId()).rejects.toThrow(
          "Secrets Manager can't find the specified secret."
        )
      })

      it('SecretStringが空の場合はエラーをスローする', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')

        // モック設定
        secretsMock.on(GetSecretValueCommand).resolves({
          SecretString: undefined
        })

        // 実行・検証
        await expect(getClientId()).rejects.toThrow('Secret value is empty: oidc-sandbox/client-id')
      })

      it('ネットワークエラー時はエラーをスローする', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')

        // モック設定
        const networkError = new Error('Network timeout')
        networkError.name = 'TimeoutError'
        secretsMock.on(GetSecretValueCommand).rejects(networkError)

        // 実行・検証
        await expect(getClientId()).rejects.toThrow('Network timeout')
      })

      it('アクセス権限エラー時はエラーをスローする', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_CLIENT_ID_KEY', 'oidc-sandbox/client-id')

        // モック設定
        const accessDeniedError = new Error('Access Denied')
        accessDeniedError.name = 'AccessDeniedException'
        secretsMock.on(GetSecretValueCommand).rejects(accessDeniedError)

        // 実行・検証
        await expect(getClientId()).rejects.toThrow('Access Denied')
      })
    })

    describe('getClientSecret', () => {
      it('環境変数が設定されていない場合はエラーをスローする', async () => {
        // 環境変数が設定されていない状態
        delete process.env.OIDC_CLIENT_SECRET_KEY

        // 実行・検証
        await expect(getClientSecret()).rejects.toThrow(
          'OIDC_CLIENT_SECRET_KEY environment variable is not set'
        )
      })

      it('環境変数が空文字列の場合はエラーをスローする', async () => {
        // 環境変数設定（空文字列）
        vi.stubEnv('OIDC_CLIENT_SECRET_KEY', '')

        // 実行・検証
        await expect(getClientSecret()).rejects.toThrow(
          'OIDC_CLIENT_SECRET_KEY environment variable is not set'
        )
      })

      it('シークレットが存在しない場合はエラーをスローする', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')

        // モック設定
        const notFoundError = new Error("Secrets Manager can't find the specified secret.")
        notFoundError.name = 'ResourceNotFoundException'
        secretsMock.on(GetSecretValueCommand).rejects(notFoundError)

        // 実行・検証
        await expect(getClientSecret()).rejects.toThrow(
          "Secrets Manager can't find the specified secret."
        )
      })

      it('Secrets Manager APIエラー時はエラーをスローする', async () => {
        // 環境変数設定
        vi.stubEnv('OIDC_CLIENT_SECRET_KEY', 'oidc-sandbox/client-secret')

        // モック設定
        const serviceError = new Error('Service unavailable')
        serviceError.name = 'ServiceException'
        secretsMock.on(GetSecretValueCommand).rejects(serviceError)

        // 実行・検証
        await expect(getClientSecret()).rejects.toThrow('Service unavailable')
      })
    })
  })
})
