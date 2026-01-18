---
globs: cdk/**/*
---

# CDK 実装ルール

## Construct レベル

- 可能な限り L2 Construct（High-level API）を使用すること
- IAM Role は L2 Construct の自動生成機能を活用し、明示的な Role 定義は避けること
- コードが長くなりすぎる場合は、必要に応じて L3 Construct（カスタム Construct）を作成すること

## import 形式

aws-cdk-lib のサービスモジュールは以下の形式で統一すること：

```typescript
// ✅ 正しい形式
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { aws_cognito as cognito } from 'aws-cdk-lib';

// ❌ 避けるべき形式
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Bucket } from 'aws-cdk-lib/aws-s3';
```

## import 順序の例

```typescript
// 1. 標準ライブラリ
import * as path from 'path';

// 2. サードパーティライブラリ（CDK 含む）
import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { aws_lambda_nodejs as nodejs } from 'aws-cdk-lib';
import { aws_cognito as cognito } from 'aws-cdk-lib';
import { aws_apigatewayv2 as apigw } from 'aws-cdk-lib';
import { aws_cloudfront as cloudfront } from 'aws-cdk-lib';
import { Construct } from 'constructs';

// 3. 自作モジュール
import { AppParameter } from '../parameter';
```
