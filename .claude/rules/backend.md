---
globs: backend/**/*
---

# Backend 実装ルール

- 各処理ステップに日本語コメントを入れること
- State、Nonce、PKCE の生成・検証には詳細なコメントを記載すること

## import 順序の例

```typescript
// 1. 標準ライブラリ
import * as crypto from 'crypto';

// 2. サードパーティライブラリ
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// 3. 自作モジュール
import { generateState, verifyState } from './utils/state';
```
