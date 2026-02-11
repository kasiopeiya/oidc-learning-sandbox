---
name: code-review
description: TypeScript アプリケーションコードをレビュー。/code-review コマンドが呼ばれたとき、またはユーザーが TypeScript/React コードのレビューを依頼したときに使用する。型安全性・設計原則・セキュリティ・プロジェクトルール準拠を自動チェックする。
argument-hint: '[ファイルパス]'
context: fork
agent: code-reviewer-agent
disable-model-invocation: true
---

TypeScript アプリケーションコードをレビューしてください。

引数: $ARGUMENTS
