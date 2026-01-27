/**
 * CallbackPage のテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

import { CallbackPage } from './CallbackPage'
import { AuthProvider } from '../contexts/AuthContext'
import * as api from '../utils/api'

// createAccountのモック
vi.mock('../utils/api', async () => {
  const actual = await vi.importActual<typeof api>('../utils/api')
  return {
    ...actual,
    createAccount: vi.fn()
  }
})

// テスト用のラッパーコンポーネント
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <AuthProvider>{children}</AuthProvider>
    </BrowserRouter>
  )
}

describe('CallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('正常系', () => {
    it('認証成功の見出しが表示される', async () => {
      // モック設定
      vi.mocked(api.createAccount).mockResolvedValue({
        accountNumber: '1234567890',
        email: 'test@example.com',
        sub: 'user-sub-123'
      })

      // 実行
      render(
        <TestWrapper>
          <CallbackPage />
        </TestWrapper>
      )

      // 検証
      expect(screen.getByText('認証成功')).toBeInTheDocument()
    })

    it('API呼び出し中はローディング表示される', async () => {
      // モック設定: 遅延するPromise
      vi.mocked(api.createAccount).mockImplementation(
        () => new Promise(() => {}) // 解決しないPromise
      )

      // 実行
      render(
        <TestWrapper>
          <CallbackPage />
        </TestWrapper>
      )

      // 検証
      expect(screen.getByText('口座を作成中...')).toBeInTheDocument()
      expect(screen.getAllByText('読み込み中...')).toHaveLength(2) // email, sub
    })

    it('API成功時にユーザー情報と口座番号が表示される', async () => {
      // モック設定
      vi.mocked(api.createAccount).mockResolvedValue({
        accountNumber: '1234567890',
        email: 'test@example.com',
        sub: 'user-sub-123'
      })

      // 実行
      render(
        <TestWrapper>
          <CallbackPage />
        </TestWrapper>
      )

      // 検証
      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument()
      })
      expect(screen.getByText('user-sub-123')).toBeInTheDocument()
      expect(screen.getByText('1234567890')).toBeInTheDocument()
    })

    it('トップへ戻るリンクが表示される', () => {
      // モック設定
      vi.mocked(api.createAccount).mockResolvedValue({
        accountNumber: '1234567890',
        email: 'test@example.com',
        sub: 'user-sub-123'
      })

      // 実行
      render(
        <TestWrapper>
          <CallbackPage />
        </TestWrapper>
      )

      // 検証
      expect(screen.getByText('→ トップへ戻る')).toBeInTheDocument()
    })
  })

  describe('異常系', () => {
    it('APIがエラーレスポンスを返した場合はエラーメッセージが表示される', async () => {
      // モック設定
      vi.mocked(api.createAccount).mockResolvedValue({
        error: '認証が必要です',
        code: 'missing_session'
      })

      // 実行
      render(
        <TestWrapper>
          <CallbackPage />
        </TestWrapper>
      )

      // 検証
      await waitFor(() => {
        expect(screen.getByText('認証が必要です')).toBeInTheDocument()
      })
    })

    it('API呼び出しが例外をスローした場合はエラーメッセージが表示される', async () => {
      // モック設定
      vi.mocked(api.createAccount).mockRejectedValue(new Error('Network error'))

      // 実行
      render(
        <TestWrapper>
          <CallbackPage />
        </TestWrapper>
      )

      // 検証
      await waitFor(() => {
        expect(
          screen.getByText('口座作成に失敗しました。もう一度お試しください。')
        ).toBeInTheDocument()
      })
    })

    it('エラー時はメールアドレスとユーザーIDに「(取得失敗)」が表示される', async () => {
      // モック設定
      vi.mocked(api.createAccount).mockRejectedValue(new Error('Network error'))

      // 実行
      render(
        <TestWrapper>
          <CallbackPage />
        </TestWrapper>
      )

      // 検証
      await waitFor(() => {
        expect(screen.getAllByText('(取得失敗)')).toHaveLength(2)
      })
    })

    it('エラー時は口座番号が表示されない', async () => {
      // モック設定
      vi.mocked(api.createAccount).mockRejectedValue(new Error('Network error'))

      // 実行
      render(
        <TestWrapper>
          <CallbackPage />
        </TestWrapper>
      )

      // 検証
      await waitFor(() => {
        expect(
          screen.getByText('口座作成に失敗しました。もう一度お試しください。')
        ).toBeInTheDocument()
      })
      expect(screen.queryByText(/^\d{10}$/)).not.toBeInTheDocument()
    })
  })
})
