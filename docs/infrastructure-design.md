# インフラ設計書

## 1. 概要

本ドキュメントは、OIDC学習サンドボックスのインフラ構成を定義します。

### 1.1 基本情報

| 項目 | 値 |
|------|-----|
| プロジェクト名 | OIDC学習サンドボックス |
| 環境 | 開発環境（dev）のみ |
| リージョン | 東京（ap-northeast-1） |
| IaCツール | AWS CDK（TypeScript） |
| スタック名 | oidc-sandbox-app |

### 1.2 設計方針

- **シンプルさ優先**: 学習用途のため、最小限の構成とする
- **コスト最小化**: 無料枠を活用し、料金を抑える
- **CDKベストプラクティス準拠**: リソース名は自動生成に任せる

---

## 2. システム全体構成図

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud (ap-northeast-1)                       │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         oidc-sandbox-app スタック                        │ │
│  │                                                                          │ │
│  │                                              ┌─────────────┐             │ │
│  │                                              │             │             │ │
│  │                        /*  ─────────────────▶│     S3      │             │ │
│  │    ┌─────────────┐                           │  (静的資産)  │             │ │
│  │    │             │                           └─────────────┘             │ │
│  │    │  CloudFront │                                                       │ │
│  │    │             │                           ┌─────────────┐             │ │
│  │    └──────┬──────┘     /api/* ──────────────▶│     API     │             │ │
│  │           │                                  │   Gateway   │             │ │
│  │           │                                  └──────┬──────┘             │ │
│  │           │ xxxxx.cloudfront.net                    │                    │ │
│  │           │                                   ┌─────▼─────┐              │ │
│  │           │                                   │           │              │ │
│  │           │                                   │  Lambda   │              │ │
│  │           │                                   │           │              │ │
│  │           │                                   └─────┬─────┘              │ │
│  │           │                                         │                    │ │
│  │           │                                         │ トークン交換       │ │
│  │           │                                         ▼                    │ │
│  │           │                                   ┌───────────┐              │ │
│  │           │                                   │  Cognito  │              │ │
│  │           │                                   │ User Pool │              │ │
│  │           │                                   └───────────┘              │ │
│  │                                                                          │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘

    ┌─────────┐
    │         │
    │ ブラウザ │  ユーザー（学習者）
    │         │
    └─────────┘
```

### 2.1 CloudFront のルーティング

| パスパターン | 転送先 | 説明 |
|-------------|--------|------|
| `/api/*` | API Gateway | バックエンド API |
| `/*`（デフォルト） | S3 | 静的ファイル（HTML/JS/CSS） |

### 2.2 リクエストフロー

```
ユーザー
   │
   │ 1. https://xxxxx.cloudfront.net にアクセス
   ▼
CloudFront
   │
   │ 2. パスが /* なので S3 に転送
   ▼
S3 バケット
   │
   │ 3. 静的ファイル（HTML/JS/CSS）を返す
   ▼
ブラウザ（フロントエンド）
   │
   │ 4. 「口座作成」ボタンをクリック
   │    → /api/auth/login を呼び出し
   ▼
CloudFront
   │
   │ 5. パスが /api/* なので API Gateway に転送
   ▼
API Gateway → Lambda
   │
   │ 6. 認可リクエストURLを生成して返す
   ▼
ブラウザ
   │
   │ 7. Cognito の認可エンドポイントにリダイレクト
   ▼
Cognito (OP)
   │
   │ 8. ログイン画面を表示
   │ 9. 認証成功後、認可コード付きでコールバックURLにリダイレクト
   ▼
ブラウザ → CloudFront → API Gateway → Lambda
   │
   │ 10. 認可コードをトークンに交換
   │ 11. ID トークンを検証
   │ 12. ユーザー情報を返す
   ▼
ブラウザ
   │
   │ 13. 「認証成功しました」+ ユーザー情報を表示
   ▼
完了
```

---

## 3. AWSリソース詳細

### 3.1 Amazon Cognito

OIDCのOP（OpenID Provider）として機能します。

#### 3.1.1 Cognito とは？

Cognito は AWS が提供する認証サービスです。今回は以下の役割を担います：

- ユーザーの登録・ログイン機能の提供
- OIDC の認可エンドポイント、トークンエンドポイントの提供
- ID トークン、アクセストークンの発行

#### 3.1.2 User Pool 設定

| 設定項目 | 値 | 説明 |
|----------|-----|------|
| サインイン属性 | email | メールアドレスでログイン |
| パスワードポリシー | デフォルト（8文字以上、大文字小文字数字記号） | Cognito のデフォルト設定を使用 |
| MFA | なし | 学習用途のため簡略化 |
| メール検証 | あり | Cognito デフォルトのメール送信を使用 |
| セルフサインアップ | 許可 | ユーザー自身でアカウント作成可能 |

#### 3.1.3 App Client 設定

| 設定項目 | 値 | 説明 |
|----------|-----|------|
| クライアントタイプ | Confidential Client | クライアントシークレットあり |
| 認証フロー | 認可コードフロー | OIDC標準のフロー |
| コールバックURL | https://xxxxx.cloudfront.net/callback | 認証後のリダイレクト先 |
| サインアウトURL | https://xxxxx.cloudfront.net | ログアウト後のリダイレクト先 |
| OAuth スコープ | openid, email, profile | 基本的なユーザー情報を取得 |
| PKCE | 有効（S256） | セキュリティ強化のため必須 |

#### 3.1.4 Cognito ドメイン

Cognito が提供するホスト UI 用のドメインを使用します。

```
https://<prefix>.auth.ap-northeast-1.amazoncognito.com
```

- `<prefix>` は CDK でユニークな値を自動生成

---

### 3.2 Amazon S3

フロントエンドの静的ファイルをホスティングします。

#### 3.2.1 バケット設定

| 設定項目 | 値 | 説明 |
|----------|-----|------|
| バケット名 | CDK 自動生成 | ユニークな名前が自動付与される |
| パブリックアクセス | ブロック（全て） | CloudFront 経由でのみアクセス可能 |
| バージョニング | 無効 | 学習用途のため不要 |
| 暗号化 | SSE-S3（デフォルト） | S3 マネージドキーで暗号化 |
| 削除ポリシー | DESTROY | スタック削除時にバケットも削除 |

#### 3.2.2 配置するファイル

```
bucket/
├── index.html          # トップページ
├── callback.html       # コールバックページ
├── js/
│   └── app.js          # フロントエンドロジック
└── css/
    └── style.css       # スタイルシート
```

---

### 3.3 Amazon CloudFront

S3 と API Gateway の前段に配置し、単一ドメインで HTTPS コンテンツを配信します。

#### 3.3.1 CloudFront を使う理由

| 理由 | 説明 |
|------|------|
| HTTPS 対応 | OIDCではコールバックURLにHTTPSが必要 |
| 単一ドメイン | フロントエンドと API を同一ドメインで提供（CORS 設定が不要） |
| キャッシュ | 静的ファイルの配信を高速化 |
| セキュリティ | S3 への直接アクセスを防ぐ |

#### 3.3.2 ディストリビューション設定

| 設定項目 | 値 | 説明 |
|----------|-----|------|
| ドメイン | デフォルト（xxxxx.cloudfront.net） | 独自ドメインは使用しない |
| プロトコル | HTTPS のみ | HTTP は HTTPS にリダイレクト |
| デフォルトルートオブジェクト | index.html | ルートアクセス時に返すファイル |
| 価格クラス | PriceClass.PRICE_CLASS_100 | 北米・欧州のみ（コスト削減） |

#### 3.3.3 オリジン設定

| オリジン | 転送先 | 説明 |
|----------|--------|------|
| S3 オリジン | S3 バケット（OAC 経由） | 静的ファイル配信用 |
| API オリジン | API Gateway | バックエンド API 用 |

#### 3.3.4 ビヘイビア（振り分けルール）

| 優先度 | パスパターン | オリジン | キャッシュポリシー |
|--------|-------------|----------|-------------------|
| 1 | `/api/*` | API Gateway | CachingDisabled（キャッシュなし） |
| 2（デフォルト） | `*` | S3 | CachingOptimized |

#### 3.3.5 OAC（Origin Access Control）とは？

CloudFront から S3 にアクセスするための仕組みです。

```
ユーザー → CloudFront → (OAC認証) → S3
                ↑
        署名付きリクエストで
        S3 にアクセス
```

これにより、S3 バケットを非公開のまま CloudFront 経由でのみアクセス可能にします。

---

### 3.4 Amazon API Gateway

バックエンド API のエントリーポイントです。

#### 3.4.1 API タイプ

**HTTP API** を使用します（REST API ではない）。

| 比較項目 | HTTP API | REST API |
|----------|----------|----------|
| 料金 | 安い（約70%オフ） | 高い |
| 機能 | 基本的な機能のみ | 豊富（API キーなど） |
| レイテンシ | 低い | 普通 |
| 今回の用途 | ✅ 十分 | オーバースペック |

#### 3.4.2 エンドポイント一覧

| パス | メソッド | 説明 | Lambda 関数 |
|------|----------|------|-------------|
| /api/auth/login | GET | 認可リクエストURL生成 | auth-handler |
| /api/auth/callback | GET | コールバック処理（トークン交換） | auth-handler |

#### 3.4.3 CORS 設定

CloudFront 経由で同一ドメインからのアクセスとなるため、**CORS 設定は不要**です。

---

### 3.5 AWS Lambda

OIDC の RP（Relying Party）ロジックを実行します。

#### 3.5.1 CDK Construct

**NodejsFunction** を使用します。

```typescript
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
```

| 比較項目 | NodejsFunction | 通常の Function |
|----------|----------------|-----------------|
| TypeScript サポート | ✅ 自動でトランスパイル | 手動でビルドが必要 |
| バンドル | ✅ esbuild で自動バンドル | 手動で設定が必要 |
| tree-shaking | ✅ 自動で不要コード削除 | なし |
| 設定の簡潔さ | ✅ シンプル | 複雑 |

TypeScript を直接指定でき、ビルド設定が不要なため採用します。

#### 3.5.2 関数設定

| 設定項目 | 値 | 説明 |
|----------|-----|------|
| 関数名 | CDK 自動生成 | スタック名がプレフィックスになる |
| ランタイム | Node.js 24.x | 最新の LTS バージョン |
| メモリ | 256 MB | 認証処理には十分 |
| タイムアウト | 10 秒 | トークン交換に余裕を持たせる |
| アーキテクチャ | arm64 | コスト効率が良い |

#### 3.5.3 環境変数

| 変数名 | 値 | 説明 |
|--------|-----|------|
| COGNITO_USER_POOL_ID | User Pool ID | Cognito User Pool の識別子 |
| COGNITO_CLIENT_ID | App Client ID | アプリクライアントの識別子 |
| COGNITO_CLIENT_SECRET | App Client Secret | クライアントシークレット（Secrets Manager 推奨） |
| COGNITO_DOMAIN | Cognito ドメイン | 認可エンドポイントのベースURL |
| REDIRECT_URI | コールバックURL | 認証後のリダイレクト先 |
| FRONTEND_URL | CloudFront URL | フロントエンドのURL |

#### 3.5.4 IAM ロール権限

| 権限 | 用途 |
|------|------|
| AWSLambdaBasicExecutionRole | CloudWatch Logs への書き込み |
| （Secrets Manager 使用時）secretsmanager:GetSecretValue | シークレットの取得 |

#### 3.5.5 コールドスタートについて

Lambda は一定時間使用されないとインスタンスが停止し、次回リクエスト時に再起動が必要になります。この起動時間を**コールドスタート**と呼び、ユーザー体験に影響を与える場合があります。

**本番環境での対策例：**

| 対策 | 説明 | コスト |
|------|------|--------|
| Provisioned Concurrency | 事前にインスタンスを起動しておく | 高い（常時課金） |
| 定期的なウォームアップ | EventBridge で定期的に Lambda を呼び出す | 低い |
| 依存関係の最小化 | node_modules を軽くして起動を速くする | なし |

**今回の対応：**

学習用途で利用頻度が低く、数秒の遅延は許容できるため、コールドスタート対策は行いません。

---

## 4. スタック構成

### 4.1 スタック分割ポリシー

本番環境では、以下の理由から Stateful リソースと Stateless リソースでスタックを分割することが推奨されます。

| リソース種別 | 例 | 特徴 |
|-------------|-----|------|
| Stateful | DB、S3、Cognito User Pool | データを保持する。誤削除すると復旧が困難 |
| Stateless | Lambda、API Gateway、CloudFront | データを保持しない。再作成が容易 |

**スタック分割のメリット：**
- Stateless リソースのみ頻繁に更新できる
- Stateful リソースの誤削除リスクを軽減できる

### 4.2 今回の構成

**単一スタック構成**とします。

```
oidc-sandbox-app (Stack)
├── Cognito User Pool        ← Stateful
├── Cognito User Pool Client
├── Cognito Domain
├── S3 Bucket                ← Stateful
├── CloudFront Distribution  ← Stateless
├── API Gateway (HTTP API)   ← Stateless
└── Lambda Function          ← Stateless
```

**単一スタックを採用する理由：**

- 検証用プロジェクトのため、構築と削除のしやすさを優先する
- `cdk deploy` / `cdk destroy` のワンコマンドで環境を作成・削除できる
- スタック間の依存関係（クロススタック参照）を考慮する必要がない

### 4.3 パラメータ管理（parameter.ts）

環境別の設定値は `cdk/parameter.ts` で一元管理します。

```typescript
// parameter.ts の構成イメージ
export interface AppParameter {
  envName: string;          // 環境名（dev）
  projectName: string;      // プロジェクト名
  region: string;           // リージョン
}

export const devParameter: AppParameter = {
  envName: "dev",
  projectName: "oidc-sandbox",
  region: "ap-northeast-1",
};
```

**parameter.ts を使う理由：**

- 環境固有の値をコードから分離できる
- 将来的に複数環境（dev / prod）を追加しやすい
- スタック定義がシンプルになる

---

## 5. ディレクトリ構成・デプロイコマンド

[project-structure.md](./project-structure.md) を参照してください。

---

## 6. コスト見積もり

### 6.1 AWS 無料枠

| サービス | 無料枠 | 今回の使用量 |
|----------|--------|--------------|
| Cognito | 50,000 MAU | 1〜3人 ✅ |
| Lambda | 100万リクエスト/月 | 数百リクエスト ✅ |
| API Gateway | 100万リクエスト/月（12ヶ月） | 数百リクエスト ✅ |
| S3 | 5GB ストレージ | 数MB ✅ |
| CloudFront | 1TB 転送/月 | 数MB ✅ |

### 6.2 想定月額コスト

**ほぼ $0**（無料枠内で収まる見込み）

※ 注意: CloudFront は無料枠を超えると課金されますが、学習用途の少量アクセスであれば問題ありません。

---

## 7. セキュリティ考慮事項

### 7.1 実装済みのセキュリティ対策

| 対策 | 説明 |
|------|------|
| HTTPS 強制 | CloudFront で HTTP → HTTPS リダイレクト |
| S3 非公開 | OAC 経由でのみアクセス可能 |
| PKCE | 認可コード横取り攻撃を防止 |
| State パラメータ | CSRF 攻撃を防止 |
| Nonce パラメータ | リプレイ攻撃を防止 |

### 7.2 学習用途のため簡略化した項目

| 項目 | 本番環境での推奨 | 今回の対応 |
|------|------------------|------------|
| WAF | 有効化 | なし（コスト削減） |
| クライアントシークレット管理 | Secrets Manager | 環境変数（簡略化） |
| ログ監視 | CloudWatch Alarms | なし |

---

## 8. テスト方針

### 8.1 CDK スナップショットテストについて

CDK では**スナップショットテスト**が一般的に推奨されます。

**スナップショットテストとは：**

生成される CloudFormation テンプレートを保存し、次回以降の変更時に差分を検出するテスト手法です。意図しないインフラ変更を防ぐことができます。

```typescript
// スナップショットテストの例
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { OidcSandboxStack } from '../lib/oidc-sandbox-stack';

test('Snapshot test', () => {
  const app = new cdk.App();
  const stack = new OidcSandboxStack(app, 'TestStack');
  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});
```

### 8.2 今回の対応

**スナップショットテストは実施しません。**

| 観点 | 理由 |
|------|------|
| 規模 | 小規模な学習用プロジェクト |
| 変更頻度 | 頻繁な変更は想定しない |
| 運用 | 個人利用のため、意図しない変更のリスクが低い |
| 目的 | OIDC の学習が主目的であり、CDK のテストは範囲外 |

**本番環境では必須：**

本番環境やチーム開発では、スナップショットテストを導入し、インフラ変更のレビュープロセスに組み込むことを強く推奨します。
