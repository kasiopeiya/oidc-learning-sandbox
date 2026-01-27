# Issue #12: React SPA化

### 背景 / 目的

フロントエンドをReact SPAに移行し、モダンなフロントエンド開発体験を実現する。
現在の3つの静的HTMLファイル（index.html、callback.html、error.html）を1つのReactアプリケーションに統合し、React Routerでルーティングを管理する。

- 依存: #11
- ラベル: frontend, cdk, docs

### スコープ / 作業項目

**Vite + React環境構築**

- Viteプロジェクトの初期化（React + TypeScript）
- 既存のfrontend/ディレクトリを再構成
- package.jsonの依存関係更新

**Tailwind CSS導入**

- Tailwind CSSのインストールと設定
- 既存のインラインCSSをTailwindクラスに移行

**React Router導入**

- react-router-domのインストール
- ルーティング設定（`/`、`/callback`、`/error`）

**コンポーネント実装**

- `App.tsx`: ルーティング設定、認証状態Context Provider
- `pages/IndexPage.tsx`: トップ画面（口座作成ボタン）
- `pages/CallbackPage.tsx`: 認証成功画面（口座番号表示）
- `pages/ErrorPage.tsx`: エラー画面

**状態管理（React Context）**

- 認証状態のContext作成
- ユーザー情報・口座情報の管理

**CDK修正（CloudFront SPA対応）**

- CloudFrontのエラーページ設定追加
- 403/404エラー時にindex.htmlへフォールバック

**バックエンド修正**

- `/api/auth/callback`のリダイレクト先を`/callback`に変更
- エラー時のリダイレクト先を`/error`に変更

**設計書更新**

- `docs/frontend-design.md`: React SPA構成、Vite、Tailwind CSS、React Routerの記載に更新
- `docs/backend-design.md`: リダイレクト先パスの変更を反映
- シーケンス図の更新（SPA遷移フローの反映）

### ゴール / 完了条件（Acceptance Criteria）

- [ ] `npm run dev`でVite開発サーバーが起動する
- [ ] `/`、`/callback`、`/error`のルーティングが機能する
- [ ] React Routerでクライアントサイドナビゲーションが動作する
- [ ] Tailwind CSSでスタイリングされている
- [ ] 認証フロー全体が正常に動作する（ログイン→コールバック→口座表示）
- [ ] エラー時に`/error?error=xxx`へ遷移しエラーメッセージが表示される
- [ ] CloudFrontで直接`/callback`にアクセスしてもSPAが正しく読み込まれる
- [ ] 既存の機能（口座作成API呼び出し等）が維持されている
- [ ] `docs/frontend-design.md`がReact SPA構成に更新されている
- [ ] `docs/backend-design.md`のリダイレクト先が更新されている
- [ ] シーケンス図がSPA遷移フローを反映している

### テスト観点

- 検証方法:
  - ローカル開発サーバーで全画面遷移を確認
  - デプロイ後、CloudFront経由で各パスに直接アクセスできることを確認
  - ブラウザリロード時にSPAが正しく復元されることを確認
  - OIDCフロー全体の動作確認

### ディレクトリ構成（変更後）

```
frontend/
├── index.html              # Viteエントリポイント
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── package.json
├── src/
│   ├── main.tsx            # Reactエントリポイント
│   ├── App.tsx             # ルーティング設定
│   ├── index.css           # Tailwind directives
│   ├── contexts/
│   │   └── AuthContext.tsx # 認証状態Context
│   ├── pages/
│   │   ├── IndexPage.tsx
│   │   ├── CallbackPage.tsx
│   │   └── ErrorPage.tsx
│   └── utils/
│       └── api.ts          # API呼び出しユーティリティ
└── public/                 # 静的ファイル（faviconなど）
```

### 対象ファイル

| 操作 | ファイル                                |
| ---- | --------------------------------------- |
| 削除 | `frontend/public/index.html`            |
| 削除 | `frontend/public/callback.html`         |
| 削除 | `frontend/public/error.html`            |
| 削除 | `frontend/src/app.ts`                   |
| 新規 | `frontend/index.html`                   |
| 新規 | `frontend/vite.config.ts`               |
| 新規 | `frontend/tailwind.config.js`           |
| 新規 | `frontend/postcss.config.js`            |
| 新規 | `frontend/src/main.tsx`                 |
| 新規 | `frontend/src/App.tsx`                  |
| 新規 | `frontend/src/index.css`                |
| 新規 | `frontend/src/contexts/AuthContext.tsx` |
| 新規 | `frontend/src/pages/IndexPage.tsx`      |
| 新規 | `frontend/src/pages/CallbackPage.tsx`   |
| 新規 | `frontend/src/pages/ErrorPage.tsx`      |
| 新規 | `frontend/src/utils/api.ts`             |
| 修正 | `frontend/package.json`                 |
| 修正 | `frontend/tsconfig.json`                |
| 修正 | `cdk/lib/oidc-sandbox-stack.ts`         |
| 修正 | `backend/src/handlers/callback.ts`      |
| 修正 | `docs/frontend-design.md`               |
| 修正 | `docs/backend-design.md`                |
