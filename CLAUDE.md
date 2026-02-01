# CLAUDE.md

## プロジェクト概要

OIDCの認可コードフローを学習するためのサンドボックス環境です。
AWS CDKを用いて、OPとRP（Lambda）を構築し、実際の挙動をハンズオン形式で確認することを目的としています。

## AIへの基本指示

- 回答は日本語
- `docs/` 配下に設計書が格納されています。実装や修正の提案を行う前に必ずこれらのドキュメントを参照し、設計意図に沿った回答をしてください。

## 開発ガイドライン

### コミットメッセージ形式

`type: description` 形式（feat/fix/docs/refactor/test/chore）

### 主要コマンド

CDKコマンド実行前にtscによるビルドは実行しないこと

```bash
cd cdk && source deploy.sh
```

## 技術スタック

- **言語:** TypeScript (Node.js)
- **インフラ:** AWS CDK
- **認証:** Amazon Cognito (OIDC Provider)
- **バックエンド:** Lambda (Relying Party)
- **フロントエンド:** S3 + CloudFront

## ディレクトリ構成

```text
.
├── cdk/        # AWS CDK インフラ定義
├── backend/    # Lambda 関数（OIDC RP ロジック）
├── frontend/   # 静的ファイル（TypeScript/HTML）
├── docs/       # 各種設計書・シーケンス図（最優先参照）
├── integration-tests/       # Playwrightによるテストコード
└── CLAUDE.md   # 本ファイル

```
