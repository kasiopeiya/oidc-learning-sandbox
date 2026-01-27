/**
 * API ユーティリティのテスト
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  getErrorMessage,
  createAccount,
  ERROR_MESSAGES,
  DEFAULT_ERROR_MESSAGE,
  type AccountResponse,
  type ErrorResponse,
} from './api';

// グローバルfetchのモック
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('api', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  describe('正常系', () => {
    describe('getErrorMessage', () => {
      it('定義されたエラーコードに対応するメッセージを返す', () => {
        // 各エラーコードをテスト
        expect(getErrorMessage('missing_session')).toBe(ERROR_MESSAGES.missing_session);
        expect(getErrorMessage('state_mismatch')).toBe(ERROR_MESSAGES.state_mismatch);
        expect(getErrorMessage('nonce_mismatch')).toBe(ERROR_MESSAGES.nonce_mismatch);
        expect(getErrorMessage('missing_code')).toBe(ERROR_MESSAGES.missing_code);
        expect(getErrorMessage('access_denied')).toBe(ERROR_MESSAGES.access_denied);
        expect(getErrorMessage('op_error')).toBe(ERROR_MESSAGES.op_error);
        expect(getErrorMessage('invalid_signature')).toBe(ERROR_MESSAGES.invalid_signature);
        expect(getErrorMessage('token_expired')).toBe(ERROR_MESSAGES.token_expired);
        expect(getErrorMessage('network_error')).toBe(ERROR_MESSAGES.network_error);
      });

      it('ERROR_MESSAGESの全てのキーに対応するメッセージがある', () => {
        // 全てのエラーコードが適切に定義されていることを確認
        Object.keys(ERROR_MESSAGES).forEach((errorCode) => {
          const message = getErrorMessage(errorCode);
          expect(message).toBeTruthy();
          expect(message).not.toBe(DEFAULT_ERROR_MESSAGE);
        });
      });
    });

    describe('createAccount', () => {
      it('成功時は口座情報を返す', async () => {
        // モック設定
        const mockResponse: AccountResponse = {
          accountNumber: '1234567890',
          email: 'test@example.com',
          sub: 'user-sub-123',
        };
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        // 実行
        const result = await createAccount();

        // 検証
        expect(result).toEqual(mockResponse);
      });

      it('APIが正しいエンドポイントとオプションで呼ばれる', async () => {
        // モック設定
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ accountNumber: '123', email: '', sub: '' }),
        });

        // 実行
        await createAccount();

        // 検証
        expect(mockFetch).toHaveBeenCalledWith('/api/account', {
          method: 'POST',
          credentials: 'include',
        });
      });
    });
  });

  describe('異常系', () => {
    describe('getErrorMessage', () => {
      it('nullの場合はデフォルトメッセージを返す', () => {
        // 実行
        const result = getErrorMessage(null);

        // 検証
        expect(result).toBe(DEFAULT_ERROR_MESSAGE);
      });

      it('空文字列の場合はデフォルトメッセージを返す', () => {
        // 実行
        const result = getErrorMessage('');

        // 検証
        expect(result).toBe(DEFAULT_ERROR_MESSAGE);
      });

      it('未定義のエラーコードの場合はデフォルトメッセージを返す', () => {
        // 実行
        const result = getErrorMessage('unknown_error_code');

        // 検証
        expect(result).toBe(DEFAULT_ERROR_MESSAGE);
      });

      it('特殊文字を含むエラーコードでもデフォルトメッセージを返す', () => {
        // 実行
        const result = getErrorMessage('<script>alert("xss")</script>');

        // 検証
        expect(result).toBe(DEFAULT_ERROR_MESSAGE);
      });
    });

    describe('createAccount', () => {
      it('APIエラー時はエラーレスポンスを返す', async () => {
        // モック設定
        const mockError: ErrorResponse = {
          error: '認証が必要です',
          code: 'missing_session',
        };
        mockFetch.mockResolvedValue({
          ok: false,
          status: 401,
          json: () => Promise.resolve(mockError),
        });

        // 実行
        const result = await createAccount();

        // 検証
        expect(result).toEqual(mockError);
        expect('error' in result).toBe(true);
      });

      it('サーバーエラー（500）時はエラーレスポンスを返す', async () => {
        // モック設定
        const mockError: ErrorResponse = {
          error: 'サーバーエラー',
          code: 'server_error',
        };
        mockFetch.mockResolvedValue({
          ok: false,
          status: 500,
          json: () => Promise.resolve(mockError),
        });

        // 実行
        const result = await createAccount();

        // 検証
        expect('error' in result).toBe(true);
      });

      it('ネットワークエラー時は例外をスローする', async () => {
        // モック設定
        mockFetch.mockRejectedValue(new Error('Network error'));

        // 実行・検証
        await expect(createAccount()).rejects.toThrow('Network error');
      });

      it('fetch失敗（TypeError）時は例外をスローする', async () => {
        // モック設定
        mockFetch.mockRejectedValue(new TypeError('fetch failed'));

        // 実行・検証
        await expect(createAccount()).rejects.toThrow('fetch failed');
      });

      it('JSONパースエラー時は例外をスローする', async () => {
        // モック設定
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.reject(new Error('Invalid JSON')),
        });

        // 実行・検証
        await expect(createAccount()).rejects.toThrow('Invalid JSON');
      });

      it('空のレスポンスボディでもエラーにならない', async () => {
        // モック設定
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({}),
        });

        // 実行
        const result = await createAccount();

        // 検証
        expect(result).toEqual({});
      });
    });
  });
});
