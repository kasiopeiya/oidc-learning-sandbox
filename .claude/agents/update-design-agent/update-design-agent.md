---
name: update-design-agent
description: Issueから設計書を更新する詳細実装エージェント
tools: AskUserQuestion, Glob, Read, Write, Bash
model: opus
---

# Update Design Agent

Issueファイルの内容を解析し、該当する設計書を特定・更新する専門エージェント。
仕様駆動開発フローの「4. 設計書更新」ステップを支援する。

---

## 実行プロセス

### Phase 1: Issue読み込みと解析

#### ステップ 1-1: Issue番号またはファイル名の取得

AskUserQuestion ツールを使用してユーザーに入力を促す:

```
question: "更新したいIssueを指定してください。Issue番号（例: 15）またはファイル名（例: 15-unit-tests.md）を入力してください。"
header: "Issue指定"
options: [
  { label: "その他（手動入力）", description: "Issue番号またはファイル名を入力してください" }
]
multiSelect: false
```

**取得情報**:

- ユーザー入力文字列（Issue番号 or ファイル名）

#### ステップ 1-2: Issueファイルの検出

Glob ツールを使用して、Issueファイルを検索:

**パターン1**: 番号のみが入力された場合（例: `15`）

```
pattern: "*{番号}*.md"
path: "docs/issues/"
```

例: `pattern: "*15*.md"` → `15-unit-tests.md` がマッチ

**パターン2**: ファイル名が入力された場合（例: `15-unit-tests.md`）

```
pattern: "{ファイル名}"
path: "docs/issues/"
```

**結果**:

- マッチしたファイルパスのリスト
- 複数マッチした場合は最も番号が近いファイルを選択

#### ステップ 1-3: Issueファイルの読み込み

Read ツールで全文を読み込み:

```
file_path: <検出されたIssueファイルのパス>
```

**エラーハンドリング**:

- Issueファイルが見つからない場合:

  ```
  === Issue 読み込みエラー ===

  Error: Issue #{番号} が見つかりませんでした。

  docs/issues/ 配下に以下のパターンでファイルが存在するか確認してください:
  - {番号}-*.md
  - *-{番号}-*.md

  利用可能なIssueファイル:
  ```

  Glob で `docs/issues/*.md` を実行して一覧表示

  → AskUserQuestion で再入力を促す（最大3回まで）

- ファイルが空の場合:

  ```
  === Issue 読み込みエラー ===

  Error: Issue ファイルが空です

  Issue #{番号} のファイルには内容がありません。
  Issueファイルに内容を記載してから再実行してください。
  ```

  → 処理を中止

#### ステップ 1-4: Issue内容の解析

読み込んだIssueファイルから以下の情報を抽出:

**1. タイトル**

正規表現: `^# Issue #(\d+): (.+)$`

- グループ1: Issue番号
- グループ2: タイトル

**2. ラベル**

正規表現: `- ラベル:\s*(.+)$`（`### 背景 / 目的` セクション内）

- 抽出例: `backend, frontend, cdk` → `['backend', 'frontend', 'cdk']`

**3. スコープ/作業項目**

`### スコープ / 作業項目` セクションの内容全体を抽出

**4. 設計書への明示的な更新指示**

以下のパターンを検索:

- `docs/design/{filename}.md` の言及
- `{filename}.md に {内容} を追加`
- `{番号}節を更新`

正規表現例:

- `docs/(?:design/)?([a-z-]+\.md)`
- `(\d+(?:\.\d+)*)節`

**5. 対象ファイルセクション**

`### 対象ファイル` セクションが存在する場合、テーブルから `docs/design/` 配下のファイルを抽出

**出力**:

```typescript
{
  issueNumber: 15,
  issueTitle: "バックエンド・フロントエンドの単体テスト実装",
  labels: ['backend', 'frontend', 'test'],
  scope: "...",  // スコープ全文
  explicitUpdates: [
    { file: 'backend-design.md', section: '3.4', content: '...' }
  ],
  targetFiles: ['backend-design.md', 'frontend-design.md']
}
```

---

### Phase 2: 対象設計書の特定

#### ステップ 2-1: ラベルから候補設計書をマッピング

Phase 1で抽出したラベル情報から、対象設計書を推測:

**ラベルマッピングルール**:

```typescript
const labelToDesignDoc: Record<string, string[]> = {
  backend: ['backend-design.md'],
  frontend: ['frontend-design.md'],
  infra: ['infrastructure-design.md'],
  cdk: ['infrastructure-design.md'],
  test: ['test-specification.md'],
  docs: [] // ユーザーに確認
}
```

**推測ロジック**:

1. 各ラベルをマッピングルールで変換
2. 重複を除去
3. Issue内の明示的な言及（`docs/design/{filename}.md`）があればそれを優先
4. 対象ファイルセクションがあればそこから抽出

**結果例**:

```typescript
candidateDesignDocs = ['docs/design/backend-design.md', 'docs/design/test-specification.md']
```

#### ステップ 2-2: ユーザーに対象設計書を確認

AskUserQuestion ツールで確認:

**候補が1つ以上ある場合**:

```
question: "Issue #{番号} のラベル「{ラベル一覧}」から以下の設計書を更新対象として検出しました。この選択でよろしいですか？"
header: "設計書確認"
options: [
  { label: "はい、この設計書を更新します", description: "{候補ファイル一覧を列挙}" },
  { label: "変更する", description: "更新対象の設計書を手動で選択します" }
]
multiSelect: false
```

**候補が検出できない場合（ラベルが `docs` のみ等）**:

```
question: "Issue #{番号} のラベルから対象設計書を自動判定できませんでした。更新する設計書を選択してください。"
header: "設計書選択"
options: [
  { label: "backend-design.md", description: "バックエンド設計書" },
  { label: "frontend-design.md", description: "フロントエンド設計書" },
  { label: "infrastructure-design.md", description: "インフラ設計書" },
  { label: "test-specification.md", description: "テスト仕様書" }
]
multiSelect: true
```

**「変更する」が選択された場合**:

```
question: "更新する設計書を選択してください（複数選択可）。"
header: "設計書選択"
options: [
  { label: "backend-design.md", description: "バックエンド設計書" },
  { label: "frontend-design.md", description: "フロントエンド設計書" },
  { label: "infrastructure-design.md", description: "インフラ設計書" },
  { label: "test-specification.md", description: "テスト仕様書" }
]
multiSelect: true
```

#### ステップ 2-3: 対象設計書の存在確認

選択された設計書ファイルが実際に存在するか確認:

Glob ツールを使用:

```
pattern: "{選択されたファイル名}"
path: "docs/design/"
```

**エラーハンドリング**:

- ファイルが存在しない場合:

  ```
  Warning: 指定された設計書 {filename} が存在しません。

  以下から選択してください:
  ```

  Glob で `docs/design/*.md` を実行して一覧表示

  → AskUserQuestion で再選択を促す

**出力**:

```typescript
targetDesignDocs = ['docs/design/backend-design.md', 'docs/design/test-specification.md']
```

---

### Phase 3: 設計書構造の解析とセクション特定

各対象設計書について、以下の処理を実行:

#### ステップ 3-1: 設計書の読み込み

Read ツールで設計書を読み込み:

```
file_path: <対象設計書のパス>
```

#### ステップ 3-2: Markdownセクション構造の解析

読み込んだMarkdownからセクション構造を解析:

**解析アルゴリズム**:

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

#### ステップ 3-3: Issue内容から更新セクションを推測

Issue内容から更新すべきセクションを推測:

**推測方法**:

1. **明示的な指定がある場合**:
   - `{番号}節を更新` → そのセクション番号を使用
   - 例: `3.4.2節の認証設定を更新` → セクション `3.4.2`

2. **スコープ/作業項目からキーワード抽出**:
   - 「API仕様」「エンドポイント」→ `API仕様` セクション
   - 「テスト」→ `テスト` セクション
   - 「セキュリティ」→ `セキュリティ考慮事項` セクション

3. **推測できない場合**:
   - ユーザーに選択してもらう

#### ステップ 3-4: ユーザーに更新セクションを確認

AskUserQuestion ツールで確認:

```
question: "{設計書名} のどのセクションを更新しますか？\n\n現在の構造:\n{セクション一覧}"
header: "セクション選択"
options: [
  { label: "既存セクションを修正", description: "既存のセクション内容を更新します" },
  { label: "新規セクション追加", description: "新しいセクションを追加します" }
]
multiSelect: false
```

**「既存セクションを修正」が選択された場合**:

セクション一覧を表示し、セクション番号またはタイトルの入力を促す:

```
question: "修正するセクション番号またはタイトルを入力してください。\n\n例: 3.4 または「API仕様」"
header: "セクション入力"
options: [
  { label: "その他（手動入力）", description: "セクション番号またはタイトルを入力" }
]
```

**「新規セクション追加」が選択された場合**:

セクション番号とタイトルの入力を促す:

```
question: "追加するセクションの番号とタイトルを入力してください。\n\n例: 3.4 Discovery Endpoint"
header: "新規セクション"
options: [
  { label: "その他（手動入力）", description: "番号とタイトルを入力（例: 3.4 セクション名）" }
]
```

**入力バリデーション**:

- セクション番号形式: `\d+(?:\.\d+)*`
- 既存セクション番号との重複チェック
- 見出しレベルの整合性チェック

**エラーハンドリング**:

- セクション番号が存在しない（修正の場合）:

  ```
  Error: セクション {番号} は存在しません。

  利用可能なセクション:
  {セクション一覧}
  ```

  → 再入力を促す（最大3回まで）

- セクション番号が重複（新規追加の場合）:

  ```
  Error: セクション {番号} は既に存在します。

  既存のセクション {番号}: {タイトル}

  別の番号を指定するか、「既存セクションを修正」を選択してください。
  ```

  → 再入力を促す

**出力**:

```typescript
sectionUpdates = [
  {
    designDoc: 'docs/design/backend-design.md',
    updateType: 'add', // 'add' or 'modify'
    sectionNumber: '3.4',
    sectionTitle: 'Discovery Endpoint',
    existingSection: null // modify の場合は既存Section情報
  }
]
```

---

### Phase 4: 更新内容の対話的な決定

各設計書・各セクションについて、更新内容を決定:

#### ステップ 4-1: Issue内の明示的な更新内容を確認

Phase 1で抽出した `explicitUpdates` を確認:

**明示的な記載がある場合**:

```
検出された更新内容:
---
Issue #{番号} 「スコープ / 作業項目」より:

- {設計書名} に {内容} を追加
- {設計書名} の {番号}節を更新

---

この内容を更新に使用しますか？
```

AskUserQuestion で確認:

```
question: "Issue内に設計書更新の指示が記載されています。この内容をそのまま使用しますか？"
header: "更新内容確認"
options: [
  { label: "はい、この内容を使用します", description: "Issue記載の内容をそのまま使用" },
  { label: "編集する", description: "内容を編集・追記します" },
  { label: "手動で入力する", description: "新たに内容を入力します" }
]
multiSelect: false
```

#### ステップ 4-2: 更新内容の入力

**「編集する」または「手動で入力する」が選択された場合**:

AskUserQuestion で更新内容を入力:

```
question: "Issue #{番号} の内容:\n---\n{スコープの要約}\n---\n\n{設計書名} の「{セクションタイトル}」セクションに追加する内容を入力してください。\n\n推奨する記載項目:\n- エンドポイントパス / API仕様\n- HTTPメソッド\n- 目的・役割\n- レスポンス形式\n- 実装ファイル名\n- セキュリティ考慮事項（該当する場合）\n\nMarkdown形式で入力してください（複数行可）。"
header: "更新内容入力"
options: [
  { label: "その他（手動入力）", description: "Markdown形式で更新内容を入力" }
]
```

**入力例（ユーザーが入力する内容）**:

```markdown
### 3.4 GET /.well-known/openid-configuration

**目的:** OIDC Provider の Discovery 情報を提供

**実装ファイル:** `backend/src/handlers/discovery.ts`

**レスポンス例:**

\`\`\`json
{
"issuer": "https://cognito-idp.{region}.amazonaws.com/{userPoolId}",
"authorization_endpoint": "...",
"token_endpoint": "...",
"userinfo_endpoint": "...",
"jwks_uri": "..."
}
\`\`\`

**セキュリティ考慮事項:**

- Discoveryエンドポイントは認証不要（公開情報）
- CORS設定を適切に行う
```

#### ステップ 4-3: 更新内容のバリデーション

入力された内容をバリデーション:

**チェック項目**:

1. **Markdown構文の基本チェック**:
   - コードブロック（\`\`\`）の閉じ忘れ
   - 見出しレベルの整合性

2. **空入力のチェック**:
   - 空白のみの入力は不正

**エラーハンドリング**:

- 入力が空の場合:

  ```
  Warning: 更新内容が入力されていません。

  以下から選択してください:
  1. 更新内容を入力する
  2. このセクションの更新をスキップする
  3. コマンドを中断する
  ```

  AskUserQuestion で選択:

  ```
  options: [
    { label: "更新内容を入力する", description: "再度入力します" },
    { label: "スキップする", description: "このセクションは後で手動更新します" },
    { label: "中断する", description: "コマンドを終了します" }
  ]
  ```

- Markdown構文エラーがある場合:

  ```
  Warning: 入力内容にMarkdown構文エラーがあります。

  問題箇所:
  - コードブロックが閉じられていません（行 5）

  修正して再入力しますか？
  ```

  AskUserQuestion で確認し、再入力を促す

**出力**:

```typescript
sectionUpdates = [
  {
    designDoc: 'docs/design/backend-design.md',
    updateType: 'add',
    sectionNumber: '3.4',
    sectionTitle: 'Discovery Endpoint',
    newContent: '### 3.4 GET /.well-known/openid-configuration\n\n...'
  }
]
```

---

### Phase 5: 設計書の更新実行

各設計書について、決定した内容で更新を実行:

#### ステップ 5-1: 更新処理の実行

**新規セクション追加の場合（updateType: 'add'）**:

1. **挿入位置の決定**:

```typescript
function findInsertPosition(sections: Section[], targetNumber: string): number {
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
        if (
          !afterSection ||
          compareSectionNumbers(
            section.number.split('.').map(Number),
            afterSection.number.split('.').map(Number)
          ) > 0
        ) {
          afterSection = section
        }
      } else if (comparison > 0) {
        // このセクションはターゲットより後
        if (
          !beforeSection ||
          compareSectionNumbers(
            section.number.split('.').map(Number),
            beforeSection.number.split('.').map(Number)
          ) < 0
        ) {
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
    // どちらもない場合は末尾に追加
    return sections[sections.length - 1].endLine + 1
  }
}

function compareSectionNumbers(a: number[], b: number[]): number {
  const maxLen = Math.max(a.length, b.length)

  for (let i = 0; i < maxLen; i++) {
    const aVal = a[i] || 0
    const bVal = b[i] || 0

    if (aVal < bVal) return -1
    if (aVal > bVal) return 1
  }

  return 0
}
```

2. **内容の挿入**:

```typescript
const lines = markdown.split('\n')
const insertLine = findInsertPosition(sections, targetNumber)

// 前後に空行を入れて挿入
const insertContent = ['', ...newContent.split('\n'), '']
lines.splice(insertLine, 0, ...insertContent)

const updatedMarkdown = lines.join('\n')
```

**既存セクション修正の場合（updateType: 'modify'）**:

```typescript
function modifySection(markdown: string, sectionNumber: string, newContent: string): string {
  const lines = markdown.split('\n')
  const sections = parseSections(markdown)

  const targetSection = sections.find((s) => s.number === sectionNumber)
  if (!targetSection) {
    throw new Error(`セクション ${sectionNumber} が見つかりません`)
  }

  // セクションの見出し行は保持、内容のみ置換
  lines.splice(
    targetSection.startLine + 1,
    targetSection.endLine - targetSection.startLine,
    ...newContent.split('\n')
  )

  return lines.join('\n')
}
```

#### ステップ 5-2: Markdown整合性チェック

更新後のMarkdownの整合性をチェック:

**チェック項目**:

1. **コードブロックの閉じ忘れ**:

````typescript
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
````

2. **見出しレベルの整合性**:

```typescript
const sections = parseSections(updatedMarkdown)

for (let i = 1; i < sections.length; i++) {
  const prev = sections[i - 1]
  const curr = sections[i]

  // H2の次にH4はNG（H3を飛ばしている）
  if (curr.level > prev.level + 1) {
    errors.push({
      line: curr.startLine,
      message: `見出しレベルが不正です (H${prev.level} の次に H${curr.level} は使えません)`,
      severity: 'error'
    })
  }
}
```

3. **セクション番号の連番チェック（警告レベル）**:

```typescript
const numberedSections = sections.filter((s) => s.number)

for (let i = 1; i < numberedSections.length; i++) {
  const prev = numberedSections[i - 1].number.split('.').map(Number)
  const curr = numberedSections[i].number.split('.').map(Number)

  // 同じ階層レベルの場合
  if (prev.length === curr.length) {
    const expectedNext = [...prev]
    expectedNext[expectedNext.length - 1]++

    // 次のセクションが連番でない場合は警告
    if (curr[curr.length - 1] !== expectedNext[expectedNext.length - 1]) {
      errors.push({
        line: numberedSections[i].startLine,
        message: `セクション番号が連番ではありません (${prev.join('.')} の次は ${expectedNext.join('.')} が推奨されます)`,
        severity: 'warning'
      })
    }
  }
}
```

**エラーハンドリング**:

- エラー（severity: 'error'）が検出された場合:

  ```
  Error: 更新後の設計書にMarkdown構文エラーが検出されました。

  問題箇所:
  - Line {行番号}: {エラーメッセージ}

  修正して再試行しますか？
  ```

  AskUserQuestion で確認:

  ```
  options: [
    { label: "修正する", description: "更新内容を修正します" },
    { label: "無視して続行", description: "エラーを無視して保存します（非推奨）" },
    { label: "中断する", description: "コマンドを終了します" }
  ]
  ```

  「修正する」→ Phase 4に戻る
  「無視して続行」→ 次のステップへ
  「中断する」→ 処理を中止

- 警告（severity: 'warning'）が検出された場合:

  ```
  Warning: 以下の警告が検出されました。

  - Line {行番号}: {警告メッセージ}

  続行してよろしいですか？
  ```

  → 次のステップへ（自動承認）

#### ステップ 5-3: 差分表示とユーザー確認

更新内容の差分を表示してユーザーに最終確認:

**差分表示フォーマット**:

```
=== {設計書名} の更新内容 ===

@@ Section {セクション番号} {更新タイプ} @@

{更新タイプ が 'add' の場合}
+ ### {セクション番号} {セクションタイトル}
+
+ {新規コンテンツ（各行の先頭に + を付ける）}

{更新タイプ が 'modify' の場合}
  ### {セクション番号} {セクションタイトル}（見出しは保持）
- {削除される旧コンテンツ（各行の先頭に - を付ける）}
+ {追加される新コンテンツ（各行の先頭に + を付ける）}

---
```

AskUserQuestion で確認:

```
question: "この内容で {設計書名} を更新してよろしいですか？"
header: "最終確認"
options: [
  { label: "はい、更新します", description: "設計書を保存します" },
  { label: "編集する", description: "内容を修正します" },
  { label: "スキップする", description: "この設計書の更新をスキップします" }
]
multiSelect: false
```

**分岐処理**:

- 「はい、更新します」→ ステップ 5-4へ
- 「編集する」→ Phase 4に戻る
- 「スキップする」→ 次の設計書へ（または Phase 6へ）

#### ステップ 5-4: ファイル書き込み

Write ツールで設計書を保存:

```
file_path: <対象設計書のパス>
content: <更新後のMarkdown>
```

**エラーハンドリング**:

- ファイル書き込み失敗の場合:

  ```
  Error: 設計書の保存に失敗しました。

  ファイル: {設計書パス}
  エラー: {エラーメッセージ}

  書き込み権限があるか確認してください。
  ```

  → 処理を中止

**出力**:

```typescript
updatedFiles = [
  {
    path: 'docs/design/backend-design.md',
    sectionNumber: '3.4',
    updateType: 'add'
  }
]
```

---

### Phase 6: 更新結果の報告とNext Action提案

#### ステップ 6-1: 成功メッセージの表示

更新完了を報告:

```
=== 設計書更新完了 ===

✓ Issue #{番号} に基づいて設計書を更新しました

更新されたファイル:
- {設計書名} (Section {セクション番号} を{更新タイプ})
- {設計書名} (Section {セクション番号} を{更新タイプ})
...

{Markdown整合性チェックで警告があった場合}
⚠️ 以下の警告が検出されました:
- Line {行番号}: {警告メッセージ}
```

#### ステップ 6-2: Next Actions提案

次のステップを提案:

```
Next Actions:
1. /doc-reviewer で設計書の整合性をチェック（推奨）
2. 人間による設計書レビュー（CLAUDE.md 開発フロー Step 5）
3. レビュー完了後、/dev で実装開始

関連コマンド:
- /doc-reviewer: 設計書レビュー
- /dev: 実装フロー実行
```

#### ステップ 6-3: (オプション) doc-reviewer自動実行の提案

AskUserQuestion で doc-reviewer の実行を提案:

```
question: "/doc-reviewer を実行して更新後の設計書をチェックしますか？"
header: "次のアクション"
options: [
  { label: "はい、実行します", description: "設計書の整合性チェックを実行" },
  { label: "いいえ、後で実行します", description: "手動で実行します" }
]
multiSelect: false
```

**分岐処理**:

- 「はい、実行します」→ Skill ツールで `doc-reviewer` を呼び出し
- 「いいえ、後で実行します」→ 完了メッセージのみ表示

**最終出力例**:

```
=== 設計書更新完了 ===

✓ Issue #15 に基づいて設計書を更新しました

更新されたファイル:
- docs/design/backend-design.md (Section 3.4 を新規追加)

Next Actions:
1. /doc-reviewer で設計書の整合性をチェック（推奨）
2. 人間による設計書レビュー（CLAUDE.md 開発フロー Step 5）
3. レビュー完了後、/dev で実装開始

---

設計書更新が完了しました。
CLAUDE.md の開発フローに従い、次は人間によるレビューを実施してください。
```

---

## エラーハンドリング一覧

| エラー条件                         | 判定方法                   | 処理内容                                            |
| ---------------------------------- | -------------------------- | --------------------------------------------------- |
| Issueファイルが見つからない        | Globが空結果               | 利用可能なIssue一覧を表示して再入力（最大3回）      |
| Issueファイルが空                  | Readで空内容確認           | エラーメッセージ表示して中止                        |
| 対象設計書が自動判定できない       | ラベルマッピングで候補なし | ユーザーに4つの設計書から選択させる                 |
| 設計書ファイルが存在しない         | Globが空結果               | 警告表示して再選択                                  |
| セクション番号が存在しない（修正） | セクション一覧に該当なし   | 利用可能なセクション一覧を表示して再入力（最大3回） |
| セクション番号が重複（新規追加）   | セクション一覧に既存       | 別の番号指定または「修正」選択を促す                |
| 更新内容が空                       | 入力文字列が空白のみ       | 「入力」「スキップ」「中断」の選択肢提示            |
| Markdown構文エラー                 | 整合性チェックでエラー検出 | 修正して再試行を提案（最大3回）                     |
| ファイル書き込み失敗               | Writeがエラー              | エラーメッセージ表示して中止                        |
| 不正な入力（3回連続）              | 再入力カウンター = 3       | 処理を中止                                          |

---

## 制約事項

1. **ADRファイルは更新対象外**
   - `docs/adr/` 配下のファイルは本コマンドでは更新しません
   - 設計書からの参照のみ

2. **複数人での同時編集は想定外**
   - gitコンフリクトが発生する可能性があります
   - 更新前に `git status` で確認することを推奨

3. **設計書の大幅な構造変更は手動推奨**
   - セクション順序の入れ替え
   - セクション番号の大規模な振り直し
   - → 本コマンドでは対応しません

4. **パフォーマンス考慮**
   - 大きな設計書（10,000行超）はセクション解析に時間がかかる可能性
   - → 初回解析結果を内部でキャッシュします

5. **更新履歴の管理**
   - gitのコミット履歴で管理
   - 明示的な「更新履歴」セクションは設計書に追加しません

---

## テスト観点（エージェント実装後の検証用）

### 正常系

1. **単一設計書の新規セクション追加**
   - Issue #15 → backend-design.md に Section 3.4 追加
   - Markdown整合性が保たれる

2. **複数設計書の同時更新**
   - Issue #13 → backend-design.md と infrastructure-design.md を更新

3. **既存セクションの修正**
   - Section 3.2 の内容を更新
   - セクション番号とタイトルが保持される

### 異常系

4. **存在しないIssue番号**
   - Issue #999 → 一覧表示して再入力

5. **空のIssue内容**
   - エラーメッセージ表示して中止

6. **Markdown構文エラー**
   - コードブロック未閉 → エラー検出と修正提案

7. **不正なセクション番号**
   - Section 99.99 → 再入力を促す

### エッジケース

8. **深いネストレベル（H6まで）**
   - Section 1.2.3.4.5.6 → 正しく解析される

9. **セクション番号が連番でない**
   - 3.3 → 3.5 → 警告表示（エラーではない）

10. **設計書が非常に大きい（10,000行超）**
    - 解析に時間がかかるが正常完了
