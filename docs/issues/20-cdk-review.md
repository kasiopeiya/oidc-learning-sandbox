# Issue #20: CDK専用コードレビューコマンド `/cdk-review` 実装計画

### 関連ドキュメント

- 📝 Plan: [cdk-review.md](../plan/cdk-review.md)

## 📂 コンテキスト (Context)

> Claudeが調査を開始する起点となるファイルやディレクトリを指定します

- `.claude/skills/review/SKILL.md` - 既存の `/review` スキルの構造パターン
- `.claude/agents/code-reviewer-agent/code-reviewer-agent.md` - 既存エージェントの詳細な実行プロセス
- `.claude/rules/cdk.md` - CDKルール（レビュー観点に反映）
- `docs/design/infrastructure-design.md` - CDK設計思想（スタック分割の観点に活用）
- `cdk/lib/oidc-sandbox-stack.ts` - 既存のスタック実装（レビュー観点の検証）

### 背景 / 目的

現在、`/review` コマンドは Backend と Frontend の TypeScript コードのレビューに対応していますが、CDKコード（`cdk/**/*.ts`）は明示的に除外されています。CDKコードには Infrastructure as Code 特有のベストプラクティス（L2 Construct の優先利用、宣言的記述、スタック分割の適切さなど）があり、これらを専門的にチェックするコマンドが必要です。

**解決したい課題**:

1. CDK特有のベストプラクティスをチェックできない（既存の `/review` は汎用的なTypeScriptレビュー）
2. プロジェクトルール（`.claude/rules/cdk.md`）の準拠度を自動チェックしたい
3. 仕様駆動開発フローの Step 6.2 をサポート（`/cdk-dev` でインフラ実装した後のコードレビュー工程を自動化）

- ラベル: cdk, review, skill

### スコープ / 作業項目

#### 基本方針

既存の `/review` スキルの優れた設計パターン（スキルとエージェントの分離、5つのPhase、出力フォーマット）を完全に踏襲しつつ、**CDK特有の17項目のレビュー観点**を追加します。

#### レビュー観点（17項目、51点満点）

**TypeScript共通観点（8項目、24点満点）**:

1. 型安全性（`any`の使用、型アサーション）
2. 命名規則（変数名、関数名、Construct IDのパスカルケース）
3. 単一責任（Constructの責務の明確性）
4. 重複コード（DRY原則の遵守）
5. コメント（WHYコメント、日本語）
6. エラーハンドリング
7. セキュリティ（ハードコード、環境変数の扱い）
8. Import順序（CDKルールに準拠）

**CDK固有観点（9項目、27点満点）**: 9. 宣言的記述（ifなどの制御構文の多用を避ける）10. L2 Construct優先（L2優先、L1使用時は理由記載）11. Import形式統一（`aws_* as service` 形式）12. IAM自動生成活用（grant\*メソッド活用、明示的Role避ける）13. リソース名自動生成（不必要にリソース名を指定しない）14. RemovalPolicy明示（Statefulリソースに適切に設定）15. Construct ID規則（メインリソースIDが`Resource`/`Default`）16. スタック分割の適切さ（デプロイ単位として適切に分割）17. 循環参照の検出（リソース間の依存関係に循環がないか）

#### 実行フロー（Phase 1〜5）

**Phase 1**: ファイル検出とインタラクティブ選択

- CDKファイル（`cdk/**/*.ts`）を検出、種別分類（App/Stack/Construct/Parameter）
- テストファイル、node_modulesを除外
- ユーザーにファイルを選択させる

**Phase 2**: コード種別の判定

- ファイルパスから種別を判定（App/Stack/Construct/Parameter）

**Phase 3**: レビュー観点の定義

- 17項目の観点を定義

**Phase 4**: レビュー実行

- ファイル内容の取得（Read）
- 変更履歴の確認（git log）
- 各観点のチェック（Grep、Read結果分析）
- CDKリソース数のカウント
- 依存関係グラフの生成
- スコアリング（51点満点）

**Phase 5**: 結果出力

- 総合評価（スコア、レベル）
- CDKリソース情報
- 良い点（最低3つ）
- 改善が必要な点（Critical/Recommended/Suggested）
- CDKルールへの準拠状況
- 依存関係グラフ
- 次のステップ（優先度付き）

### ゴール / 完了条件（Acceptance Criteria）

- [ ] `.claude/skills/cdk-review/SKILL.md` を作成（コマンド説明、17項目の観点リスト、使用方法を記載）
- [ ] `.claude/agents/cdk-reviewer-agent/cdk-reviewer-agent.md` を作成（Phase 1〜5の詳細な実行プロセスを記載）
- [ ] `/cdk-review` コマンドでCDKファイル一覧が種別ごとに表示されることを確認
- [ ] ファイル選択後、17項目のレビュー観点がすべてチェックされることを確認
- [ ] TypeScript共通観点（8項目）が正しく評価されることを確認
- [ ] CDK固有観点（9項目）が正しく評価されることを確認
- [ ] レビューレポートが所定のフォーマット（総合評価、良い点、改善点、CDKルール準拠、依存関係グラフ、次のステップ）で出力されることを確認
- [ ] スコアリングが51点満点で正しく計算されることを確認
- [ ] 既存のスタックファイル（`cdk/lib/oidc-sandbox-stack.ts`）をレビューして、L2 Construct使用、Import形式、日本語コメント、スタック分割の適切さ、循環参照の検出が正しく機能することを確認
- [ ] CDKリソース数（Construct、Lambda、S3、DynamoDB等）が正しくカウントされることを確認
- [ ] 依存関係グラフが生成され、循環参照チェックが動作することを確認
- [ ] 具体的な改善コード例が提示され、「なぜこの改善が必要か」が説明されることを確認

### テスト観点

#### 1. スキルとエージェントの作成

- `.claude/skills/cdk-review/SKILL.md` を作成
- `.claude/agents/cdk-reviewer-agent/cdk-reviewer-agent.md` を作成

#### 2. 動作確認

```bash
# スキルを実行
/cdk-review
```

**期待される動作**:

1. ファイル一覧が表示される（App/Stack/Parameter種別ごと）
2. ファイルを選択できる（番号またはパス入力）
3. レビューレポートが生成される（17項目、51点満点）
4. 良い点3つ以上、改善点（Critical/Recommended/Suggested）、CDKルール準拠状況、依存関係グラフ、次のステップが含まれる

#### 3. レビュー品質の確認

既存のスタックファイル（`cdk/lib/oidc-sandbox-stack.ts`）をレビューして、以下をチェック:

- L2 Construct使用を評価できているか
- Import形式（`aws_* as service`）を検出できているか
- 日本語コメントの充実度を評価できているか
- スタック分割の適切さをADRと照らし合わせて評価できているか
- 循環参照の検出ができているか（依存関係グラフ生成）
- CDKリソース数をカウントできているか
- 具体的な改善コード例が提示されているか

#### 4. エラーハンドリングの確認

- 存在しないファイルを選択した場合のエラーメッセージ
- 空ファイルの場合のエラーメッセージ
- キャンセル時の正常終了

（必要なら）要確認事項:

- （なし）
