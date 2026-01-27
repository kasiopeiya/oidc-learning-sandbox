/**
 * IndexPage のテスト
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import { IndexPage } from './IndexPage';

// window.locationのモック
const mockLocation = {
  href: '',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('IndexPage', () => {
  beforeEach(() => {
    mockLocation.href = '';
  });

  describe('正常系', () => {
    it('ページタイトルが表示される', () => {
      // 実行
      render(
        <BrowserRouter>
          <IndexPage />
        </BrowserRouter>
      );

      // 検証
      expect(screen.getByText('OIDC学習サンドボックス')).toBeInTheDocument();
    });

    it('説明文が表示される', () => {
      // 実行
      render(
        <BrowserRouter>
          <IndexPage />
        </BrowserRouter>
      );

      // 検証
      expect(screen.getByText('銀行口座を作成するには認証が必要です')).toBeInTheDocument();
    });

    it('口座作成ボタンが表示される', () => {
      // 実行
      render(
        <BrowserRouter>
          <IndexPage />
        </BrowserRouter>
      );

      // 検証
      expect(screen.getByRole('button', { name: '口座作成' })).toBeInTheDocument();
    });

    it('口座作成ボタンをクリックすると/api/auth/loginにリダイレクトする', () => {
      // 実行
      render(
        <BrowserRouter>
          <IndexPage />
        </BrowserRouter>
      );

      const button = screen.getByRole('button', { name: '口座作成' });
      fireEvent.click(button);

      // 検証
      expect(mockLocation.href).toBe('/api/auth/login');
    });
  });
});
