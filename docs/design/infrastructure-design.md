# インフラ設計書

## この設計書に書くべきこと

この設計書は、**IaC（Infrastructure as Code）との共存**を前提としています。CDK コードが実装の真実（Single Source of Truth）であり、この設計書は以下の役割を担います：

### ✅ この設計書に書くべき内容

- **設計意図とトレードオフ**（Why）
- **アーキテクチャ全体像**（システム構成図、リクエストフロー）
- **設計判断のサマリー**（ADR へのリンクと要約）
- **セキュリティ方針**
- **コスト考慮**

### ❌ この設計書に書くべきでない内容

- **具体的な設定値**（Lambda メモリ、タイムアウト、環境変数など）
  - → CDK コード（`cdk/lib/`）を参照
- **詳細な IAM ポリシー**
  - → CDK の自動生成に任せる
- **リソース名**
  - → CDK の自動生成に任せる

**原則**: 「What/How」は CDK コードに、「Why」はこの設計書に記載する。

---

## 1. 概要

本ドキュメントは、OIDC学習サンドボックスのインフラ構成を定義します。

### 1.1 基本情報

| 項目           | 値                     |
| -------------- | ---------------------- |
| プロジェクト名 | OIDC学習サンドボックス |
| 環境           | 開発環境（dev）のみ    |
| リージョン     | 東京（ap-northeast-1） |
| IaCツール      | AWS CDK（TypeScript）  |
| スタック名     | oidc-sandbox-app       |

### 1.2 設計方針

- **シンプルさ優先**: 学習用途のため、最小限の構成とする
- **コスト最小化**: 無料枠を活用し、料金を抑える
- **CDKベストプラクティス準拠**: リソース名は自動生成に任せる

---

## 2. 設計判断サマリー

主要な設計判断は ADR（Architecture Decision Records）として記録しています。詳細は各 ADR を参照してください。

| #   | 項目             | 決定                       | 理由                                                                 | 詳細                                            |
| --- | ---------------- | -------------------------- | -------------------------------------------------------------------- | ----------------------------------------------- |
| 001 | バックエンド API | Lambda Function URLs       | シンプルさとコスト削減を優先。API Gateway の高度な機能は不要         | [ADR-001](./adr/001-lambda-function-urls.md)    |
| 002 | スタック構成     | 単一スタック               | 学習用途で構築・削除の容易さを優先。個人利用のため誤削除リスクは許容 | [ADR-002](./adr/002-single-stack.md)            |
| 003 | Lambda Construct | NodejsFunction             | TypeScript の自動トランスパイル、esbuild による最適化                | [ADR-003](./adr/003-nodejs-function.md)         |
| 004 | アクセス制御     | OAC + AWS_IAM 認証         | CloudFront 経由のみアクセス可能にし、セキュリティを強化              | [ADR-004](./adr/004-oac-iam-auth.md)            |
| 005 | コールドスタート | 対策なし                   | 学習用途で数秒の遅延は許容。コスト削減を優先                         | [ADR-005](./adr/005-no-coldstart-mitigation.md) |
| 006 | CDK テスト       | スナップショットテストなし | 小規模プロジェクトで `cdk diff` と結合テストで十分                   | [ADR-006](./adr/006-no-snapshot-tests.md)       |

---

## 3. アーキテクチャ概要

### 3.1 システム全体構成図

![](./img/aws-architecture.png)

### 3.2 主要コンポーネント

| コンポーネント      | 役割                     | 備考                          |
| ------------------- | ------------------------ | ----------------------------- |
| **Amazon Cognito**  | OIDC Provider（OP）      | ユーザー認証・トークン発行    |
| **CloudFront**      | CDN・ルーティング        | HTTPS 対応、単一ドメイン提供  |
| **S3**              | 静的ファイルホスティング | フロントエンド（HTML/JS/CSS） |
| **Lambda**          | Relying Party（RP）      | 認可フロー処理、トークン検証  |
| **DynamoDB**        | セッション管理           | State/Nonce/PKCE の保存       |
| **Secrets Manager** | シークレット管理         | Client ID/Secret の保存       |

### 3.3 CloudFront のルーティング

| パスパターン         | 転送先              | 説明                        |
| -------------------- | ------------------- | --------------------------- |
| `/api/auth/login`    | Lambda Function URL | 認可リクエストURL生成       |
| `/api/auth/callback` | Lambda Function URL | コールバック処理            |
| `/api/account`       | Lambda Function URL | 口座作成API                 |
| `/*`（デフォルト）   | S3                  | 静的ファイル（HTML/JS/CSS） |

### 3.4 リクエストフロー

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
  │ 5. パスが /api/auth/login なので Lambda Function URL に転送
  ▼
Lambda (Function URL)
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
ブラウザ → CloudFront → Lambda (Function URL)
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

### 3.5 OAC（Origin Access Control）によるアクセス制御

CloudFront から S3 および Lambda Function URL へのアクセスは、OAC で保護されています。

**S3 オリジンの場合:**

```
ユーザー → CloudFront → (OAC: 署名付きリクエスト) → S3
```

**Lambda Function URL の場合:**

```
ユーザー → CloudFront → (OAC: SigV4署名) → Lambda Function URL (AWS_IAM認証)
```

これにより、S3 バケットおよび Lambda Function URL を非公開のまま CloudFront 経由でのみアクセス可能にします。

---

## 4. セキュリティ方針

### 4.1 実装済みのセキュリティ対策

| 対策                | 説明                                         |
| ------------------- | -------------------------------------------- |
| HTTPS 強制          | CloudFront で HTTP → HTTPS リダイレクト      |
| S3 非公開           | OAC 経由でのみアクセス可能                   |
| Lambda Function URL | OAC + AWS_IAM 認証で CloudFront 経由のみ許可 |
| PKCE                | 認可コード横取り攻撃を防止                   |
| State パラメータ    | CSRF 攻撃を防止                              |
| Nonce パラメータ    | リプレイ攻撃を防止                           |
| Secrets Manager     | Client ID/Secret を安全に管理                |

### 4.2 学習用途のため簡略化した項目

| 項目         | 本番環境での推奨  | 今回の対応         |
| ------------ | ----------------- | ------------------ |
| WAF          | 有効化            | なし（コスト削減） |
| ログ監視     | CloudWatch Alarms | なし               |
| MFA          | 有効化            | なし（簡略化）     |
| バックアップ | 自動バックアップ  | なし               |

---

## 5. コスト

### 5.1 AWS 無料枠

| サービス   | 無料枠                          | 今回の使用量      |
| ---------- | ------------------------------- | ----------------- |
| Cognito    | 50,000 MAU                      | 1〜3人 ✅         |
| Lambda     | 100万リクエスト/月              | 数百リクエスト ✅ |
| S3         | 5GB ストレージ                  | 数MB ✅           |
| CloudFront | 1TB 転送/月                     | 数MB ✅           |
| DynamoDB   | 25GB ストレージ、RCU/WCU 無料枠 | 数KB ✅           |

※ Lambda Function URLs は Lambda の料金に含まれるため、追加課金なし

### 5.2 想定月額コスト

**ほぼ $0**（無料枠内で収まる見込み）

※ 注意: CloudFront は無料枠を超えると課金されますが、学習用途の少量アクセスであれば問題ありません。

---

## 6. 補足

### 6.1 詳細な実装

以下のリソースを参照してください：

- **CDK 実装**: `cdk/lib/oidc-sandbox-stack.ts`
- **パラメータ管理**: `cdk/parameter.ts`
- **デプロイコマンド**: [project-structure.md](./project-structure.md)
- **Lambda 関数**: `backend/src/handlers/`

### 6.2 スタック構成

```
oidc-sandbox-app (Stack)
├── Cognito User Pool        ← Stateful
├── Cognito User Pool Client
├── Cognito Domain
├── S3 Bucket                ← Stateful
├── CloudFront Distribution  ← Stateless
├── Lambda Functions         ← Stateless
│   ├── LoginFunction (Function URL)
│   ├── CallbackFunction (Function URL)
│   └── AccountFunction (Function URL)
├── DynamoDB Table           ← Stateful
└── Secrets Manager          ← Stateful
```

### 6.3 本番環境への移行時の検討事項

本番環境に移行する場合、以下の項目を検討してください：

- スタック分割（Stateful/Stateless）
- Provisioned Concurrency によるコールドスタート対策
- CDK スナップショットテストの導入
- WAF の有効化
- CloudWatch Alarms の設定
- バックアップ戦略
- 独自ドメインの設定
