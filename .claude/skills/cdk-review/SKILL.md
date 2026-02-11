---
name: cdk-review
description: AWS CDK インフラコードを詳細にレビュー。/cdk-review コマンドが呼ばれたとき、またはユーザーが CDK コードのレビューを依頼したときに使用する。cdk/ ディレクトリ内の TypeScript ファイルを対象に、型安全性・CDK ベストプラクティス・プロジェクトルール準拠を自動チェックする。
context: fork
agent: cdk-reviewer-agent
disable-model-invocation: true
---

AWS CDK インフラコードをレビューしてください。以下の手順に従って実行してください。

## Phase 1: 対象ファイルの検出

- Glob で `cdk/**/*.ts` を検出
- 除外: `**/*.test.ts`、`*.config.*`、`cdk.json`、`node_modules`、`cdk.out/`
- 種別を自動判定:
  - **App**: `cdk/bin/*.ts`
  - **Stack**: `cdk/lib/*-stack.ts`
  - **Construct**: `cdk/lib/constructs/*.ts` または `cdk/lib/*-construct.ts`
  - **Parameter**: `cdk/parameter.ts` または `cdk/lib/parameters/*.ts`
- 検出したすべてのファイルをレビュー対象とする（選択ステップはスキップ）

## Phase 2: レビュー実行

各ファイルに対して `references/review-criteria.md` の17項目でレビューを実施する。

- Read でファイル内容を取得
- Bash で `git log` から変更履歴を確認
- Grep で型安全性（`any` 使用）・Import 形式・L2 Construct 使用状況を確認
- 各観点を3点満点でスコアリング

## Phase 3: 結果出力

`references/report-format.md` のフォーマットに従ってレポートを出力する。
各ファイルの個別レポートを生成後、全体サマリーを出力すること。

## レビューの姿勢

- **建設的**: 批判ではなく、具体的なコード例を交えた改善提案を提示
- **バランス**: 良い点を最低3つ指摘
- **実用的**: 現実的な改善案と根拠を明示
