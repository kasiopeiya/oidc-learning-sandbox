---
name: doc-review
description: ドキュメントファイルのレビューを実行し、品質・完全性・設計の妥当性に関する詳細なフィードバックを提供する。docs/ 配下の設計書（*-design.md）、PRD（requirements.md）、提案書（docs/idea/）、開発ガイドライン（.claude/rules/）など、あらゆる種別のMarkdownドキュメントに対応。ドキュメント種別を自動判定し、種別に応じたレビュー観点で評価する。ドキュメントのレビュー・品質チェックを依頼されたときに使用すること。実装コードとの整合性チェックは対象外（/validate-design で実施）。
argument-hint: '[file-path]'
context: fork
agent: doc-reviewer-agent
---

ドキュメントレビューを実行してください。

引数: $ARGUMENTS
