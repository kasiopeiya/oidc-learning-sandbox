/**
 * App のテスト
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { App } from './App'
import * as api from './utils/api'

// createAccountのモック
vi.mock('./utils/api', async () => {
  const actual = await vi.importActual<typeof api>('./utils/api')
  return {
    ...actual,
    createAccount: vi.fn().mockResolvedValue({
      accountNumber: '1234567890',
      email: 'test@example.com',
      sub: 'user-sub-123'
    })
  }
})

// ルーティングテスト用のラッパー
function renderWithRouter(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>
  )
}

describe('App', () => {
  describe('正常系', () => {
    describe('ルーティング', () => {
      it('/でIndexPageがレンダリングされる', () => {
        // 実行
        renderWithRouter(['/'])

        // 検証
        expect(screen.getByText('OIDC学習サンドボックス')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '口座作成' })).toBeInTheDocument()
      })

      it('/callbackでCallbackPageがレンダリングされる', () => {
        // 実行
        renderWithRouter(['/callback'])

        // 検証
        expect(screen.getByText('認証成功')).toBeInTheDocument()
      })

      it('/errorでErrorPageがレンダリングされる', () => {
        // 実行
        renderWithRouter(['/error?error=access_denied'])

        // 検証
        expect(screen.getByText('エラー')).toBeInTheDocument()
      })
    })

    describe('AuthProvider', () => {
      it('AuthProviderがアプリケーション全体にコンテキストを提供している', () => {
        // 実行
        renderWithRouter(['/callback'])

        // 検証: CallbackPageがuseAuthを使用できる（エラーにならない）
        expect(screen.getByText('認証成功')).toBeInTheDocument()
      })
    })
  })

  describe('異常系', () => {
    describe('ルーティング', () => {
      it('存在しないルートではコンテンツが表示されない', () => {
        // 実行
        renderWithRouter(['/non-existent-route'])

        // 検証: IndexPage, CallbackPage, ErrorPageのいずれもレンダリングされない
        expect(screen.queryByText('OIDC学習サンドボックス')).not.toBeInTheDocument()
        expect(screen.queryByText('認証成功')).not.toBeInTheDocument()
        expect(screen.queryByText('エラー')).not.toBeInTheDocument()
      })
    })
  })
})
