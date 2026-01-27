/**
 * セッション管理ユーティリティのテスト
 */
import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand
} from '@aws-sdk/client-dynamodb'
import { mockClient } from 'aws-sdk-client-mock'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  generateSessionId,
  saveSession,
  getSession,
  deleteSession,
  createSessionCookie,
  createDeleteSessionCookie,
  getSessionIdFromCookie,
  saveAuthenticatedSession,
  getAuthenticatedSession,
  SESSION_COOKIE_NAME,
  SessionData,
  AuthenticatedSessionData
} from './session'

// DynamoDBクライアントのモック
const dynamoMock = mockClient(DynamoDBClient)

describe('session', () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    dynamoMock.reset()
    // 環境変数をリセット
    vi.unstubAllEnvs()
    // 環境変数を設定
    vi.stubEnv('SESSION_TABLE_NAME', 'test-session-table')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('正常系', () => {
    describe('generateSessionId', () => {
      it('43文字のセッションIDを生成する', () => {
        // 実行
        const sessionId = generateSessionId()

        // 検証
        expect(sessionId).toHaveLength(43)
      })

      it('URLセーフな文字のみを含む', () => {
        // 実行
        const sessionId = generateSessionId()

        // 検証: Base64URL形式
        expect(sessionId).toMatch(/^[A-Za-z0-9_-]+$/)
      })

      it('複数回実行すると異なる値を生成する', () => {
        // 実行
        const ids = new Set<string>()
        for (let i = 0; i < 100; i++) {
          ids.add(generateSessionId())
        }

        // 検証
        expect(ids.size).toBe(100)
      })
    })

    describe('saveSession', () => {
      it('セッションデータをDynamoDBに保存する', async () => {
        // モック設定
        dynamoMock.on(PutItemCommand).resolves({})

        // 実行
        const sessionData: SessionData = {
          state: 'test-state',
          nonce: 'test-nonce',
          codeVerifier: 'test-code-verifier'
        }
        await saveSession('session-id-123', sessionData)

        // 検証: PutItemCommandが呼ばれた
        const calls = dynamoMock.commandCalls(PutItemCommand)
        expect(calls).toHaveLength(1)

        // 保存されたデータを検証
        const input = calls[0].args[0].input
        expect(input.TableName).toBe('test-session-table')
        expect(input.Item?.sessionId?.S).toBe('session-id-123')
        expect(input.Item?.state?.S).toBe('test-state')
        expect(input.Item?.nonce?.S).toBe('test-nonce')
        expect(input.Item?.codeVerifier?.S).toBe('test-code-verifier')
        expect(input.Item?.ttl?.N).toBeDefined()
      })

      it('TTLが正しく設定される', async () => {
        // モック設定
        dynamoMock.on(PutItemCommand).resolves({})

        // 現在時刻を固定
        const now = Date.now()
        vi.spyOn(Date, 'now').mockReturnValue(now)

        // 実行
        await saveSession('session-id', {
          state: 's',
          nonce: 'n',
          codeVerifier: 'cv'
        })

        // 検証: TTLは現在時刻+300秒
        const calls = dynamoMock.commandCalls(PutItemCommand)
        const ttl = parseInt(calls[0].args[0].input.Item?.ttl?.N || '0', 10)
        const expectedTtl = Math.floor(now / 1000) + 300
        expect(ttl).toBe(expectedTtl)

        vi.restoreAllMocks()
      })
    })

    describe('getSession', () => {
      it('DynamoDBからセッションデータを取得する', async () => {
        // モック設定
        dynamoMock.on(GetItemCommand).resolves({
          Item: {
            sessionId: { S: 'session-id-123' },
            state: { S: 'test-state' },
            nonce: { S: 'test-nonce' },
            codeVerifier: { S: 'test-code-verifier' },
            ttl: { N: '1234567890' }
          }
        })

        // 実行
        const result = await getSession('session-id-123')

        // 検証
        expect(result).toEqual({
          state: 'test-state',
          nonce: 'test-nonce',
          codeVerifier: 'test-code-verifier'
        })
      })

      it('セッションが存在しない場合はnullを返す', async () => {
        // モック設定
        dynamoMock.on(GetItemCommand).resolves({
          Item: undefined
        })

        // 実行
        const result = await getSession('non-existent-session')

        // 検証
        expect(result).toBeNull()
      })
    })

    describe('deleteSession', () => {
      it('DynamoDBからセッションデータを削除する', async () => {
        // モック設定
        dynamoMock.on(DeleteItemCommand).resolves({})

        // 実行
        await deleteSession('session-id-123')

        // 検証
        const calls = dynamoMock.commandCalls(DeleteItemCommand)
        expect(calls).toHaveLength(1)
        expect(calls[0].args[0].input.TableName).toBe('test-session-table')
        expect(calls[0].args[0].input.Key?.sessionId?.S).toBe('session-id-123')
      })
    })

    describe('createSessionCookie', () => {
      it('セキュア属性を持つセッションCookieを生成する', () => {
        // 実行
        const cookie = createSessionCookie('session-id-123')

        // 検証
        expect(cookie).toContain(`${SESSION_COOKIE_NAME}=session-id-123`)
        expect(cookie).toContain('Max-Age=300')
        expect(cookie).toContain('HttpOnly')
        expect(cookie).toContain('Secure')
        expect(cookie).toContain('SameSite=Lax')
        expect(cookie).toContain('Path=/')
      })
    })

    describe('createDeleteSessionCookie', () => {
      it('セッションCookie削除用のヘッダー値を生成する', () => {
        // 実行
        const cookie = createDeleteSessionCookie()

        // 検証
        expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`)
        expect(cookie).toContain('Max-Age=0')
        expect(cookie).toContain('HttpOnly')
        expect(cookie).toContain('Secure')
      })
    })

    describe('getSessionIdFromCookie', () => {
      it('Cookieヘッダーからセッションを取得する', () => {
        // 実行
        const sessionId = getSessionIdFromCookie(`${SESSION_COOKIE_NAME}=abc123def456`)

        // 検証
        expect(sessionId).toBe('abc123def456')
      })

      it('複数のCookieがある場合でもセッションIDを取得する', () => {
        // 実行
        const sessionId = getSessionIdFromCookie(
          `other=value; ${SESSION_COOKIE_NAME}=session-id-123; another=test`
        )

        // 検証
        expect(sessionId).toBe('session-id-123')
      })

      it('Cookie値に=が含まれる場合も正しく取得する', () => {
        // 実行
        const sessionId = getSessionIdFromCookie(`${SESSION_COOKIE_NAME}=abc=def=ghi`)

        // 検証
        expect(sessionId).toBe('abc=def=ghi')
      })
    })

    describe('saveAuthenticatedSession', () => {
      it('認証済みセッションデータをDynamoDBに保存する', async () => {
        // モック設定
        dynamoMock.on(PutItemCommand).resolves({})

        // 実行
        const data: AuthenticatedSessionData = {
          accessToken: 'test-access-token',
          email: 'test@example.com',
          sub: 'user-sub-123'
        }
        await saveAuthenticatedSession('session-id-123', data)

        // 検証
        const calls = dynamoMock.commandCalls(PutItemCommand)
        expect(calls).toHaveLength(1)

        const input = calls[0].args[0].input
        expect(input.Item?.accessToken?.S).toBe('test-access-token')
        expect(input.Item?.email?.S).toBe('test@example.com')
        expect(input.Item?.sub?.S).toBe('user-sub-123')
        expect(input.Item?.authenticated?.BOOL).toBe(true)
      })
    })

    describe('getAuthenticatedSession', () => {
      it('認証済みセッションデータを取得する', async () => {
        // モック設定
        dynamoMock.on(GetItemCommand).resolves({
          Item: {
            sessionId: { S: 'session-id-123' },
            accessToken: { S: 'test-access-token' },
            email: { S: 'test@example.com' },
            sub: { S: 'user-sub-123' },
            authenticated: { BOOL: true },
            ttl: { N: '1234567890' }
          }
        })

        // 実行
        const result = await getAuthenticatedSession('session-id-123')

        // 検証
        expect(result).toEqual({
          accessToken: 'test-access-token',
          email: 'test@example.com',
          sub: 'user-sub-123'
        })
      })
    })
  })

  describe('異常系', () => {
    describe('saveSession', () => {
      it('SESSION_TABLE_NAME環境変数が未設定の場合はエラーをスローする', async () => {
        // 環境変数を削除
        vi.stubEnv('SESSION_TABLE_NAME', '')

        // 実行・検証
        await expect(
          saveSession('session-id', {
            state: 's',
            nonce: 'n',
            codeVerifier: 'cv'
          })
        ).rejects.toThrow('SESSION_TABLE_NAME environment variable is not set')
      })

      it('DynamoDB PutItem失敗時はエラーをスローする', async () => {
        // モック設定
        dynamoMock.on(PutItemCommand).rejects(new Error('DynamoDB PutItem Error'))

        // 実行・検証
        await expect(
          saveSession('session-id', {
            state: 's',
            nonce: 'n',
            codeVerifier: 'cv'
          })
        ).rejects.toThrow('DynamoDB PutItem Error')
      })

      it('ネットワークタイムアウト時はエラーをスローする', async () => {
        // モック設定
        const timeoutError = new Error('Connection timeout')
        timeoutError.name = 'TimeoutError'
        dynamoMock.on(PutItemCommand).rejects(timeoutError)

        // 実行・検証
        await expect(
          saveSession('session-id', {
            state: 's',
            nonce: 'n',
            codeVerifier: 'cv'
          })
        ).rejects.toThrow('Connection timeout')
      })
    })

    describe('getSession', () => {
      it('SESSION_TABLE_NAME環境変数が未設定の場合はエラーをスローする', async () => {
        // 環境変数を削除
        vi.stubEnv('SESSION_TABLE_NAME', '')

        // 実行・検証
        await expect(getSession('session-id')).rejects.toThrow(
          'SESSION_TABLE_NAME environment variable is not set'
        )
      })

      it('DynamoDB GetItem失敗時はエラーをスローする', async () => {
        // モック設定
        dynamoMock.on(GetItemCommand).rejects(new Error('DynamoDB GetItem Error'))

        // 実行・検証
        await expect(getSession('session-id')).rejects.toThrow('DynamoDB GetItem Error')
      })

      it('セッションデータが不完全な場合はnullを返す（stateなし）', async () => {
        // モック設定: stateがない
        dynamoMock.on(GetItemCommand).resolves({
          Item: {
            sessionId: { S: 'session-id' },
            nonce: { S: 'test-nonce' },
            codeVerifier: { S: 'test-code-verifier' }
          }
        })

        // 実行
        const result = await getSession('session-id')

        // 検証
        expect(result).toBeNull()
      })

      it('セッションデータが不完全な場合はnullを返す（nonceなし）', async () => {
        // モック設定: nonceがない
        dynamoMock.on(GetItemCommand).resolves({
          Item: {
            sessionId: { S: 'session-id' },
            state: { S: 'test-state' },
            codeVerifier: { S: 'test-code-verifier' }
          }
        })

        // 実行
        const result = await getSession('session-id')

        // 検証
        expect(result).toBeNull()
      })

      it('セッションデータが不完全な場合はnullを返す（codeVerifierなし）', async () => {
        // モック設定: codeVerifierがない
        dynamoMock.on(GetItemCommand).resolves({
          Item: {
            sessionId: { S: 'session-id' },
            state: { S: 'test-state' },
            nonce: { S: 'test-nonce' }
          }
        })

        // 実行
        const result = await getSession('session-id')

        // 検証
        expect(result).toBeNull()
      })
    })

    describe('deleteSession', () => {
      it('SESSION_TABLE_NAME環境変数が未設定の場合はエラーをスローする', async () => {
        // 環境変数を削除
        vi.stubEnv('SESSION_TABLE_NAME', '')

        // 実行・検証
        await expect(deleteSession('session-id')).rejects.toThrow(
          'SESSION_TABLE_NAME environment variable is not set'
        )
      })

      it('DynamoDB DeleteItem失敗時はエラーをスローする', async () => {
        // モック設定
        dynamoMock.on(DeleteItemCommand).rejects(new Error('DynamoDB DeleteItem Error'))

        // 実行・検証
        await expect(deleteSession('session-id')).rejects.toThrow('DynamoDB DeleteItem Error')
      })
    })

    describe('getSessionIdFromCookie', () => {
      it('Cookieヘッダーがundefinedの場合はnullを返す', () => {
        // 実行
        const result = getSessionIdFromCookie(undefined)

        // 検証
        expect(result).toBeNull()
      })

      it('Cookieヘッダーが空文字列の場合はnullを返す', () => {
        // 実行
        const result = getSessionIdFromCookie('')

        // 検証
        expect(result).toBeNull()
      })

      it('セッションCookieが存在しない場合はnullを返す', () => {
        // 実行
        const result = getSessionIdFromCookie('other=value; another=test')

        // 検証
        expect(result).toBeNull()
      })
    })

    describe('saveAuthenticatedSession', () => {
      it('SESSION_TABLE_NAME環境変数が未設定の場合はエラーをスローする', async () => {
        // 環境変数を削除
        vi.stubEnv('SESSION_TABLE_NAME', '')

        // 実行・検証
        await expect(
          saveAuthenticatedSession('session-id', {
            accessToken: 'token',
            email: 'test@example.com',
            sub: 'sub'
          })
        ).rejects.toThrow('SESSION_TABLE_NAME environment variable is not set')
      })

      it('DynamoDB PutItem失敗時はエラーをスローする', async () => {
        // モック設定
        dynamoMock.on(PutItemCommand).rejects(new Error('DynamoDB Error'))

        // 実行・検証
        await expect(
          saveAuthenticatedSession('session-id', {
            accessToken: 'token',
            email: 'test@example.com',
            sub: 'sub'
          })
        ).rejects.toThrow('DynamoDB Error')
      })
    })

    describe('getAuthenticatedSession', () => {
      it('SESSION_TABLE_NAME環境変数が未設定の場合はエラーをスローする', async () => {
        // 環境変数を削除
        vi.stubEnv('SESSION_TABLE_NAME', '')

        // 実行・検証
        await expect(getAuthenticatedSession('session-id')).rejects.toThrow(
          'SESSION_TABLE_NAME environment variable is not set'
        )
      })

      it('認証済みセッションが存在しない場合はnullを返す', async () => {
        // モック設定
        dynamoMock.on(GetItemCommand).resolves({
          Item: undefined
        })

        // 実行
        const result = await getAuthenticatedSession('session-id')

        // 検証
        expect(result).toBeNull()
      })

      it('authenticatedフラグがfalseの場合はnullを返す', async () => {
        // モック設定: authenticated = false
        dynamoMock.on(GetItemCommand).resolves({
          Item: {
            sessionId: { S: 'session-id' },
            accessToken: { S: 'token' },
            email: { S: 'test@example.com' },
            sub: { S: 'sub' },
            authenticated: { BOOL: false }
          }
        })

        // 実行
        const result = await getAuthenticatedSession('session-id')

        // 検証
        expect(result).toBeNull()
      })

      it('認証済みセッションデータが不完全な場合はnullを返す（accessTokenなし）', async () => {
        // モック設定
        dynamoMock.on(GetItemCommand).resolves({
          Item: {
            sessionId: { S: 'session-id' },
            email: { S: 'test@example.com' },
            sub: { S: 'sub' },
            authenticated: { BOOL: true }
          }
        })

        // 実行
        const result = await getAuthenticatedSession('session-id')

        // 検証
        expect(result).toBeNull()
      })

      it('認証済みセッションデータが不完全な場合はnullを返す（emailなし）', async () => {
        // モック設定
        dynamoMock.on(GetItemCommand).resolves({
          Item: {
            sessionId: { S: 'session-id' },
            accessToken: { S: 'token' },
            sub: { S: 'sub' },
            authenticated: { BOOL: true }
          }
        })

        // 実行
        const result = await getAuthenticatedSession('session-id')

        // 検証
        expect(result).toBeNull()
      })

      it('認証済みセッションデータが不完全な場合はnullを返す（subなし）', async () => {
        // モック設定
        dynamoMock.on(GetItemCommand).resolves({
          Item: {
            sessionId: { S: 'session-id' },
            accessToken: { S: 'token' },
            email: { S: 'test@example.com' },
            authenticated: { BOOL: true }
          }
        })

        // 実行
        const result = await getAuthenticatedSession('session-id')

        // 検証
        expect(result).toBeNull()
      })

      it('DynamoDB GetItem失敗時はエラーをスローする', async () => {
        // モック設定
        dynamoMock.on(GetItemCommand).rejects(new Error('DynamoDB Error'))

        // 実行・検証
        await expect(getAuthenticatedSession('session-id')).rejects.toThrow('DynamoDB Error')
      })
    })
  })
})
