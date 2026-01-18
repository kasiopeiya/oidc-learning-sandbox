---
globs: frontend/**/*
---

# Frontend 実装ルール

- 各処理ステップに日本語コメントを入れること

## import 順序の例

```typescript
// 1. サードパーティライブラリ（該当する場合）

// 2. 自作モジュール
import { redirectToLogin } from './auth';
```
