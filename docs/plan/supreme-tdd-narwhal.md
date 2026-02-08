# /tdd カスタムスラッシュコマンド実装計画

## Context

本プロジェクトはテスト駆動開発（TDD）を採用しており、開発フローの中で以下のように位置付けられています：

```
1. アイデア作成（docs/idea）
2. Plan作成（docs/plan）
3. Issue作成（docs/issues） ← /create-issue
4. 設計書更新（docs/design） ← /update-design
5. 設計書レビュー（人間 + /doc-reviewer）
6. 実装（/dev） ← この中で /tdd を使用
   - /tdd でテスト実装
   - /implementation で実装
   - /ci で静的解析・単体テスト実行
   - /review でコードレビュー
   - /validate-design で設計書と実装の整合性チェック
7. インフラデプロイ
8. 結合テスト
```

現在、実装フェーズではTDDの原則（Red-Green-Refactor）に従って開発を進める必要がありますが、このサイクルを手動で管理するのは煩雑で、原則を守り忘れるリスクがあります。

そこで、TDDサイクルを段階的にガイドし、各フェーズを確実に実行させる `/tdd` コマンドを実装します。

## 概要

`/tdd` コマンドは、指定したIssueファイルの内容を元に、Red-Green-Refactorサイクルを段階的にガイドし、テスト駆動開発を支援します。

**主な機能:**

1. **Issue読み込み**: Issueファイル（とリンクされたPlanファイル）から実装仕様を抽出
2. **赤フェーズ**: 失敗するテストを作成
3. **テスト実行（Red確認）**: テストが期待通り失敗することを確認
4. **緑フェーズ**: テストを通す最小限の実装
5. **テスト実行（Green確認）**: テストが成功することを確認
6. **リファクタリング**: コードを整理・改善
7. **最終確認**: リファクタリング後もテストが成功することを確認

**TDD原則の強制:**

- 小さな単位でテストを作成
- テストデータはテスト関数内に記述（fixtureは最小限）
- モックは外部依存のみ
- WHYコメントを重視、WHATは最小限

**既存コマンドとの関係:**

- `/create-issue`: PlanからIssueを生成 → 本コマンドの入力元
- `/update-design`: Issueから設計書を更新 → 本コマンド実行前に実行推奨
- `/ci`: 静的解析・全テスト実行 → 本コマンド実行後に実行推奨

## 使用方法

### 基本形式

```bash
/tdd [Issue番号またはファイル名]

# 例
/tdd 15                      # Issue番号で指定
/tdd 15-state-validation.md  # ファイル名で指定
/tdd                         # 対話的に選択
```

### 入力形式

**引数あり:**

```bash
/tdd 15
```

→ Issue #15を自動検索して処理開始

**引数なし:**

```bash
/tdd
```

→ AskUserQuestionでIssue番号を入力

### 前提条件

1. **Issueファイルが存在すること**
   - `/create-issue` で事前に作成
   - `docs/issues/` 配下に配置

2. **設計書が更新済みであること**（推奨）
   - `/update-design` で設計書を更新済み
   - 実装が設計書に沿っていることを確認

3. **Issueに必要な情報が記載されていること**
   - ラベル（backend/frontend）
   - 対象ファイル
   - 実装する機能の説明
   - （オプション）Planファイルへのリンク

## アーキテクチャ

既存の `/create-issue` や `/update-design` と同じパターンを踏襲します：

```
スキル層（SKILL.md）
    ↓ 薄いプロキシ層
エージェント層（agent.md）
    ↓ 厚いビジネスロジック層
ツール実行（Read, Edit, Write, Bash, Task）
```

**サブエージェント活用:**

- 既存の `unit-test-runner` エージェントをテスト実行フェーズで活用
- TDD固有の制約チェックは専用エージェントで実装

## 処理フロー（7つのPhase）

### Phase 1: Issue読み込みと実装仕様の抽出

**目的:** 指定されたIssueファイルを特定し、実装する機能の仕様を抽出する

**処理:**

1. **Issue番号の取得**

   AskUserQuestionでIssue番号またはファイル名を取得（引数がない場合）

   ```
   質問: "実装したいIssueを指定してください"
   入力例: "15" または "15-state-validation.md"
   ```

2. **Issueファイルの検索と読み込み**

   Globで `docs/issues/` 配下を検索してIssueファイルを特定

   ```bash
   # パターン例
   docs/issues/*15*.md
   docs/issues/15-state-validation.md
   ```

   Readでファイル全体を読み込み

3. **Issue内容の解析**

   以下の情報を抽出:
   - **タイトル**: `# Issue #N: タイトル`
   - **ラベル**: `- ラベル: backend, frontend, infra, ...`
   - **スコープ/作業項目**: 実装する機能の詳細
   - **対象ファイル**: テスト対象ファイルのパス
   - **Planファイルへのリンク**: `[プラン名](../plan/xxx.md)` 形式

   **Issue例:**

   ```markdown
   # Issue #15: State検証機能の実装

   - ラベル: backend
   - Plan: [supreme-tdd-narwhal.md](../plan/supreme-tdd-narwhal.md)

   ## スコープ/作業項目

   - [ ] `verifyState` 関数の実装
   - [ ] CSRF対策のためのstate検証
   - [ ] 正常系・異常系のテストケース追加

   ## 対象ファイル

   - backend/src/utils/state.ts
   - backend/src/utils/state.test.ts

   ## 実装詳細

   - 引数: (state: string, expectedState: string)
   - 戻り値: boolean
   - OIDC認可フローでstateパラメータが改ざんされていないことを確認
   ```

4. **Planファイルの読み込み**（リンクがあれば）

   Issueに記載されたPlanファイルのリンクを検出

   ```typescript
   // リンク検出の正規表現
   const planLinkRegex = /\[.*?\]\((\.\.\/plan\/[^)]+\.md)\)/g
   ```

   Readで Planファイルを読み込み、以下の情報を抽出:
   - 詳細な実装方針
   - アーキテクチャ設計
   - 考慮事項
   - Critical Files

5. **対象ディレクトリの自動判定**

   ラベル情報から対象ディレクトリをマッピング:

   | ラベル     | 対応ディレクトリ |
   | ---------- | ---------------- |
   | backend    | backend/         |
   | frontend   | frontend/        |
   | cdk, infra | cdk/             |

6. **テスト対象ファイルとテストファイルの特定**

   Issue内の「対象ファイル」セクションから抽出
   - 明示的に記載がある場合: そのまま使用
   - 記載がない場合: AskUserQuestionで確認

   ```
   質問: "テスト対象ファイルを確認してください"

   Issueから抽出された情報:
   - 実装ファイル: backend/src/utils/state.ts
   - テストファイル: backend/src/utils/state.test.ts

   選択肢:
   - このまま使用
   - 変更する（ファイルパス入力）
   ```

7. **実装仕様の整理と確認**

   IssueとPlanから抽出した情報を整理してユーザーに確認

   ```
   === 実装仕様 ===

   Issue: #15 State検証機能の実装

   対象ファイル:
   - 実装: backend/src/utils/state.ts
   - テスト: backend/src/utils/state.test.ts

   実装する機能:
   - 関数名: verifyState
   - 引数: (state: string, expectedState: string)
   - 戻り値: boolean
   - 目的: OIDC stateパラメータの検証（CSRF対策）

   テストケース（Issueから抽出）:
   - 正常系: 正しいstateが渡された場合にtrueを返す
   - 異常系: 異なるstateが渡された場合にfalseを返す

   この内容でTDDサイクルを開始しますか？
   [はい / 修正する / 中断]
   ```

**出力:**

- Issueメタデータ（番号、タイトル、ラベル）
- テスト対象ファイルパス
- テストファイルパス
- 実装する機能の仕様（関数名、引数、戻り値、目的）
- テストケース候補
- Planファイルの詳細情報（あれば）

**エラーハンドリング:**

- Issueファイルが見つからない → 利用可能なIssue一覧を表示して再入力
- Issueファイルが空 → エラーメッセージ表示して中止
- 対象ファイルが不明 → AskUserQuestionで手動入力
- Planファイルが見つからない → 警告表示（Issueのみで続行）

---

---

### Phase 2: 赤フェーズ（Red）- 失敗するテストを作成

**目的:** まだ実装されていない機能に対するテストを書く

**処理:**

1. テストケースの設計支援

   ```
   最初のテストケースを設計します。
   TDD原則: 小さな単位から始める

   推奨する最初のテストケース:
   - 正常系: 正しいstateが渡された場合にtrueを返す
   - 異常系: 異なるstateが渡された場合にfalseを返す

   他に追加したいテストケースはありますか？
   [推奨ケースで開始 / 追加する]
   ```

2. テストコードを生成

   **原則:**
   - テストデータはテスト関数内に直接記述
   - モックは使わない（外部依存のみ）
   - WHYコメントを適切に配置

   ```typescript
   // backend/src/utils/state.test.ts
   import { verifyState } from './state'

   describe('verifyState', () => {
     test('正しいstateが渡された場合にtrueを返す', () => {
       // WHY: OIDC認可フローでstateパラメータが改ざんされていないことを確認するため
       const state = 'abc123'
       const expectedState = 'abc123'

       const result = verifyState(state, expectedState)

       expect(result).toBe(true)
     })

     test('異なるstateが渡された場合にfalseを返す', () => {
       // WHY: CSRF攻撃を防ぐため、不正なstateは拒否する必要がある
       const state = 'xyz789'
       const expectedState = 'abc123'

       const result = verifyState(state, expectedState)

       expect(result).toBe(false)
     })
   })
   ```

3. Writeでテストファイルを作成/更新

4. テストコードをユーザーに確認

   ```
   作成したテストコード:
   [コード表示]

   TDD原則チェック:
   ✓ テストデータはテスト関数内に記述
   ✓ モック未使用
   ✓ WHYコメント記載
   ✓ 小さな単位のテスト

   このテストで進めますか？
   [はい / 修正する]
   ```

**出力:**

- 失敗するテストコード（\*.test.ts）

**TDD原則チェック:**

- ❌ fixture使用 → 警告表示、テスト関数内に移動を提案
- ❌ 過度なモック → 警告表示、実装変更を提案
- ❌ WHATコメントのみ → 警告表示、WHYコメント追加を提案

**エラーハンドリング:**

- テストフレームワーク未検出 → Jest/Vitestのインストールを提案
- 構文エラー → 修正して再生成

---

### Phase 3: テスト実行（Red確認）

**目的:** テストが期待通り失敗することを確認する

**処理:**

1. unit-test-runnerエージェントを呼び出し

   ```typescript
   Task({
     subagent_type: 'unit-test-runner',
     prompt: 'backend/src/utils/state.test.ts のテストを実行してください',
     description: 'Run Red phase tests'
   })
   ```

2. テスト結果を解析
   - 期待される失敗: 実装が存在しない（例: `Cannot find module './state'`）
   - 予期しない失敗: 構文エラー、importエラー等

3. 結果判定

   **期待通りの失敗の例:**

   ```
   FAIL  backend/src/utils/state.test.ts
   ● Test suite failed to run

     Cannot find module './state' from 'state.test.ts'
   ```

   **予期しない失敗の例:**

   ```
   FAIL  backend/src/utils/state.test.ts
   ● Test suite failed to run

     SyntaxError: Unexpected token 'export'
   ```

4. ユーザーに結果を報告

   ```
   🔴 Red Phase: テストが期待通り失敗しました

   エラー内容:
   - Cannot find module './state'

   理由: まだ実装されていないため（期待通り）

   次のフェーズ（Green: 実装）に進みますか？
   [はい / テストを修正]
   ```

**出力:**

- テスト実行結果
- 失敗理由の分析

**判定基準:**

- ✅ 実装が存在しない → Phase 4へ
- ✅ 関数が未定義 → Phase 4へ
- ❌ 構文エラー → Phase 2へ戻る（テスト修正）
- ❌ importエラー → Phase 2へ戻る（パス修正）

**エラーハンドリング:**

- テストが成功してしまった → 警告表示、Phase 2へ戻る
- テスト実行自体が失敗 → 環境確認を促す

---

### Phase 4: 緑フェーズ（Green）- 最小限の実装

**目的:** テストを通す最小限のコードを書く

**処理:**

1. テストコードを解析し、実装すべき内容を抽出

   ```
   テストから抽出した要件:
   - 関数名: verifyState
   - 引数: state: string, expectedState: string
   - 戻り値: boolean
   - 動作:
     - 引数が一致する場合: true
     - 引数が不一致の場合: false
   ```

2. 最小限の実装を生成

   **原則:**
   - テストを通す最小限のコードのみ
   - 過剰な実装や最適化は避ける
   - WHYコメントを適切に配置

   ```typescript
   // backend/src/utils/state.ts

   /**
    * OIDC stateパラメータを検証する
    *
    * WHY: CSRF攻撃を防ぐため、認可リクエスト時に生成したstateと
    *      コールバック時に受け取ったstateが一致することを確認する
    *
    * @param state - コールバックで受け取ったstate
    * @param expectedState - 認可リクエスト時に生成したstate
    * @returns stateが一致する場合true、それ以外false
    */
   export function verifyState(state: string, expectedState: string): boolean {
     return state === expectedState
   }
   ```

3. Write/Editで実装ファイルを作成/更新

4. 実装をユーザーに確認

   ```
   実装コード:
   [コード表示]

   Green Phase原則チェック:
   ✓ 最小限の実装
   ✓ テストを通すことに集中
   ✓ WHYコメント記載

   この実装で進めますか？
   [はい / 修正する]
   ```

**出力:**

- 最小限の実装コード

**TDD原則チェック:**

- ❌ 過剰な実装（テストにない機能） → 警告表示、削除を提案
- ❌ 最適化コード → 警告表示、リファクタリングフェーズへ延期を提案
- ❌ WHATコメントのみ → 警告表示、WHYコメント追加を提案

**エラーハンドリング:**

- 構文エラー → 修正して再生成
- 型エラー → 型定義を追加

---

### Phase 5: テスト実行（Green確認）

**目的:** テストが成功することを確認する

**処理:**

1. unit-test-runnerエージェントを呼び出し

   ```typescript
   Task({
     subagent_type: 'unit-test-runner',
     prompt: 'backend/src/utils/state.test.ts のテストを実行してください',
     description: 'Run Green phase tests'
   })
   ```

2. テスト結果を解析
   - 期待される成功: 全テストがパス
   - 失敗: 実装に誤りがある

3. 結果判定

   **成功の例:**

   ```
   PASS  backend/src/utils/state.test.ts
   ✓ 正しいstateが渡された場合にtrueを返す (3 ms)
   ✓ 異なるstateが渡された場合にfalseを返す (1 ms)

   Test Suites: 1 passed, 1 total
   Tests:       2 passed, 2 total
   ```

   **失敗の例:**

   ```
   FAIL  backend/src/utils/state.test.ts
   ✕ 正しいstateが渡された場合にtrueを返す (5 ms)

   Expected: true
   Received: false
   ```

4. ユーザーに結果を報告

   ```
   🟢 Green Phase: 全テストが成功しました

   テスト結果:
   ✓ 正しいstateが渡された場合にtrueを返す
   ✓ 異なるstateが渡された場合にfalseを返す

   次のフェーズ（Refactor）に進みますか？
   [はい / 実装を修正]
   ```

**出力:**

- テスト実行結果
- 成功/失敗の判定

**判定基準:**

- ✅ 全テスト成功 → Phase 6へ
- ❌ 一部/全部失敗 → Phase 4へ戻る（実装修正）

**エラーハンドリング:**

- テスト実行自体が失敗 → 環境確認を促す
- タイムアウト → テストコードの見直しを促す

---

### Phase 6: リファクタリング（Refactor）

**目的:** テストが通った状態でコードを整理・改善する

**処理:**

1. リファクタリング可能性の分析

   **対象:**
   - 実装コード（重複排除、変数名改善、可読性向上）
   - テストコード（共通ロジック抽出、可読性向上）

   **分析例:**

   ```
   リファクタリング候補:

   実装コード:
   - なし（既に最小限）

   テストコード:
   - 変数名 'state' → 'actualState' に変更（明確化）
   - 期待値を定数化（DRY原則）
   ```

2. リファクタリング提案をユーザーに提示

   ```
   リファクタリング提案:

   1. テストコードの変数名を明確化
      - state → actualState
      - expectedState はそのまま

   2. 期待値を定数化
      - VALID_STATE = 'abc123'
      - INVALID_STATE = 'xyz789'

   リファクタリングを実行しますか？
   [全て実行 / 選択 / スキップ]
   ```

3. Edit/Writeでリファクタリングを実行

   **リファクタリング後:**

   ```typescript
   // backend/src/utils/state.test.ts
   import { verifyState } from './state'

   describe('verifyState', () => {
     const VALID_STATE = 'abc123'
     const INVALID_STATE = 'xyz789'

     test('正しいstateが渡された場合にtrueを返す', () => {
       // WHY: OIDC認可フローでstateパラメータが改ざんされていないことを確認するため
       const actualState = VALID_STATE
       const expectedState = VALID_STATE

       const result = verifyState(actualState, expectedState)

       expect(result).toBe(true)
     })

     test('異なるstateが渡された場合にfalseを返す', () => {
       // WHY: CSRF攻撃を防ぐため、不正なstateは拒否する必要がある
       const actualState = INVALID_STATE
       const expectedState = VALID_STATE

       const result = verifyState(actualState, expectedState)

       expect(result).toBe(false)
     })
   })
   ```

4. リファクタリング内容を確認

   ```
   リファクタリング完了:
   [差分表示]

   次のフェーズ（最終確認）に進みますか？
   [はい / さらにリファクタリング]
   ```

**出力:**

- リファクタリングされたコード

**リファクタリング原則:**

- 動作を変えない
- テストが通ることを前提とする
- 過度な最適化は避ける（YAGNI原則）

**リファクタリング候補:**

- 重複コードの関数化
- マジックナンバーの定数化
- 変数名・関数名の改善
- コメントの整理（不要なコメント削除）
- 型定義の改善

**エラーハンドリング:**

- リファクタリング後のテストが失敗 → ロールバックを提案

---

### Phase 7: 最終確認（Final Verification）

**目的:** リファクタリング後も動作を保証する

**処理:**

1. unit-test-runnerエージェントを呼び出し

   ```typescript
   Task({
     subagent_type: 'unit-test-runner',
     prompt: 'backend/src/utils/state.test.ts のテストを実行してください',
     description: 'Run final verification'
   })
   ```

2. テスト結果を解析
   - 期待される結果: 全テスト成功（リファクタリング前と同じ）
   - 失敗: リファクタリングでバグが混入

3. 結果判定

   **成功の例:**

   ```
   PASS  backend/src/utils/state.test.ts
   ✓ 正しいstateが渡された場合にtrueを返す (3 ms)
   ✓ 異なるstateが渡された場合にfalseを返す (1 ms)

   Test Suites: 1 passed, 1 total
   Tests:       2 passed, 2 total
   ```

4. TDDサイクル完了を報告

   ```
   ✅ TDDサイクル完了！

   作成されたファイル:
   - backend/src/utils/state.ts (実装)
   - backend/src/utils/state.test.ts (テスト)

   テスト結果:
   ✓ 全テスト成功 (2 tests, 0 failures)

   TDD原則チェック:
   ✓ Red → Green → Refactor サイクル完遂
   ✓ テストデータはテスト関数内に記述
   ✓ モック未使用
   ✓ WHYコメント記載

   Next Actions:
   1. git commit でコミット作成
   2. 次の機能のTDDサイクルを開始
   3. /ci で静的解析・単体テスト実行

   次の機能を実装しますか？
   [/tdd を再実行 / 終了]
   ```

**出力:**

- 最終テスト結果
- TDDサイクル完了レポート
- Next Action提案

**判定基準:**

- ✅ 全テスト成功 → 完了
- ❌ 失敗 → Phase 6へ戻る（リファクタリング修正）

**エラーハンドリング:**

- テスト失敗 → リファクタリングをロールバックするか確認

---

## ファイル構成

### スキルファイル

**場所:** `.claude/skills/tdd/SKILL.md`

**内容:**

- YAMLフロントマター（name, description）
- 概要・使用方法・主な機能
- TDD原則の説明
- エージェント起動指示

**参考:** `.claude/skills/create-issue/SKILL.md`, `.claude/skills/update-design/SKILL.md`

### エージェントファイル

**場所:** `.claude/agents/tdd-agent/tdd-agent.md`

**内容:**

- YAMLフロントマター（name, description, tools, model）
- 7つのPhaseの詳細な処理フロー
- TDD原則チェックロジック
- テストコード生成ロジック
- 実装コード生成ロジック
- リファクタリング候補抽出ロジック
- エラーハンドリング

**参考:** `.claude/agents/issue-creator-agent/issue-creator-agent.md`, `.claude/agents/update-design-agent/update-design-agent.md`

## 使用ツール

| ツール              | 使用場面              | 目的                                                  |
| ------------------- | --------------------- | ----------------------------------------------------- |
| **AskUserQuestion** | Phase 1, 2, 4, 6, 7   | Issue指定、テストケース選択、実装確認、リファクタ選択 |
| **Glob**            | Phase 1               | Issueファイル検索、テストファイル/実装ファイルの検索  |
| **Read**            | Phase 1, 2, 4         | Issueファイル、Planファイル、既存ファイル読み込み     |
| **Write**           | Phase 2, 4            | テストファイル/実装ファイルの新規作成                 |
| **Edit**            | Phase 2, 4, 6         | 既存ファイルへのテスト/実装追加、リファクタリング     |
| **Task**            | Phase 3, 5, 7         | unit-test-runnerエージェント呼び出し（テスト実行）    |
| **Grep**            | Phase 1（オプション） | 既存テストの参照パターン検索                          |

**使用モデル:** `claude-sonnet-4-5`（複雑な処理フローと Issue/Plan 解析のため）

## TDD原則の強制

### チェック項目

エージェントは以下の原則を各フェーズでチェックし、違反があれば警告を表示します：

#### テスト作成（Phase 2）

1. **小さな単位のテスト**
   - 1つのテストケースは1つの動作のみ検証
   - 複数のassertionは警告（例外: 関連する複数の属性チェック）

2. **テストデータの配置**
   - ✅ テスト関数内に直接記述
   - ⚠️ fixtureファイル使用 → assertionに無関係なデータのみ許可
   - ❌ グローバル変数 → 禁止

3. **モックの使用制限**
   - ✅ 外部API、DB、ファイルシステム → 許可
   - ⚠️ 内部関数のモック → 警告（設計見直しを提案）
   - ❌ 過度なモック → 禁止

4. **コメントルール**
   - ✅ WHYコメント（なぜこのテストが必要か）
   - ⚠️ WHATコメント → 複雑な処理のみ許可
   - ❌ 自明なコメント → 削除を提案

#### 実装（Phase 4）

1. **最小限の実装**
   - ✅ テストを通すために必要な最小限のコード
   - ❌ テストにない機能の追加 → 削除を提案
   - ❌ 最適化コード → リファクタリングフェーズへ延期を提案

2. **コメントルール**
   - ✅ WHYコメント（なぜこの実装か）
   - ⚠️ WHATコメント → 複雑な処理のみ許可
   - ❌ 自明なコメント → 削除を提案

#### リファクタリング（Phase 6）

1. **動作を変えない**
   - テストが通ることが前提
   - テストが失敗したら即ロールバック

2. **過度な最適化の禁止**
   - YAGNI原則（You Aren't Gonna Need It）
   - 現在必要な改善のみ実施

### 違反時の動作

```
⚠️ TDD原則違反を検出

Phase 2: テスト作成

違反内容:
- fixtureファイル 'testData.json' を使用しています

TDD原則:
- テストデータはテスト関数内に記述する
- assertionに無関係なデータのみfixture利用可

対処方法:
1. testData.jsonの内容をテスト関数内に移動
2. assertionに無関係なデータであることを確認

続行しますか？
[修正する / このまま続行 / 中断]
```

## 既存コマンドとの連携

### 開発フロー全体

```
1. アイデア作成（docs/idea）
   ↓
2. Plan作成（docs/plan）
   ↓
3. Issue作成（/create-issue）
   docs/issues/15-state-validation.md 作成
   Planへのリンクを含む
   ↓
4. 設計書更新（/update-design）
   Issue #15 を入力に設計書を更新
   docs/design/backend-design.md 更新
   ↓
5. 設計書レビュー（人間 + /doc-reviewer）
   ↓
6. 実装（/tdd）← 本コマンド
   Issue #15 を入力にTDDサイクル実行
   backend/src/utils/state.ts 実装
   backend/src/utils/state.test.ts 作成
   ↓
7. 静的解析・全テスト（/ci）
   プロジェクト全体の品質チェック
   ↓
8. コードレビュー（/review）
   ↓
9. 設計書整合性チェック（/validate-design）
   ↓
10. デプロイ・結合テスト
```

### トレーサビリティ

```
Idea → Plan → Issue → Design → Test + Code
                ↓       ↓         ↓
          /create-issue /update-design /tdd
```

全てがファイルで繋がり、完全なトレーサビリティを実現

### /tddの役割

**従来のフロー:**

```
Issue → 設計書 → 手動でテスト作成 → 手動で実装 → テスト実行
```

**新しいフロー:**

```
Issue → 設計書 → /tdd（自動でTDDサイクル） → 完成
```

**/tddの影響:**

- **テスト実行スコープの違い:**
  - `/tdd`: 対象ファイルのテストのみ実行（高速フィードバック）
  - `/ci`: プロジェクト全体のテスト実行（網羅的チェック）

- **静的解析:**
  - `/tdd`: 静的解析は含まない（実装に集中）
  - `/ci`: ESLint, Prettier等の静的解析を実行

- **/implementation コマンドの扱い:**
  - 新規機能: `/tdd` を使用（TDD推奨）
  - CDKコード: `/implementation` を使用（テストスキップ）
  - 既存修正: どちらでも可（状況に応じて）

### /ci との連携

```bash
# /tdd 実行後
/ci  # 静的解析 + 全テスト再実行

# または
/ci --lint-only  # 静的解析のみ（テストはスキップ）
```

### /review との連携

```bash
# /tdd 実行後
/review  # 生成されたテストと実装をレビュー
```

### /validate-design との連携

```bash
# /tdd 実行後
/validate-design  # 設計書との整合性チェック
```

## Critical Files

実装に最も重要なファイル:

### 新規作成

1. **`.claude/skills/tdd/SKILL.md`**
   - スキル定義ファイル
   - ユーザー向けドキュメント
   - 参考: [.claude/skills/create-issue/SKILL.md](../.claude/skills/create-issue/SKILL.md)

2. **`.claude/agents/tdd-agent/tdd-agent.md`**
   - エージェント実装ファイル
   - 7つのPhaseの詳細処理フロー
   - TDD原則チェックロジック
   - 参考: [.claude/agents/issue-creator-agent/issue-creator-agent.md](../.claude/agents/issue-creator-agent/issue-creator-agent.md)

### 参照

3. **`docs/issues/*.md`**
   - 入力元のIssueファイル群
   - Phase 1で読み込み、実装仕様を抽出
   - サンプル: `docs/issues/15-state-validation.md`

4. **`docs/plan/*.md`**
   - Issueにリンクされた詳細設計
   - Phase 1で読み込み、実装方針を理解
   - サンプル: `docs/plan/supreme-tdd-narwhal.md`

5. **`backend/src/**/\*.test.ts`\*\*
   - 既存のテストファイル（パターン参考）
   - Jest/Vitestの設定確認

6. **`frontend/src/**/\*.test.ts`\*\*
   - フロントエンドのテストファイル（パターン参考）

7. **`.claude/agents/unit-test-runner/`**
   - テスト実行用エージェント（Phase 3, 5, 7で使用）

8. **`docs/design/backend-design.md`**
   - バックエンド設計書（実装が設計に沿っているか確認）

9. **`docs/design/frontend-design.md`**
   - フロントエンド設計書（実装が設計に沿っているか確認）

10. **`.claude/agents/issue-creator-agent/issue-creator-agent.md`**
    - Issue作成エージェント（Issueファイル解析パターンの参考）

11. **`.claude/agents/update-design-agent/update-design-agent.md`**
    - 設計書更新エージェント（Issue解析・Phase分割パターンの参考）

## Verification

### 単体テスト観点

実装後、以下のシナリオで動作確認:

**Phase 1: Issue読み込み**

1. **正常系: Issue番号指定**
   - `/tdd 15` でIssue #15を検索
   - Issueファイルが正しく読み込まれる
   - 実装仕様が正しく抽出される

2. **正常系: Planファイルリンク読み込み**
   - IssueにPlanファイルへのリンクがある場合
   - Planファイルが正しく読み込まれる
   - 詳細な実装方針が抽出される

3. **正常系: 対象ファイルの自動判定**
   - ラベル `backend` から `backend/` ディレクトリを自動判定
   - 対象ファイルセクションからファイルパスを抽出

4. **異常系: 存在しないIssue番号**
   - `/tdd 999` で存在しないIssueを指定
   - 利用可能なIssue一覧が表示される
   - 再入力が促される

5. **異常系: 空のIssueファイル**
   - 空のIssueファイルを指定
   - エラーメッセージが表示される
   - 処理が中断される

6. **異常系: Planファイルが見つからない**
   - IssueにPlanリンクがあるが、ファイルが存在しない
   - 警告が表示される
   - Issueの情報のみで続行

**TDDサイクル全体**

7. **正常系: 新規ファイルのTDDサイクル**
   - 新規関数 `verifyState` の実装
   - Red → Green → Refactor の全フェーズが正常動作
   - テストと実装が正しく生成される

8. **正常系: 既存ファイルへの追加**
   - 既存ファイル `state.ts` に新関数 `generateState` を追加
   - 既存テストファイルに新テストケースが追加される
   - 既存のテストが壊れないことを確認

9. **正常系: リファクタリングフェーズ**
   - リファクタリング提案が表示される
   - リファクタリング実行後もテストが成功する
   - コードの可読性が向上する

10. **異常系: Red確認で期待外のエラー**
    - 構文エラー等でテストが実行できない
    - Phase 2（テスト作成）に戻る
    - 修正後に再実行できる

11. **異常系: Green確認でテスト失敗**
    - 実装に誤りがある
    - Phase 4（実装）に戻る
    - 修正後に再実行できる

12. **異常系: 最終確認でテスト失敗**
    - リファクタリングでバグ混入
    - リファクタリングをロールバック
    - Phase 6に戻る

13. **TDD原則違反検出**
    - fixture使用 → 警告表示
    - 過度なモック → 警告表示
    - 過剰な実装 → 警告表示

### 結合テスト観点

1. **開発フロー全体の連携**
   - `/create-issue` でIssue作成
   - `/update-design` で設計書更新
   - `/tdd` で実装（Issueを入力）
   - `/ci` で品質チェック
   - 一連のフローが正常動作することを確認

2. **Issue → Plan → TDD の連携**
   - IssueにPlanへのリンクが含まれる場合
   - Planファイルの詳細情報が活用される
   - 実装がPlanの設計意図に沿っていることを確認

3. **/tdd → /ci の連携**
   - TDDサイクル完了後、/ciを実行
   - 静的解析が正常動作
   - 全テストが成功

4. **/tdd → /review の連携**
   - TDDサイクル完了後、/reviewを実行
   - 生成されたコードのレビューが表示

5. **/tdd → /validate-design の連携**
   - TDDサイクル完了後、/validate-designを実行
   - 設計書との整合性チェックが実行

6. **複数回の /tdd 実行**
   - 1つ目の機能を /tdd で実装
   - 2つ目の機能を /tdd で実装
   - 既存テストが壊れないことを確認

### 手動確認項目

**基本動作:**

- [ ] スキルがスキル一覧に表示される
- [ ] `/tdd 15` のように Issue番号で実行できる
- [ ] `/tdd` で対話的にIssue選択ができる

**Phase 1: Issue読み込み:**

- [ ] Issueファイルが正しく検索・読み込まれる
- [ ] Issueからラベル・対象ファイルが抽出される
- [ ] PlanファイルへのリンクがあればPlanも読み込まれる
- [ ] 実装仕様が正しく整理・表示される

**TDDサイクル:**

- [ ] 7つのPhaseが順番に実行される
- [ ] AskUserQuestionの質問が適切に表示される
- [ ] テストコードが正しく生成される
- [ ] 実装コードが正しく生成される
- [ ] unit-test-runnerが正しく呼び出される
- [ ] TDD原則違反が検出される
- [ ] リファクタリング提案が表示される
- [ ] 完了レポートが表示される
- [ ] Next Action提案が表示される

**トレーサビリティ:**

- [ ] IssueとPlanの情報がコメント等に反映される
- [ ] Issue番号が何らかの形で記録される

## 実装の注意点

1. **既存パターンの踏襲**
   - create-issue/update-designと同じアーキテクチャ
   - 同じツールセット（AskUserQuestion, Read, Write, Edit, Task）
   - 同じエラーハンドリングパターン

2. **TDD原則の厳格な適用**
   - 各フェーズでTDD原則をチェック
   - 違反時は警告表示と修正提案
   - ユーザーに強制はしない（警告のみ）

3. **段階的なUX**
   - 各フェーズの完了を明確に表示
   - 次フェーズへの遷移はユーザー確認
   - いつでも前フェーズに戻れる

4. **テストフレームワークの自動検出**
   - package.jsonから Jest/Vitest を検出
   - 対応するimport文とassertion構文を生成
   - 未検出時はインストールを提案

5. **コード生成の品質**
   - 既存コードのスタイルを学習して踏襲
   - TypeScript型定義を適切に生成
   - JSDoc形式のドキュメントを生成

6. **エラーリカバリー**
   - 各フェーズで失敗した場合、前フェーズに戻れる
   - 最大3回まで自動リトライ
   - 3回失敗したら中断を提案

7. **パフォーマンス**
   - テスト実行は unit-test-runner に委譲（並列実行可能）
   - コード生成は必要最小限（大きなファイルは部分的に読み込み）

8. **トレーサビリティ**
   - 生成されたコードにTDD原則準拠のコメントを自動追加
   - WHYコメントで実装理由を明記

## 今後の拡張可能性

### Phase 追加の可能性

1. **Phase 0: 設計書確認**
   - 実装前に設計書を確認
   - 設計書との整合性を事前チェック
   - 設計書に記載がない場合は警告

2. **Phase 8: コミット作成**
   - TDDサイクル完了後、自動でgit commit
   - `/git-commit` との連携

### 機能拡張の可能性

1. **複数テストケースの連続実行**
   - 1つのテストケースずつRed-Green-Refactorを繰り返す
   - 全テストケース完了後に最終リファクタリング

2. **カバレッジ計測**
   - テスト実行時にカバレッジを計測
   - カバレッジが低い場合は追加テストを提案

3. **ミューテーションテスト**
   - リファクタリング後にミューテーションテストを実行
   - テストの品質を検証

4. **AI支援のテストケース生成**
   - 実装仕様から追加すべきテストケースを提案
   - エッジケース、異常系の網羅性向上

## docs/plan/ へのコピー

本プランファイルを `docs/plan/supreme-tdd-narwhal.md` として保存し、トレーサビリティを確保します。
