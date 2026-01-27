/**
 * AuthContext のテスト
 */
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';

import { AuthProvider, useAuth, type UserInfo, type AccountInfo } from './AuthContext';

describe('AuthContext', () => {
  describe('正常系', () => {
    describe('AuthProvider', () => {
      it('子コンポーネントをレンダリングする', () => {
        // 実行
        render(
          <AuthProvider>
            <div data-testid="child">Child Component</div>
          </AuthProvider>
        );

        // 検証
        expect(screen.getByTestId('child')).toBeInTheDocument();
        expect(screen.getByText('Child Component')).toBeInTheDocument();
      });
    });

    describe('useAuth', () => {
      it('初期状態でuser, account, isLoading, errorがnull/falseである', () => {
        // 実行
        const { result } = renderHook(() => useAuth(), {
          wrapper: AuthProvider,
        });

        // 検証
        expect(result.current.user).toBeNull();
        expect(result.current.account).toBeNull();
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
      });

      it('setUserでユーザー情報を設定できる', () => {
        // 実行
        const { result } = renderHook(() => useAuth(), {
          wrapper: AuthProvider,
        });

        const mockUser: UserInfo = {
          email: 'test@example.com',
          sub: 'user-sub-123',
        };

        act(() => {
          result.current.setUser(mockUser);
        });

        // 検証
        expect(result.current.user).toEqual(mockUser);
      });

      it('setAccountで口座情報を設定できる', () => {
        // 実行
        const { result } = renderHook(() => useAuth(), {
          wrapper: AuthProvider,
        });

        const mockAccount: AccountInfo = {
          accountNumber: '1234567890',
        };

        act(() => {
          result.current.setAccount(mockAccount);
        });

        // 検証
        expect(result.current.account).toEqual(mockAccount);
      });

      it('setIsLoadingでローディング状態を設定できる', () => {
        // 実行
        const { result } = renderHook(() => useAuth(), {
          wrapper: AuthProvider,
        });

        act(() => {
          result.current.setIsLoading(true);
        });

        // 検証
        expect(result.current.isLoading).toBe(true);

        act(() => {
          result.current.setIsLoading(false);
        });

        expect(result.current.isLoading).toBe(false);
      });

      it('setErrorでエラーを設定できる', () => {
        // 実行
        const { result } = renderHook(() => useAuth(), {
          wrapper: AuthProvider,
        });

        act(() => {
          result.current.setError('テストエラー');
        });

        // 検証
        expect(result.current.error).toBe('テストエラー');
      });

      it('resetで全ての状態をクリアできる', () => {
        // 実行
        const { result } = renderHook(() => useAuth(), {
          wrapper: AuthProvider,
        });

        // 状態を設定
        act(() => {
          result.current.setUser({ email: 'test@example.com', sub: 'sub' });
          result.current.setAccount({ accountNumber: '123' });
          result.current.setIsLoading(true);
          result.current.setError('error');
        });

        // 検証: 状態が設定されている
        expect(result.current.user).not.toBeNull();
        expect(result.current.account).not.toBeNull();
        expect(result.current.isLoading).toBe(true);
        expect(result.current.error).not.toBeNull();

        // リセット
        act(() => {
          result.current.reset();
        });

        // 検証: 全てクリアされている
        expect(result.current.user).toBeNull();
        expect(result.current.account).toBeNull();
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
      });

      it('setUserにnullを渡すとユーザー情報がクリアされる', () => {
        // 実行
        const { result } = renderHook(() => useAuth(), {
          wrapper: AuthProvider,
        });

        // ユーザーを設定
        act(() => {
          result.current.setUser({ email: 'test@example.com', sub: 'sub' });
        });

        expect(result.current.user).not.toBeNull();

        // nullでクリア
        act(() => {
          result.current.setUser(null);
        });

        // 検証
        expect(result.current.user).toBeNull();
      });

      it('setAccountにnullを渡すと口座情報がクリアされる', () => {
        // 実行
        const { result } = renderHook(() => useAuth(), {
          wrapper: AuthProvider,
        });

        // 口座を設定
        act(() => {
          result.current.setAccount({ accountNumber: '123' });
        });

        expect(result.current.account).not.toBeNull();

        // nullでクリア
        act(() => {
          result.current.setAccount(null);
        });

        // 検証
        expect(result.current.account).toBeNull();
      });

      it('setErrorにnullを渡すとエラーがクリアされる', () => {
        // 実行
        const { result } = renderHook(() => useAuth(), {
          wrapper: AuthProvider,
        });

        // エラーを設定
        act(() => {
          result.current.setError('エラー');
        });

        expect(result.current.error).not.toBeNull();

        // nullでクリア
        act(() => {
          result.current.setError(null);
        });

        // 検証
        expect(result.current.error).toBeNull();
      });
    });
  });

  describe('異常系', () => {
    describe('useAuth', () => {
      it('AuthProvider外で使用するとエラーをスローする', () => {
        // コンソールエラーを一時的に抑制
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // 実行・検証
        expect(() => {
          renderHook(() => useAuth());
        }).toThrow('useAuth must be used within an AuthProvider');

        consoleSpy.mockRestore();
      });
    });
  });
});
