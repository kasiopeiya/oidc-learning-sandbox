/**
 * ErrorPage のテスト
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { ErrorPage } from './ErrorPage'
import { ERROR_MESSAGES, DEFAULT_ERROR_MESSAGE } from '../utils/api'

// URLSearchParamsをシミュレートするためMemoryRouterを使用
function renderWithRouter(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ErrorPage />
    </MemoryRouter>
  )
}

describe('ErrorPage', () => {
  describe('正常系', () => {
    it('エラーの見出しが表示される', () => {
      // 実行
      renderWithRouter(['/error?error=access_denied'])

      // 検証
      expect(screen.getByText('エラー')).toBeInTheDocument()
    })

    it('access_deniedエラーの場合、対応するメッセージが表示される', () => {
      // 実行
      renderWithRouter(['/error?error=access_denied'])

      // 検証
      expect(screen.getByText(ERROR_MESSAGES.access_denied)).toBeInTheDocument()
      expect(screen.getByText('エラーコード: access_denied')).toBeInTheDocument()
    })

    it('missing_sessionエラーの場合、対応するメッセージが表示される', () => {
      // 実行
      renderWithRouter(['/error?error=missing_session'])

      // 検証
      expect(screen.getByText(ERROR_MESSAGES.missing_session)).toBeInTheDocument()
    })

    it('state_mismatchエラーの場合、対応するメッセージが表示される', () => {
      // 実行
      renderWithRouter(['/error?error=state_mismatch'])

      // 検証
      expect(screen.getByText(ERROR_MESSAGES.state_mismatch)).toBeInTheDocument()
    })

    it('nonce_mismatchエラーの場合、対応するメッセージが表示される', () => {
      // 実行
      renderWithRouter(['/error?error=nonce_mismatch'])

      // 検証
      expect(screen.getByText(ERROR_MESSAGES.nonce_mismatch)).toBeInTheDocument()
    })

    it('missing_codeエラーの場合、対応するメッセージが表示される', () => {
      // 実行
      renderWithRouter(['/error?error=missing_code'])

      // 検証
      expect(screen.getByText(ERROR_MESSAGES.missing_code)).toBeInTheDocument()
    })

    it('op_errorエラーの場合、対応するメッセージが表示される', () => {
      // 実行
      renderWithRouter(['/error?error=op_error'])

      // 検証
      expect(screen.getByText(ERROR_MESSAGES.op_error)).toBeInTheDocument()
    })

    it('invalid_signatureエラーの場合、対応するメッセージが表示される', () => {
      // 実行
      renderWithRouter(['/error?error=invalid_signature'])

      // 検証
      expect(screen.getByText(ERROR_MESSAGES.invalid_signature)).toBeInTheDocument()
    })

    it('token_expiredエラーの場合、対応するメッセージが表示される', () => {
      // 実行
      renderWithRouter(['/error?error=token_expired'])

      // 検証
      expect(screen.getByText(ERROR_MESSAGES.token_expired)).toBeInTheDocument()
    })

    it('network_errorエラーの場合、対応するメッセージが表示される', () => {
      // 実行
      renderWithRouter(['/error?error=network_error'])

      // 検証
      expect(screen.getByText(ERROR_MESSAGES.network_error)).toBeInTheDocument()
    })

    it('トップへ戻るリンクが表示される', () => {
      // 実行
      renderWithRouter(['/error?error=access_denied'])

      // 検証
      expect(screen.getByText('→ トップへ戻る')).toBeInTheDocument()
    })

    it('トップへ戻るリンクが/を指している', () => {
      // 実行
      renderWithRouter(['/error?error=access_denied'])

      // 検証
      const link = screen.getByText('→ トップへ戻る')
      expect(link).toHaveAttribute('href', '/')
    })
  })

  describe('異常系', () => {
    it('エラーパラメータがない場合はデフォルトメッセージが表示される', () => {
      // 実行
      renderWithRouter(['/error'])

      // 検証
      expect(screen.getByText(DEFAULT_ERROR_MESSAGE)).toBeInTheDocument()
      // エラーコード表示はない
      expect(screen.queryByText(/エラーコード:/)).not.toBeInTheDocument()
    })

    it('空のエラーパラメータの場合はデフォルトメッセージが表示される', () => {
      // 実行
      renderWithRouter(['/error?error='])

      // 検証
      expect(screen.getByText(DEFAULT_ERROR_MESSAGE)).toBeInTheDocument()
    })

    it('未知のエラーコードの場合はデフォルトメッセージが表示される', () => {
      // 実行
      renderWithRouter(['/error?error=unknown_error_code'])

      // 検証
      expect(screen.getByText(DEFAULT_ERROR_MESSAGE)).toBeInTheDocument()
      expect(screen.getByText('エラーコード: unknown_error_code')).toBeInTheDocument()
    })

    it('特殊文字を含むエラーコードでもデフォルトメッセージが表示される', () => {
      // 実行
      renderWithRouter(['/error?error=<script>alert("xss")</script>'])

      // 検証
      expect(screen.getByText(DEFAULT_ERROR_MESSAGE)).toBeInTheDocument()
    })
  })
})
