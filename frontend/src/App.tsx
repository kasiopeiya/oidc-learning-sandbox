// 1. サードパーティライブラリ
import { Routes, Route } from 'react-router-dom';

// 2. 自作モジュール
import { AuthProvider } from './contexts/AuthContext';
import { IndexPage } from './pages/IndexPage';
import { CallbackPage } from './pages/CallbackPage';
import { ErrorPage } from './pages/ErrorPage';

/**
 * アプリケーションのルートコンポーネント
 *
 * React Routerでルーティングを設定し、
 * AuthProviderで認証状態を全体に提供します。
 *
 * ルーティング:
 * - `/`: トップ画面（口座作成ボタン）
 * - `/callback`: 認証成功画面（口座番号表示）
 * - `/error`: エラー画面
 */
export function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* トップ画面 */}
        <Route path="/" element={<IndexPage />} />

        {/* 認証成功画面（コールバック） */}
        <Route path="/callback" element={<CallbackPage />} />

        {/* エラー画面 */}
        <Route path="/error" element={<ErrorPage />} />
      </Routes>
    </AuthProvider>
  );
}
