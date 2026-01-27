# 実装計画

## フェーズ構成

| フェーズ              | 目的                                                                       | 含むIssue |
| --------------------- | -------------------------------------------------------------------------- | --------- |
| Phase 1: インフラ基盤 | CDKプロジェクトとCognitoを構築し、OPとしての認証基盤を確立する             | #1, #2    |
| Phase 2: 配信基盤     | S3 + CloudFrontでHTTPS配信環境を構築し、フロントエンドをデプロイ可能にする | #3, #4    |
| Phase 3: API基盤      | API Gateway + Lambdaを構築し、バックエンドAPIの土台を作る                  | #5, #6    |
| Phase 4: OIDC認証実装 | 認可コードフロー（State/Nonce/PKCE）を実装し、RPとしての機能を完成させる   | #7, #8    |
| Phase 5: 結合・完成   | フロントエンドと連携し、E2Eで動作確認を行う                                | #9        |

---

## 依存関係マップ

```
#1 CDKプロジェクト初期化
 │
 ├──▶ #2 Cognito構築
 │     │
 │     └──▶ #7 認可リクエスト実装 ──▶ #8 コールバック実装 ──▶ #9 結合テスト
 │                                          ▲
 ├──▶ #3 S3 + CloudFront構築                │
 │     │                                    │
 │     └──▶ #4 フロントエンド実装 ───────────┘
 │
 └──▶ #5 API Gateway構築
       │
       └──▶ #6 Lambda関数の雛形作成
             │
             └──▶ #7 認可リクエスト実装
```

**依存関係一覧:**

- #2 → #1
- #3 → #1
- #4 → #3
- #5 → #1
- #6 → #5
- #7 → #2, #6
- #8 → #7
- #9 → #4, #8

---

## Issueアウトライン表

### Issue #1: CDKプロジェクト初期化

**概要**: CDKプロジェクトの雛形を作成し、parameter.tsで環境設定を一元管理できるようにする。
**依存**: -
**ラベル**: infra
**受け入れ基準（AC）**:

- [ ] `cdk/` ディレクトリにCDKプロジェクトが作成されている
- [ ] `cdk/parameter.ts` で envName, projectName, region が定義されている
- [ ] `cdk/bin/app.ts` でスタックがインスタンス化されている
- [ ] `cdk/lib/oidc-sandbox-stack.ts` に空のスタッククラスが存在する
- [ ] `cdk/deploy.sh` が作成され、フロントエンドビルド→CDKデプロイを実行できる
- [ ] `npx cdk synth` が正常に実行できる

---

### Issue #2: Cognito User Pool構築

**概要**: OIDCのOP（OpenID Provider）として機能するCognito User PoolとApp Clientを構築する。
**依存**: #1
**ラベル**: infra
**受け入れ基準（AC）**:

- [ ] User Pool が作成され、emailでサインイン可能な設定になっている
- [ ] App Client が Confidential Client として作成されている
- [ ] PKCE（S256）が有効になっている
- [ ] OAuth スコープに openid, email, profile が設定されている
- [ ] Cognito Domain が設定されている
- [ ] `npx cdk deploy` でリソースが作成される

---

### Issue #3: S3 + CloudFront構築

**概要**: フロントエンドの静的ファイルをHTTPSで配信するためのS3バケットとCloudFrontディストリビューションを構築する。
**依存**: #1
**ラベル**: infra
**受け入れ基準（AC）**:

- [ ] S3バケットが非公開設定で作成されている
- [ ] CloudFront ディストリビューションが作成されている
- [ ] OAC（Origin Access Control）でS3にアクセスできる
- [ ] デフォルトルートオブジェクトが `index.html` に設定されている
- [ ] HTTPからHTTPSへのリダイレクトが有効になっている
- [ ] CloudFront URLがCDK出力に表示される

---

### Issue #4: フロントエンド実装

**概要**: トップ画面（口座作成ボタン）、認証成功画面、エラー画面の3画面を実装する。
**依存**: #3
**ラベル**: frontend
**受け入れ基準（AC）**:

- [ ] `frontend/` ディレクトリ構成が設計書通りに作成されている
- [ ] `index.html` に「口座作成」ボタンが表示される
- [ ] `callback.html` でクエリパラメータからユーザー情報を表示できる
- [ ] `error.html` でエラーコードに応じたメッセージを表示できる
- [ ] `npm run build` で `dist/` にビルド成果物が生成される
- [ ] CDKデプロイでS3にアップロードされ、CloudFront経由で表示できる

---

### Issue #5: API Gateway (HTTP API) 構築

**概要**: バックエンドAPIのエントリーポイントとなるHTTP APIを構築し、CloudFrontの `/api/*` パスから転送されるようにする。
**依存**: #1
**ラベル**: infra
**受け入れ基準（AC）**:

- [ ] HTTP API が作成されている
- [ ] CloudFront の `/api/*` パスが API Gateway に転送される
- [ ] API Gateway のエンドポイントURLがCDK出力に表示される
- [ ] キャッシュが無効化されている（CachingDisabled）

---

### Issue #6: Lambda関数の雛形作成

**概要**: 認証ハンドラーのLambda関数（NodejsFunction）を作成し、API Gatewayと連携させる。
**依存**: #5
**ラベル**: backend, infra
**受け入れ基準（AC）**:

- [ ] `backend/` ディレクトリ構成が設計書通りに作成されている
- [ ] NodejsFunctionでLambda関数が定義されている
- [ ] ランタイムがNode.js 24.x、アーキテクチャがarm64に設定されている
- [ ] 環境変数（COGNITO\_\*, REDIRECT_URI, FRONTEND_URL）が設定されている
- [ ] `/api/auth/login` と `/api/auth/callback` のルートが定義されている
- [ ] デプロイ後、エンドポイントにアクセスして200/302レスポンスが返る

---

### Issue #7: 認可リクエスト実装（/api/auth/login）

**概要**: State, Nonce, PKCEを生成し、Cognitoの認可エンドポイントへリダイレクトする処理を実装する。
**依存**: #2, #6
**ラベル**: backend
**受け入れ基準（AC）**:

- [ ] state, nonce, code_verifier が暗号論的に安全な方法で生成されている
- [ ] code_challenge が SHA256 + Base64URL で計算されている
- [ ] 生成した値が HttpOnly, Secure, SameSite=Lax の Cookie に保存されている
- [ ] 認可URLが正しいパラメータで構築されている（response_type, client_id, redirect_uri, scope, state, nonce, code_challenge, code_challenge_method）
- [ ] 302リダイレクトでCognitoの認可エンドポイントに遷移する
- [ ] ブラウザからアクセスしてCognitoログイン画面が表示される

---

### Issue #8: コールバック実装（/api/auth/callback）

**概要**: 認可コードを受け取り、トークン交換とIDトークン検証を行い、成功/エラー画面にリダイレクトする。
**依存**: #7
**ラベル**: backend
**受け入れ基準（AC）**:

- [ ] openid-client ライブラリを使用してトークン交換が実装されている
- [ ] State検証が実行されている（Cookie vs URLパラメータ）
- [ ] PKCE検証が実行されている（code_verifier送信）
- [ ] IDトークンの署名検証、Nonce検証、有効期限検証が実行されている
- [ ] 成功時: `/callback.html?email=xxx&sub=xxx` にリダイレクトされる
- [ ] エラー時: `/error.html?error=エラーコード` にリダイレクトされる
- [ ] 検証用Cookieが削除されている

---

### Issue #9: E2E動作確認・ドキュメント整備

**概要**: フロントエンドとバックエンドを結合し、認証フロー全体の動作確認を行う。READMEを整備する。
**依存**: #4, #8
**ラベル**: docs, test
**受け入れ基準（AC）**:

- [ ] トップ画面から「口座作成」ボタンをクリックしてCognitoログイン画面に遷移する
- [ ] 新規ユーザー登録が完了する
- [ ] ログイン後、認証成功画面にメールアドレスとユーザーIDが表示される
- [ ] ログインキャンセル時、エラー画面に適切なメッセージが表示される
- [ ] README.md にセットアップ手順とデプロイ手順が記載されている

---

## 決定事項

| 項目                     | 決定内容                                        |
| ------------------------ | ----------------------------------------------- |
| コールバックURL          | CDKのトークン参照で自動解決（単一スタック維持） |
| クライアントシークレット | 環境変数で管理（学習用途のため簡略化）          |
| Node.jsランタイム        | 24.x を使用                                     |
| フロントエンドビルド     | `cdk/deploy.sh` でビルド→デプロイを統合         |
