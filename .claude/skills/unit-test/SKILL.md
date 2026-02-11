---
name: unit-test
description: Run unit tests for backend and frontend, analyze failures, and provide detailed reports. Use when executing tests after code changes, verifying test results, or fixing failing tests.
context: fork
agent: unit-test-runner
disable-model-invocation: true
argument-hint: '失敗テストを修正してください'
---

Backend と Frontend の単体テストを実行してください。

$ARGUMENTS

テスト実行後、必ず以下のフォーマットで出力してください：

---

## Unit Tests Complete

### Summary

| 対象     | 合計  | 成功  | 失敗  | 成功率 |
| -------- | ----- | ----- | ----- | ------ |
| Backend  | {n}件 | {n}件 | {n}件 | {n}%   |
| Frontend | {n}件 | {n}件 | {n}件 | {n}%   |
| 合計     | {n}件 | {n}件 | {n}件 | {n}%   |

### Analysis

（失敗がない場合）全テスト成功

（失敗がある場合）失敗テストごとに以下を記載：

**[Backend|Frontend] `{ファイルパス}` > `{テスト名}`**

- エラー: {エラーメッセージ}
- 原因: {根本原因}
- 修正方針: {推奨される修正内容}

### Next Steps

- {推奨アクション（テスト全成功の場合は「なし」）}

---
