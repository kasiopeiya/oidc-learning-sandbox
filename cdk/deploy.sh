#!/bin/bash
#
# フロントエンドビルドとCDKデプロイを統合するスクリプト
#
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== OIDC Sandbox Deploy Script ==="

# フロントエンドのビルド
echo ""
echo "[1/2] Building frontend..."
if [ -d "$PROJECT_ROOT/frontend" ]; then
  cd "$PROJECT_ROOT/frontend"
  npm run build
  echo "Frontend build completed."
else
  echo "Frontend directory not found. Skipping frontend build."
fi

# CDKデプロイ
echo ""
echo "[2/2] Deploying CDK stack..."
cd "$SCRIPT_DIR"
npx cdk deploy "$@"

echo ""
echo "=== Deploy completed ==="
