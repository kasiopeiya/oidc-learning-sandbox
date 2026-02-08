# /update-design カスタムスラッシュコマンド実装計画

## Context

本プロジェクトは仕様駆動開発を採用しており、以下の開発フローで進めています：

```
1. アイデア作成（docs/idea）
2. Plan作成（docs/plan）
3. Issue作成（docs/issues） ← /create-issue
4. 設計書更新（docs/design） ← /update-design（本コマンド）
5. 設計書レビュー（人間 + /doc-reviewer）
6. 実装（/dev）
7. デプロイ・結合テスト
```

現在、Step 3の `/create-issue` コマンドは実装済みですが、Step 4の設計書更新は手動で行う必要があります。これは以下の課題があります：

- Issueに記載された設計書更新内容を手作業で反映する必要がある
- 設計書のセクション構造を維持しながら更新するのが煩雑
- 更新漏れや不整合が発生しやすい

そこで、Issueファイルを入力として設計書を対話的に更新する `/update-design` コマンドを実装します。

## 概要

`/update-design` コマンドは、指定したIssueファイルの内容を元に、該当する設計書（`docs/design/` 配下）を対話的に更新します。

**主な機能:**

1. Issueファイルからラベル・対象ファイル情報を解析し、更新対象の設計書を自動推定
2. 設計書の現在のセクション構造を解析し、更新箇所をユーザーに提示
3. ユーザーと対話しながら更新内容を決定
4. 既存のセクション構造とMarkdown整合性を維持しながら更新
5. 更新後に `/doc-reviewer` との連携を提案

**既存コマンドとの関係:**

- `/create-issue`: PlanからIssueを生成 → 本コマンドの入力元
- `/doc-reviewer`: 設計書の品質チェック → 本コマンド実行後に推奨

## アーキテクチャ

既存の `/create-issue` と同じパターンを踏襲します：

```
スキル層（SKILL.md）
    ↓ 薄いプロキシ層
エージェント層（agent.md）
    ↓ 厚いビジネスロジック層
ツール実行（Read, Glob, Write, AskUserQuestion）
```

## 処理フロー（6つのPhase）

### Phase 1: Issue読み込みと解析

**目的:** 指定されたIssueファイルを特定し、内容を解析する

**処理:**

1. AskUserQuestionでIssue番号またはファイル名を取得

   ```
   質問: "更新したいIssueを指定してください"
   入力例: "15" または "15-unit-tests.md"
   ```

2. Globで `docs/issues/` 配下を検索してIssueファイルを特定
   - パターン: `docs/issues/*{番号}*.md` または `docs/issues/{ファイル名}`

3. Readでファイル全体を読み込み

4. Issue内容を解析:
   - タイトル（`# Issue #N: タイトル`）
   - ラベル（`- ラベル: backend, frontend, ...`）
   - スコープ/作業項目
   - 設計書への明示的な更新指示（あれば）
   - 対象ファイルセクション（あれば）

**出力:**

- Issueメタデータ（番号、タイトル、ラベル）
- 更新対象設計書のヒント
- 具体的な更新内容（記載があれば）

**エラーハンドリング:**

- Issueファイルが見つからない → 利用可能なIssue一覧を表示して再入力
- Issueファイルが空 → エラーメッセージ表示して中止

---

### Phase 2: 対象設計書の特定

**目的:** 更新すべき設計書ファイルを決定する

**処理:**

1. ラベル情報から候補設計書をマッピング:

   | ラベル     | 対応する設計書           |
   | ---------- | ------------------------ |
   | backend    | backend-design.md        |
   | frontend   | frontend-design.md       |
   | infra, cdk | infrastructure-design.md |
   | test       | test-specification.md    |
   | docs       | ユーザーに確認           |

2. Issue内の「対象ファイル」セクションや「設計書更新」記載から推測を補強

3. AskUserQuestionで対象設計書を確認:
   ```
   質問: "以下の設計書を更新します。よろしいですか？"
   候補:
     - docs/design/backend-design.md
     - docs/design/infrastructure-design.md
   選択肢:
     - はい
     - 変更する（カンマ区切りでファイル名入力）
   ```

**出力:**

- 更新対象設計書のパスリスト

**エラーハンドリング:**

- 対象設計書が自動判定できない → 4つの設計書から選択させる
- 指定されたファイルが存在しない → 警告表示して再入力

---

### Phase 3: 設計書構造の解析とセクション特定

**目的:** 各設計書の現在の構造を理解し、更新箇所を特定する

**処理:**

1. Readで対象設計書を読み込み

2. Markdownのセクション構造を解析:

   ```typescript
   // 正規表現でH1-H6見出しを抽出
   const headingRegex = /^(#{1,6})\s+(.+)$/gm

   // 各セクションの情報を保持
   {
     level: 2,          // H2
     number: "3.4",     // セクション番号（あれば）
     title: "API仕様",
     startLine: 45,
     endLine: 78
   }
   ```

3. Issue内容から更新すべきセクションを推測:
   - 明示的な指定（例: 「3.4.2節を更新」）
   - スコープ/作業項目からキーワード抽出

4. AskUserQuestionで更新セクションを確認:

   ```
   質問: "backend-design.mdのどのセクションを更新しますか？"

   現在の構造:
   1. 概要
   2. OIDC認可コードフロー
     2.1 全体フロー
     2.2 認可エンドポイント
     2.3 コールバック処理
   3. API仕様
     3.1 GET /authorize
     3.2 GET /callback
     3.3 POST /token

   選択肢:
     - 既存セクションを修正（セクション番号入力）
     - 新規セクション追加（番号と名前を入力）
   ```

**出力:**

- 各設計書のセクション構造マップ
- 更新対象セクションリスト（セクション番号、タイトル、更新タイプ）

**エラーハンドリング:**

- セクション番号が存在しない → 再入力を促す
- セクション構造が不正（見出しレベルの飛び） → 警告表示

---

### Phase 4: 更新内容の対話的な決定

**目的:** ユーザーと対話しながら具体的な更新内容を決定する

**処理:**

1. Issue内に具体的な更新内容があるか確認
   - 「設計書更新」セクション
   - 「対象ファイル」セクション
   - 「スコープ/作業項目」内の設計書言及

2. **明示的な記載がある場合:**

   ```
   検出された更新内容:
   ---
   - docs/backend-design.md に OIDC Discovery の説明を追加
   - docs/infrastructure-design.md の 3.4.2節の認証設定を更新
   ---

   この内容をそのまま使用しますか？
   [はい / 編集する]
   ```

3. **記載がない場合:**

   ```
   Issue #15の内容:
   - OIDC Discovery エンドポイント実装
   - /.well-known/openid-configuration 追加

   backend-design.md「3. API仕様」セクションへの追加内容を入力してください。

   推奨する記載項目:
   - エンドポイントパス
   - HTTPメソッド
   - 目的・役割
   - レスポンス形式
   - 実装ファイル名

   [Markdown形式で入力]
   ```

4. 各設計書・各セクションについて繰り返し

**出力:**

- セクションごとの更新内容（Markdown形式）
- 更新タイプ（add / modify）

**エラーハンドリング:**

- 入力が空 → 「スキップ」「後で手動更新」「中断」の選択肢提示
- Markdown構文エラー → 修正を促す

---

### Phase 5: 設計書の更新実行

**目的:** 決定した内容で設計書を更新する

**処理:**

1. 各設計書について更新を実行:

   **新規セクション追加の場合:**

   ```typescript
   // セクション番号から挿入位置を決定
   // 例: 3.4を追加する場合、3.3の次、4.1の前
   function findInsertPosition(sections, targetNumber) {
     const afterSection = find((s) => s.number === '3.3')
     const beforeSection = find((s) => s.number === '4.1')
     return afterSection.endLine + 1
   }
   ```

   **既存セクション修正の場合:**

   ```typescript
   // セクション範囲を特定して置換
   function modifySection(content, sectionNumber, newContent) {
     const section = findSection(content, sectionNumber)
     // 見出し行は保持、内容のみ置換
     return replaceLines(content, section.startLine + 1, section.endLine, newContent)
   }
   ```

2. Markdown整合性チェック:
   - コードブロック（\`\`\`）の閉じ忘れ検出
   - 見出しレベルの整合性（H2の次にH4はNG）
   - セクション番号の連番チェック（警告レベル）

3. 更新後の差分を表示:

   ```
   === backend-design.md の更新内容 ===

   @@ Section 3.4 新規追加 @@
   + ### 3.4 GET /.well-known/openid-configuration
   +
   + **目的:** OIDC Provider の Discovery 情報を提供
   + **実装ファイル:** backend/src/handlers/discovery.ts
   + ...

   この内容で更新してよろしいですか？
   [y / n / 編集]
   ```

4. 承認後、Writeで保存

**出力:**

- 更新された設計書ファイル

**エラーハンドリング:**

- Markdown整合性エラー → 修正して再試行を提案
- ファイル書き込み失敗 → エラーメッセージ表示して中止

---

### Phase 6: 更新結果の報告とNext Action提案

**目的:** 更新完了を報告し、次のステップを提案する

**処理:**

1. 成功メッセージを表示:

   ```
   ✓ Issue #15に基づいて設計書を更新しました

   更新されたファイル:
   - docs/design/backend-design.md (Section 3.4 を新規追加)
   - docs/design/infrastructure-design.md (Section 4.2 を修正)
   ```

2. Markdown整合性チェック結果を表示（問題があれば）

3. Next Actions提案:

   ```
   Next Actions:
   1. /doc-reviewer で設計書の整合性をチェック（推奨）
   2. 人間による設計書レビュー（CLAUDE.md 開発フロー Step 5）
   3. レビュー完了後、/dev で実装開始

   /doc-reviewer を実行しますか？ [y/n]
   ```

4. （オプション）ユーザーが希望すれば `/doc-reviewer` を自動実行

**出力:**

- 完了レポート
- 推奨Next Actionリスト

---

## ファイル構成

### スキルファイル

**場所:** `.claude/skills/update-design/SKILL.md`

**内容:**

- YAMLフロントマター（name, description）
- 概要・使用方法・主な機能
- エージェント起動指示

**参考:** `.claude/skills/create-issue/SKILL.md`

### エージェントファイル

**場所:** `.claude/agents/update-design-agent/update-design-agent.md`

**内容:**

- YAMLフロントマター（name, description, tools, model）
- 6つのPhaseの詳細な処理フロー
- セクション解析アルゴリズム
- Markdown整合性チェックロジック
- エラーハンドリング

**参考:** `.claude/agents/issue-creator-agent/issue-creator-agent.md`

## 使用ツール

| ツール              | 使用場面               | 目的                                                                       |
| ------------------- | ---------------------- | -------------------------------------------------------------------------- |
| **AskUserQuestion** | Phase 1, 2, 3, 4, 5, 6 | Issue指定、設計書確認、セクション選択、更新内容入力、最終確認、Next Action |
| **Glob**            | Phase 1                | Issueファイル検索                                                          |
| **Read**            | Phase 1, 3             | Issueファイル、設計書ファイルの読み込み                                    |
| **Write**           | Phase 5                | 設計書ファイルの更新                                                       |
| **Bash**            | Phase 5（オプション）  | git diff で差分確認                                                        |

**使用モデル:** `claude-sonnet-4-5`（Planエージェントと同等の複雑度）

## セクション解析アルゴリズム

### 見出し抽出

```typescript
interface Section {
  level: number // 1-6 (H1-H6)
  number: string // "3.4.2" など（セクション番号がある場合）
  title: string // セクション名
  startLine: number
  endLine: number
  content: string
}

function parseSections(markdown: string): Section[] {
  const lines = markdown.split('\n')
  const sections: Section[] = []
  const headingRegex = /^(#{1,6})\s+(.+)$/

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(headingRegex)
    if (!match) continue

    const level = match[1].length
    const fullTitle = match[2]

    // セクション番号抽出（例: "3.4 API仕様" → "3.4"）
    const numberMatch = fullTitle.match(/^(\d+(?:\.\d+)*)\s+(.+)$/)
    const number = numberMatch ? numberMatch[1] : ''
    const title = numberMatch ? numberMatch[2] : fullTitle

    // 次の同レベル以上の見出しまでを範囲とする
    let endLine = i
    for (let j = i + 1; j < lines.length; j++) {
      const nextHeading = lines[j].match(/^(#{1,6})\s+/)
      if (nextHeading && nextHeading[1].length <= level) {
        endLine = j - 1
        break
      }
      if (j === lines.length - 1) endLine = j
    }

    sections.push({
      level,
      number,
      title,
      startLine: i,
      endLine,
      content: lines.slice(i + 1, endLine + 1).join('\n')
    })
  }

  return sections
}
```

### 挿入位置決定

```typescript
function findInsertPosition(sections: Section[], targetNumber: string) {
  // "3.4" → ["3", "4"]
  const targetParts = targetNumber.split('.').map(Number)

  let afterSection: Section | null = null
  let beforeSection: Section | null = null

  for (const section of sections) {
    if (!section.number) continue

    const sectionParts = section.number.split('.').map(Number)

    // 同じ階層レベルで比較
    if (sectionParts.length === targetParts.length) {
      const comparison = compareSectionNumbers(sectionParts, targetParts)

      if (comparison < 0) {
        // このセクションはターゲットより前
        if (!afterSection || /* より大きい番号なら */ true) {
          afterSection = section
        }
      } else if (comparison > 0) {
        // このセクションはターゲットより後
        if (!beforeSection || /* より小さい番号なら */ true) {
          beforeSection = section
        }
      }
    }
  }

  // 挿入行番号を決定
  if (afterSection) {
    return afterSection.endLine + 1
  } else if (beforeSection) {
    return beforeSection.startLine
  } else {
    return sections[sections.length - 1].endLine + 1
  }
}
```

## Markdown整合性チェック

### チェック項目

1. **コードブロックの閉じ忘れ**
   - 開始 \`\`\` と終了 \`\`\` のペア確認

2. **見出しレベルの整合性**
   - H2の次にH4は不正（H3を飛ばしている）

3. **セクション番号の連番チェック（警告レベル）**
   - 3.3 → 3.5 は警告（3.4が欠番）

### 実装例

````typescript
interface ValidationError {
  line: number
  message: string
  severity: 'error' | 'warning'
}

function validateMarkdown(markdown: string): ValidationError[] {
  const errors: ValidationError[] = []
  const lines = markdown.split('\n')

  // チェック1: コードブロック
  let inCodeBlock = false
  let codeBlockStartLine = -1

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeBlockStartLine = i + 1
      } else {
        inCodeBlock = false
      }
    }
  }

  if (inCodeBlock) {
    errors.push({
      line: codeBlockStartLine,
      message: 'コードブロックが閉じられていません',
      severity: 'error'
    })
  }

  // チェック2: 見出しレベル
  const sections = parseSections(markdown)
  for (let i = 1; i < sections.length; i++) {
    const prev = sections[i - 1]
    const curr = sections[i]

    if (curr.level > prev.level + 1) {
      errors.push({
        line: curr.startLine,
        message: `見出しレベルが不正です (H${prev.level} の次に H${curr.level} は使えません)`,
        severity: 'error'
      })
    }
  }

  return errors
}
````

## 既存コマンドとの違い

### vs. create-issue

| 観点             | create-issue                                    | update-design                        |
| ---------------- | ----------------------------------------------- | ------------------------------------ |
| **入力**         | Planファイル                                    | Issueファイル                        |
| **出力**         | Issueファイル（新規作成）                       | 設計書ファイル（既存更新）           |
| **主な処理**     | Issue番号採番、メタデータ入力、テンプレート生成 | 設計書解析、セクション特定、内容更新 |
| **複雑度**       | 中（構造化されたテンプレート生成）              | 高（既存構造の解析・保持が必要）     |
| **ファイル操作** | 新規作成のみ                                    | 既存ファイル更新                     |

### vs. doc-reviewer

| 観点             | doc-reviewer         | update-design          |
| ---------------- | -------------------- | ---------------------- |
| **目的**         | 設計書の品質チェック | 設計書の内容更新       |
| **入力**         | 設計書ファイル       | Issueファイル          |
| **出力**         | レビュー結果レポート | 更新された設計書       |
| **判断**         | 自動（ルールベース） | 対話的（ユーザー主導） |
| **ファイル変更** | なし（読み取り専用） | あり（書き込み）       |

**連携方法:**

```
開発フロー Step 4:
1. /update-design で設計書を更新
2. /doc-reviewer で更新後の設計書をチェック ← 自動提案
3. レビュー結果を確認して修正（必要に応じて）
4. 人間による最終レビュー
```

## Critical Files

実装に最も重要なファイル:

### 新規作成

1. **`.claude/skills/update-design/SKILL.md`**
   - スキル定義ファイル
   - ユーザー向けドキュメント
   - 参考: [.claude/skills/create-issue/SKILL.md](../.claude/skills/create-issue/SKILL.md)

2. **`.claude/agents/update-design-agent/update-design-agent.md`**
   - エージェント実装ファイル
   - 6つのPhaseの詳細処理フロー
   - 参考: [.claude/agents/issue-creator-agent/issue-creator-agent.md](../.claude/agents/issue-creator-agent/issue-creator-agent.md)

### 参照

3. **`docs/issues/*.md`**
   - 入力元のIssueファイル群
   - サンプル: [docs/issues/15-unit-tests.md](../../docs/issues/15-unit-tests.md), [docs/issues/13-pluggable-oidc-provider.md](../../docs/issues/13-pluggable-oidc-provider.md)

4. **`docs/design/backend-design.md`**
   - 更新対象の代表的な設計書
   - セクション構造の理解に必須
   - パス: [docs/design/backend-design.md](../../docs/design/backend-design.md)

5. **`docs/design/infrastructure-design.md`**
   - インフラ設計書サンプル
   - パス: [docs/design/infrastructure-design.md](../../docs/design/infrastructure-design.md)

6. **`.claude/agents/issue-creator-agent/issue-creator-agent.md`**
   - 既存の類似エージェントの実装パターン
   - Phase分割、AskUserQuestionの使い方、エラーハンドリングの参考
   - パス: [.claude/agents/issue-creator-agent/issue-creator-agent.md](../.claude/agents/issue-creator-agent/issue-creator-agent.md)

## Verification

### 単体テスト観点

実装後、以下のシナリオで動作確認:

1. **正常系: 単一設計書の新規セクション追加**
   - Issue #15を入力
   - backend-design.mdのセクション3.4を新規追加
   - Markdown整合性が保たれていることを確認

2. **正常系: 複数設計書の同時更新**
   - Issue #13を入力
   - backend-design.mdとinfrastructure-design.mdを更新
   - 両方のファイルが正しく更新されることを確認

3. **正常系: 既存セクションの修正**
   - 既存のセクションを選択して内容を修正
   - セクション番号とタイトルが保持されることを確認

4. **異常系: 存在しないIssue番号**
   - 存在しないIssue #999を指定
   - 利用可能なIssue一覧が表示されることを確認
   - 再入力が促されることを確認

5. **異常系: 空のIssue内容**
   - 空のIssueファイルを指定
   - エラーメッセージが表示されることを確認

6. **異常系: Markdown構文エラー**
   - コードブロックが閉じていない更新内容を入力
   - エラー検出と修正提案が表示されることを確認

### 結合テスト観点

1. **/create-issue → /update-design の連携**
   - create-issueでIssue作成
   - そのIssueをupdate-designで設計書更新
   - 一連のフローが正常動作することを確認

2. **/update-design → /doc-reviewer の連携**
   - update-designで設計書更新
   - doc-reviewerを実行
   - レビュー結果が正しく表示されることを確認

3. **仕様駆動開発フロー全体**
   - Plan作成 → Issue作成 → 設計書更新 → レビュー → 実装
   - 全フローが一貫して動作することを確認

### 手動確認項目

- [ ] スキルがスキル一覧に表示される
- [ ] `/update-design` コマンドが実行できる
- [ ] AskUserQuestionの質問が適切に表示される
- [ ] 設計書のセクション構造が正しく解析される
- [ ] 更新後のMarkdown整合性が保たれる
- [ ] 差分表示が見やすい形式で表示される
- [ ] Next Action提案が表示される
- [ ] `/doc-reviewer` への連携が提案される

## 実装の注意点

1. **既存パターンの踏襲**
   - create-issueと同じアーキテクチャ（薄いスキル層 + 厚いエージェント層）
   - 同じツールセット（AskUserQuestion, Glob, Read, Write）
   - 同じエラーハンドリングパターン

2. **設計書の構造維持**
   - セクション番号の整合性を保つ
   - 見出しレベルの階層を守る
   - 既存コンテンツを破壊しない

3. **対話的なUX**
   - ユーザーに明確な選択肢を提示
   - 推奨値を提案（Issue内容からの推測）
   - 更新前に差分プレビューを表示

4. **エラーリカバリー**
   - 不正入力時は再入力を促す（最大3回まで）
   - Markdown構文エラーは自動検出して修正提案
   - ファイル書き込み失敗時はロールバック提案

5. **トレーサビリティ**
   - 更新履歴はgitで管理（明示的な更新履歴セクションは不要）
   - IssueからのトレーサビリティはIssueファイル自体に記載

6. **パフォーマンス**
   - 大きな設計書（10,000行超）はセクション解析に時間がかかる可能性
   - 初回解析結果をキャッシュする（同一設計書を複数回更新する場合）

7. **docs/plan/ へのコピー**
   - 本プランファイルを `docs/plan/enumerated-booping-waffle.md` にもコピー
   - create-issueと同じトレーサビリティ確保パターン
