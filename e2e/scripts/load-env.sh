#!/bin/bash

# CDK スタックの出力値を環境変数として設定するスクリプト
#
# 使用方法:
#   source scripts/load-env.sh
#
# 注意: このスクリプトは source コマンドで実行する必要があります。
#       ./scripts/load-env.sh として実行すると、環境変数が現在のシェルに設定されません。

set -e

STACK_NAME="oidc-sandbox-app"

echo "📦 CDKスタック '${STACK_NAME}' から出力値を取得中..."

# CloudFormation スタックの出力値を取得
OUTPUTS=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --query "Stacks[0].Outputs" \
  --output json 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$OUTPUTS" ] || [ "$OUTPUTS" = "null" ]; then
  echo "❌ スタック '${STACK_NAME}' の出力値を取得できませんでした。"
  echo "   スタックがデプロイされているか確認してください。"
  echo "   実行コマンド: cd cdk && npx cdk deploy"
  return 1 2>/dev/null || exit 1
fi

# 各出力値を環境変数として設定
# jq を使用して JSON をパース

# CloudFront URL
CLOUDFRONT_URL=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="CloudFrontUrl") | .OutputValue')
if [ -n "$CLOUDFRONT_URL" ] && [ "$CLOUDFRONT_URL" != "null" ]; then
  export CLOUDFRONT_URL
  echo "✅ CLOUDFRONT_URL=${CLOUDFRONT_URL}"
else
  echo "⚠️  CloudFrontUrl が見つかりません"
fi

# User Pool ID
USER_POOL_ID=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="UserPoolId") | .OutputValue')
if [ -n "$USER_POOL_ID" ] && [ "$USER_POOL_ID" != "null" ]; then
  export USER_POOL_ID
  echo "✅ USER_POOL_ID=${USER_POOL_ID}"
else
  echo "⚠️  UserPoolId が見つかりません"
fi

# User Pool Client ID
USER_POOL_CLIENT_ID=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="UserPoolClientId") | .OutputValue')
if [ -n "$USER_POOL_CLIENT_ID" ] && [ "$USER_POOL_CLIENT_ID" != "null" ]; then
  export USER_POOL_CLIENT_ID
  echo "✅ USER_POOL_CLIENT_ID=${USER_POOL_CLIENT_ID}"
else
  echo "⚠️  UserPoolClientId が見つかりません"
fi

# Cognito Domain（オプション、デバッグ用）
COGNITO_DOMAIN=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="CognitoDomain") | .OutputValue')
if [ -n "$COGNITO_DOMAIN" ] && [ "$COGNITO_DOMAIN" != "null" ]; then
  export COGNITO_DOMAIN
  echo "✅ COGNITO_DOMAIN=${COGNITO_DOMAIN}"
fi

echo ""
echo "🎉 環境変数の設定が完了しました。"
echo "   テストを実行するには: npm test"
