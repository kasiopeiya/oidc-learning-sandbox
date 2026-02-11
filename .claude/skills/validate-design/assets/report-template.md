# Design Validation Report Template

## すべて整合の場合

```
=== Design Validation Report ===

検証対象:
  - Backend: docs/design/backend-design.md    ← 検証対象の場合のみ記載
  - Frontend: docs/design/frontend-design.md  ← 検証対象の場合のみ記載

検証結果: ✅ すべて整合

検証項目:
  ✓ {カテゴリ}: {検証項目名} ({整合数}/{総数})
  ✓ ...

すべての検証項目で整合性が確認されました。
```

## 不整合を検出した場合

```
=== Design Validation Report ===

検証対象:
  - {Backend|Frontend}: {設計書パス}

検証結果: ⚠️ 不整合を検出

不整合の詳細:

📝 {カテゴリ}: {検証項目名}

{連番}. {問題の説明} [{ERROR|WARNING}]
   - {対象種別}: {名前/値}
   - 設計書: {パス} ({セクション参照})
   - 実装: {ファイルパス}
   - 推奨対応: {修正内容}
   ※ セキュリティ問題の場合は「- セキュリティ影響: {影響内容}」を追加

---

整合性のある項目:
  ✓ {カテゴリ}: {検証項目名} ({整合数}/{総数})
  ✗ {カテゴリ}: {検証項目名} ({整合数}/{総数} - {N}件不整合)
  ⚠ {カテゴリ}: {検証項目名} ({整合数}/{総数} - {N}件警告)

推奨アクション:
{連番}. {修正内容}
    ※ セキュリティ問題の場合は先頭に「🔒 [セキュリティ] 」を付ける
```

## Backend と Frontend の両方を検証した場合（サマリー付き）

```
=== Design Validation Report ===

検証対象:
  - Backend: docs/design/backend-design.md
  - Frontend: docs/design/frontend-design.md

検証結果: ⚠️ 不整合を検出  ← または ✅ すべて整合

サマリー:
  - Backend: {N}件の不整合  ← または「整合性あり」
  - Frontend: {N}件の不整合 ← または「整合性あり」

---

## Backend の検証結果

{上記の「不整合を検出した場合」または「すべて整合の場合」の形式を適用}

---

## Frontend の検証結果

{上記の「不整合を検出した場合」または「すべて整合の場合」の形式を適用}
```
