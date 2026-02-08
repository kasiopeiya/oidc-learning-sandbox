# CLAUDE.md

## プロジェクト概要

OIDCの認可コードフローを学習するためのサンドボックス環境です。
AWS CDKを用いて、OPとRP（Lambda）を構築し、実際の挙動をハンズオン形式で確認することを目的としています。

## AIへの基本指示

- 回答は日本語
- `docs/design` 配下に設計書が格納されています。実装や修正の提案を行う前に必ずこれらのドキュメントを参照し、設計意図に沿った回答をしてください。
- 本プロジェクトは仕様駆動開発を採用します。そのため新規開発時は`docs/design` 配下の設計書と実装の整合性を確認する必要があります。

## 開発フロー

基本的に以下の仕様駆動で開発を行う　＊初期構築時を除く

1. アイデア作成：docs/ideaにやりたいことを記載
2. Plan作成：Planモードで事前調査と仕様の相談、docs/planへプランをファイル保存
3. Issue作成：/crate-issueコマンドでdocs/issueにタスク作成
4. 設計書更新：
   - /update-designで設計書更新
   - /doc-revewerで設計書のレビュー
5. 設計書のレビュー：人間が実施
6. 実装：/devコマンドを実行すると以下フローを実施
   - /tddでテスト実装　＊CDKの場合はスキップ
   - /implementationで実装
   - /ciで静的解析・単体テスト実行
   - /reviewでコードレビュー
   - /validate-designで設計書と実装の整合性チェック
7. インフラデプロイ：人間が実施、cdk dpeloy
8. 結合テスト：人間が実施、/integration-testで結合テスト実行

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
├── cdk/                      # AWS CDK インフラ定義
│   ├── bin/                  # CDKアプリケーションエントリーポイント
│   ├── lib/                  # スタック・コンストラクト定義
│   └── test/                 # インフラテストコード
│
├── backend/                  # Lambda 関数（OIDC RP ロジック）
│   └── src/
│       ├── handlers/         # Lambda ハンドラー関数
│       └── utils/            # 共通ユーティリティ（state管理など）
│
├── frontend/                 # 静的ファイル（TypeScript/HTML）
│   ├── public/               # 静的アセット
│   └── src/
│       ├── pages/            # ページコンポーネント
│       ├── contexts/         # React Context定義
│       ├── utils/            # フロントエンド共通関数
│       └── test/             # フロントエンドテストコード
│
├── docs/                     # 各種設計書・シーケンス図など
│   ├── ADR/                  # ADR、メンテ不要
│   ├── design/               # 設計書（backend, frontend, infrastructureなど）要メンテ（最優先参照）
│   ├── idea/                 # アイデアメモ、メンテ不要
│   ├── plan/                 # 実装計画書、メンテ不要
│   ├── issues/               # Issue管理、メンテ不要
│   ├── init/                 # 初期構築時のドキュメント、メンテ不要
│   └── img/                  # 画像ファイル（シーケンス図など）
│
├── integration-tests/        # Playwrightによる結合テストコード
│   ├── tests/                # テストシナリオ
│   ├── setup/                # テスト環境セットアップ
│   └── scripts/              # テスト用環境変数設定など
│
├── .claude/                  # Claude Code設定（agents, rules, skillsなど）
├── .husky/                   # Git hooks設定
├── CLAUDE.md                 # 本ファイル（AIへの指示書）
├── README.md                 # プロジェクト説明
└── package.json              # ルートレベルの依存関係管理

```
