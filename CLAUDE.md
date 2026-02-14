# CLAUDE.md

## プロジェクト概要

OIDCの認可コードフローを学習するためのサンドボックス環境です。
AWS CDKを用いて、OPとRP（Lambda）を構築し、実際の挙動をハンズオン形式で確認することを目的としています。

## AIへの基本指示

- 回答は日本語
- `docs/design` 配下に設計書が格納されています。実装や修正の提案を行う前に必ずこれらのドキュメントを参照し、設計意図に沿った回答をしてください。
- 本プロジェクトは仕様駆動開発を採用します。そのため新規開発時は`docs/design` 配下の設計書と実装の整合性を確認する必要があります。
- 仕様や設計の判断が難しい場合は積極的にユーザーに確認を求めてください。疑問がある場合は質問してください。
- ユーザーとのやり取りを通じて、他の場面でも発生しうる問題が発生した場合や、効率化のノウハウを得た場合は、必ず解答の最後に知見をまとめ、ルール更新の提案をすること

## 開発フロー

基本的に以下の仕様駆動で開発を行う　＊初期構築時やSkillなどの開発を除く

1. アイデア作成：docs/ideaにやりたいことを記載
2. Plan作成：Planモードで事前調査と仕様の相談
   - Planファイルは `docs/plan/template.md` をベースに作成すること
   - **必須：** 「設計書への影響」セクションを必ず含めること。更新不要な場合も「更新不要・理由：〇〇」と明記すること
   - **必須：** タスク一覧に設計書更新タスクを含めること（更新不要な場合を除く）
3. PlanとIssue作成：`/create-issue`でGitHub Issuesにissueを作成
4. 設計書更新：Issue番号を引数に`/design`を実行し、以下を実施
   - `/update-design`で設計書更新
   - `/doc-review`で設計書のレビュー
   - `/doc-review`の実行結果をもとに設計書を修正
5. 設計書のレビュー：人間が実施
6. frontend/backend実装の場合：Issue番号を引数に`/code-dev`を実行、以下を実施
   - `/tdd`でアプリケーションコードをテスト駆動実装　＊CDKでは使用しない
   - `/code-review`でコードレビュー
   - `/code-review`の実行結果をもとに実装を修正
   - `/code-ci`で静的解析・単体テスト実行
   - `/code-ci`の実行結果をもとに実装を修正
   - `/validate-design`で設計書と実装の整合性チェック
   - `/validate-design`の実行結果をもとに設計書を修正（実装から設計へのフィードバック）
7. cdk実装の場合
   - `/cdk-dev`で実装　＊CDKはテスト駆動開発できないので/tddではなくこちらを使用
   - `/cdk-review`でコードレビュー
   - `/cdk-review`の実行結果を元に実装修正
   - `/cdk-ci`で静的解析・snapshotテスト・cdk synth
8. インフラデプロイ：人間が実施、cdk dpeloy
9. 結合テスト：人間が実施、/integration-testで結合テスト実行

- アプリケーションコードの実装にはTDDを採用する（CDKやそれ以外の実装は実施しない）
- 実装作業は指定されたGitHub Issue番号とリンクされたplanファイルに基づいて実施します
- （厳守！）作業はGitHub Issueに記載されている「タスク一覧」を１つずつ確認し、タスクが完了するごとに必ず`gh issue edit`コマンドでGitHub Issueのチェックリストを更新しながら作業をしてください

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
│   ├── plan/                 # プランファイルの一時保管場所、メンテ不要
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
