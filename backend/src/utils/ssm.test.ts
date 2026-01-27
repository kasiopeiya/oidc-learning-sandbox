/**
 * SSM Parameter Store ユーティリティのテスト
 */
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  getParameter,
  getCloudFrontUrl,
  getRedirectUri,
  clearParameterCache,
} from './ssm';

// SSMクライアントのモック
const ssmMock = mockClient(SSMClient);

describe('ssm', () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    ssmMock.reset();
    // キャッシュをクリア
    clearParameterCache();
    // 環境変数をリセット
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('正常系', () => {
    describe('getParameter', () => {
      it('SSM Parameter Storeからパラメータを取得する', async () => {
        // モック設定
        ssmMock.on(GetParameterCommand).resolves({
          Parameter: {
            Name: '/test/param',
            Value: 'test-value',
          },
        });

        // 実行
        const result = await getParameter('/test/param');

        // 検証
        expect(result).toBe('test-value');
      });

      it('2回目以降はキャッシュから取得する', async () => {
        // モック設定
        ssmMock.on(GetParameterCommand).resolves({
          Parameter: {
            Name: '/test/param',
            Value: 'cached-value',
          },
        });

        // 実行: 1回目
        const result1 = await getParameter('/test/param');
        // 実行: 2回目
        const result2 = await getParameter('/test/param');

        // 検証
        expect(result1).toBe('cached-value');
        expect(result2).toBe('cached-value');
        // SSM APIは1回だけ呼ばれる
        expect(ssmMock.calls()).toHaveLength(1);
      });

      it('異なるパラメータ名は個別にキャッシュされる', async () => {
        // モック設定
        ssmMock
          .on(GetParameterCommand, { Name: '/param1' })
          .resolves({ Parameter: { Name: '/param1', Value: 'value1' } })
          .on(GetParameterCommand, { Name: '/param2' })
          .resolves({ Parameter: { Name: '/param2', Value: 'value2' } });

        // 実行
        const result1 = await getParameter('/param1');
        const result2 = await getParameter('/param2');
        const result1Cached = await getParameter('/param1');

        // 検証
        expect(result1).toBe('value1');
        expect(result2).toBe('value2');
        expect(result1Cached).toBe('value1');
        // 各パラメータにつき1回ずつ、計2回
        expect(ssmMock.calls()).toHaveLength(2);
      });
    });

    describe('getCloudFrontUrl', () => {
      it('環境変数で指定されたパラメータ名からCloudFront URLを取得する', async () => {
        // 環境変数設定
        vi.stubEnv('SSM_CLOUDFRONT_URL_PARAM', '/oidc-sandbox/cloudfront-url');

        // モック設定
        ssmMock.on(GetParameterCommand).resolves({
          Parameter: {
            Name: '/oidc-sandbox/cloudfront-url',
            Value: 'https://example.cloudfront.net',
          },
        });

        // 実行
        const result = await getCloudFrontUrl();

        // 検証
        expect(result).toBe('https://example.cloudfront.net');
      });
    });

    describe('getRedirectUri', () => {
      it('CloudFront URLに/api/auth/callbackを付加したURIを返す', async () => {
        // 環境変数設定
        vi.stubEnv('SSM_CLOUDFRONT_URL_PARAM', '/oidc-sandbox/cloudfront-url');

        // モック設定
        ssmMock.on(GetParameterCommand).resolves({
          Parameter: {
            Name: '/oidc-sandbox/cloudfront-url',
            Value: 'https://example.cloudfront.net',
          },
        });

        // 実行
        const result = await getRedirectUri();

        // 検証
        expect(result).toBe('https://example.cloudfront.net/api/auth/callback');
      });
    });

    describe('clearParameterCache', () => {
      it('キャッシュをクリアすると再度SSM APIが呼ばれる', async () => {
        // モック設定
        ssmMock.on(GetParameterCommand).resolves({
          Parameter: {
            Name: '/test/param',
            Value: 'value',
          },
        });

        // 実行: 1回目
        await getParameter('/test/param');
        // キャッシュクリア
        clearParameterCache();
        // 実行: 2回目（キャッシュクリア後）
        await getParameter('/test/param');

        // 検証: 2回呼ばれる
        expect(ssmMock.calls()).toHaveLength(2);
      });
    });
  });

  describe('異常系', () => {
    describe('getParameter', () => {
      it('パラメータが存在しない場合はエラーをスローする', async () => {
        // モック設定: Parameter.Valueがundefined
        ssmMock.on(GetParameterCommand).resolves({
          Parameter: {
            Name: '/test/param',
            Value: undefined,
          },
        });

        // 実行・検証
        await expect(getParameter('/test/param')).rejects.toThrow(
          'SSM parameter not found: /test/param'
        );
      });

      it('Parameterオブジェクトがnullの場合はエラーをスローする', async () => {
        // モック設定
        ssmMock.on(GetParameterCommand).resolves({
          Parameter: undefined,
        });

        // 実行・検証
        await expect(getParameter('/test/param')).rejects.toThrow(
          'SSM parameter not found: /test/param'
        );
      });

      it('SSM APIエラー時はエラーをスローする', async () => {
        // モック設定
        ssmMock.on(GetParameterCommand).rejects(new Error('SSM API Error'));

        // 実行・検証
        await expect(getParameter('/test/param')).rejects.toThrow('SSM API Error');
      });

      it('ネットワークエラー時はエラーをスローする', async () => {
        // モック設定
        const networkError = new Error('Network timeout');
        networkError.name = 'TimeoutError';
        ssmMock.on(GetParameterCommand).rejects(networkError);

        // 実行・検証
        await expect(getParameter('/test/param')).rejects.toThrow('Network timeout');
      });

      it('ParameterNotFound例外時はエラーをスローする', async () => {
        // モック設定
        const notFoundError = new Error('ParameterNotFound');
        notFoundError.name = 'ParameterNotFound';
        ssmMock.on(GetParameterCommand).rejects(notFoundError);

        // 実行・検証
        await expect(getParameter('/test/param')).rejects.toThrow('ParameterNotFound');
      });
    });

    describe('getCloudFrontUrl', () => {
      it('環境変数が設定されていない場合はエラーをスローする', async () => {
        // 環境変数が設定されていない状態
        delete process.env.SSM_CLOUDFRONT_URL_PARAM;

        // 実行・検証
        await expect(getCloudFrontUrl()).rejects.toThrow(
          'SSM_CLOUDFRONT_URL_PARAM environment variable is not set'
        );
      });

      it('環境変数が空文字列の場合はエラーをスローする', async () => {
        // 環境変数設定（空文字列）
        vi.stubEnv('SSM_CLOUDFRONT_URL_PARAM', '');

        // 実行・検証
        await expect(getCloudFrontUrl()).rejects.toThrow(
          'SSM_CLOUDFRONT_URL_PARAM environment variable is not set'
        );
      });
    });

    describe('getRedirectUri', () => {
      it('CloudFront URL取得に失敗した場合はエラーをスローする', async () => {
        // 環境変数設定
        vi.stubEnv('SSM_CLOUDFRONT_URL_PARAM', '/oidc-sandbox/cloudfront-url');

        // モック設定
        ssmMock.on(GetParameterCommand).rejects(new Error('SSM Error'));

        // 実行・検証
        await expect(getRedirectUri()).rejects.toThrow('SSM Error');
      });
    });
  });
});
