// 1. サードパーティライブラリ
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// 2. 自作モジュール
import { App } from './App';
import './index.css';

/**
 * Reactアプリケーションのエントリポイント
 *
 * BrowserRouterでReact Routerを有効化し、
 * SPAとしてクライアントサイドルーティングを実現します。
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
