---
name: cdk-ci
description: Run static analysis, snapshot tests, and cdk synth for CDK infrastructure code. Use when running CDK CI checks for infrastructure code.
context: fork
agent: cdk-ci-runner
disable-model-invocation: true
---

CDK インフラストラクチャコードの静的解析、Snapshotテスト、cdk synth を実行し、結果をレポートしてください。

出力フォーマット:

- 成功時: `.claude/skills/cdk-ci/assets/success-report.md` を読み込んでテンプレートを使用すること
- 失敗時: `.claude/skills/cdk-ci/assets/failure-report.md` を読み込んでテンプレートを使用すること
