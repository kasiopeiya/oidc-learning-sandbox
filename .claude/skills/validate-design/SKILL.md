---
name: validate-design
description: >
  設計書（docs/design/）とアプリケーションコード（backend/、frontend/）の整合性を検証する。
  「/validate-design」「設計書と実装の整合性チェック」と指示されたときに使用する。
argument-hint: '[backend|frontend|all]'
context: fork
agent: design-validator-agent
disable-model-invocation: true
---

引数: 設計書とアプリケーションコードの整合性を検証してください。

検証対象は引数で決定します（未指定または "all": backend と frontend の両方、"backend": Backend のみ、"frontend": Frontend のみ）。

レポートの出力形式は `.claude/skills/validate-design/assets/report-template.md` を読み込み、そのテンプレートに従って作成してください。
