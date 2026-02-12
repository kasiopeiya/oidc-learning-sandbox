# CI Report Templates

各フェーズの結果に応じて、以下のテンプレートを使用して出力してください。

---

## 環境エラー（Phase 1 失敗時）

```
🔴 環境エラー

Error: node_modules が見つかりません

以下のコマンドで依存関係をインストールしてください:
cd backend && npm install
cd frontend && npm install
```

---

## Prettier チェック失敗（Phase 2 失敗時）

```
🔴 CI Failed: Prettier Check

フォーマット違反が検出されました:
- [違反ファイルパス 1]
- [違反ファイルパス 2]

修正方法:
npm run format

CIチェックを中断します。
```

---

## ESLint 失敗（Phase 3/4 失敗時）

```
🔴 CI Failed: ESLint ([Backend または Frontend])

以下のファイルでエラーが検出されました:

[ファイルパス]:[行]:[列]
  Error: [エラーメッセージ]
  Rule: [ルール名]

修正方法:
1. [具体的な修正内容]
2. 自動修正を試す: cd [backend または frontend] && npm run lint:fix

CIチェックを中断します。
```

---

## TypeScript 型チェック失敗（Phase 5/6 失敗時）

```
🔴 CI Failed: TypeScript Type Check ([Backend または Frontend])

以下のファイルで型エラーが検出されました:

[ファイルパス]:[行]:[列]
  Error TS[エラーコード]: [エラーメッセージ]

修正方法:
[型エラーの原因と修正方法の説明]

CIチェックを中断します。
```

---

## 単体テスト失敗（Phase 7/8 失敗時）

```
🔴 CI Failed: Unit Tests ([Backend または Frontend])

以下のテストが失敗しました:

[テストファイルパス]
  Test: [テスト名]

  Expected: [期待値]
  Received: [実際の値]

  at [テストファイルパス]:[行]:[列]

修正方法:
1. [原因の分析]
2. [修正内容]
3. 修正後、再度テストを実行

CIチェックを中断します。
```

---

## CI 成功（全フェーズ通過時）

```
✅ CI Passed!

All checks completed successfully.

=== Summary ===

Prettier Check:        ✅ Passed
ESLint (Backend):      ✅ Passed
ESLint (Frontend):     ✅ Passed
Type Check (Backend):  ✅ Passed
Type Check (Frontend): ✅ Passed
Unit Tests (Backend):  ✅ Passed ([X] tests)
Unit Tests (Frontend): ✅ Passed ([Y] tests)

Total Tests: [X + Y] tests passed

=== Next Steps ===

1. git add . && git commit でコミット作成
2. git push でリモートにプッシュ
3. PR を作成してコードレビューを依頼

CIチェック完了！
```
