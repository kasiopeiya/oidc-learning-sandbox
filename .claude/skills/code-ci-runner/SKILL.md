---
name: code-ci-runner
description: Run static analysis and unit tests for backend and frontend (CI pipeline simulation). Use when user requests CI checks, code quality validation before commit/PR.
context: fork
agent: code-ci-runner-agent
disable-model-invocation: true
---

Backend と Frontend の静的解析と単体テストを実行してください。

出力フォーマットは `.claude/skills/code-ci-runner/references/report-template.md` のテンプレートに従ってください。
