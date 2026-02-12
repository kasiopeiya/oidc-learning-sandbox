#!/bin/bash
# docs/issues/*.md を GitHub Issues に一括移行するスクリプト
# 実行前提: gh CLI がインストール済みで認証済みであること

set -e

ISSUES_DIR="docs/issues"
ARCHIVED_DIR="docs/issues-archived"

# gh CLI の確認
if ! command -v gh &> /dev/null; then
  echo "エラー: gh CLI がインストールされていません"
  exit 1
fi

# GitHub 認証確認
if ! gh auth status &> /dev/null; then
  echo "エラー: gh CLI で GitHub 認証が完了していません。'gh auth login' を実行してください"
  exit 1
fi

echo "=== GitHub Issues 移行スクリプト ==="
echo "対象: $ISSUES_DIR/*.md"
echo ""

# 必要なラベルを事前に収集・作成
echo "--- ラベルの準備 ---"
ALL_LABELS=$(grep -h '^- ラベル:' "$ISSUES_DIR"/*.md 2>/dev/null | sed 's/- ラベル: //' | tr ',' '\n' | tr -d ' ' | sort -u)

for label in $ALL_LABELS; do
  if [ -z "$label" ] || [ "$label" = "-" ]; then
    continue
  fi
  if gh label list --json name --jq '.[].name' | grep -q "^${label}$"; then
    echo "  ラベル存在済み: $label"
  else
    gh label create "$label" --color "#ededed" 2>/dev/null && echo "  ラベル作成: $label" || echo "  ラベル作成スキップ: $label"
  fi
done
echo ""

# 各 issue ファイルを GitHub Issues に移行
echo "--- Issue の移行 ---"
SUCCESS=0
FAIL=0

for file in $(ls "$ISSUES_DIR"/*.md | sort -V); do
  # タイトルを1行目から抽出（"# Issue #XX: タイトル" → "タイトル"）
  TITLE=$(head -1 "$file" | sed 's/^# //')

  # ラベルを抽出（"- ラベル: backend, infrastructure" → "backend,infrastructure"）
  RAW_LABELS=$(grep '^- ラベル:' "$file" | sed 's/- ラベル: //' | tr -d ' ')
  LABELS=$(echo "$RAW_LABELS" | tr ',' '\n' | grep -v '^-$' | grep -v '^$' | tr '\n' ',' | sed 's/,$//')

  # issue 本文（ファイル全体）
  BODY=$(cat "$file")

  echo "  作成中: $TITLE"

  # GitHub Issues に作成
  if [ -n "$LABELS" ]; then
    ISSUE_URL=$(gh issue create \
      --title "$TITLE" \
      --body "$BODY" \
      --label "$LABELS" 2>&1)
  else
    ISSUE_URL=$(gh issue create \
      --title "$TITLE" \
      --body "$BODY" 2>&1)
  fi

  if [ $? -eq 0 ]; then
    echo "    -> $ISSUE_URL"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "    -> 失敗: $ISSUE_URL"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "=== 移行完了 ==="
echo "  成功: $SUCCESS 件"
echo "  失敗: $FAIL 件"
echo ""

# docs/issues/ をアーカイブ
if [ $SUCCESS -gt 0 ]; then
  echo "--- ローカルファイルのアーカイブ ---"
  mv "$ISSUES_DIR" "$ARCHIVED_DIR"
  mkdir -p "$ISSUES_DIR"
  echo "  $ISSUES_DIR → $ARCHIVED_DIR に移動しました"
  echo "  空の $ISSUES_DIR ディレクトリを作成しました（今後は使用しません）"
fi
