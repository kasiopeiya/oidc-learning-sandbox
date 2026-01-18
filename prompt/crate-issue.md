Issueアウトライン表を元に、Issue本文を生成し、mdファイルとして作成してください。

### ソース

- Issueアウトライン表は `docs/implementation-plan.md`です。
- `docs/` 配下の設計ドキュメントを必ず参照してください。

### 対象

- Issue番号: #{{ISSUE_NUMBER}}

### 出力要件

1. 出力は **```markdown filename=docs/issues/{{ISSUE_NUMBER}}-{{kebab-case-title}}.md** のコードブロックのみ（囲み外に余計な文章は禁止）
2. 先頭行の `filename=` で保存先を指定する（例: `filename=docs/issues/1-project-setup.md`）
3. ACは3〜7項目、`- [ ]` 形式で展開
4. kebab-case ルール: 小文字/数字のみ、スペースや記号はハイフンに変換、日本語はローマ字変換か短縮してもよい
5. 依存Issueは `#1, #2` のように列挙

### ISSUE_TEMPLATE

### 背景 / 目的

{{1〜2文で理由}}

- 依存:
- ラベル:

### スコープ / 作業項目

### ゴール / 完了条件（Acceptance Criteria）

- [ ] {{AC1}}
- [ ] {{AC2}}
- [ ] {{AC3}}

### テスト観点

＊初期構築時はこのセクションは不要

- （ユニット / リクエスト / E2E など）
- 検証方法:

（必要なら）要確認事項:

- {{疑問点やTODO}}
