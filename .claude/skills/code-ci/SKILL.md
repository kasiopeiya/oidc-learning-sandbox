---
name: code-ci-runner
description: backendとfrontendの静的解析・単体テストを実行する（CIパイプラインシミュレーション）。CIチェックやコミット・PR前のコード品質検証を依頼されたときに使用すること。
context: fork
agent: code-ci-runner-agent
---

Backend と Frontend の静的解析と単体テストを実行してください。

出力フォーマットは `.claude/skills/code-ci-runner/references/report-template.md` のテンプレートに従ってください。
