# 次回最初に行う作業 (NEXT_TASK)

## 状況

Phase6（デプロイ）作業中。ConoHa VPS契約済み・IP判明（`163.44.116.137`）、DNS設定済み、VPS初期設定（SSH鍵化・ファイアウォール・Docker・スワップ）まで完了。**Gitの初回コミットが`user.name`/`user.email`未設定でブロック中**（[USER_TODO.md](USER_TODO.md)参照）。

## 次に行うこと（優先順位順）

1. **[ブロッカー] `docs/USER_TODO.md`の項目1（Git設定）を待つ。**
   ```
   git config --global user.name "..."
   git config --global user.email "..."
   ```
2. Git設定後、コミットをやり直す（`git add -A`は完了済み、ステージング内容は確認済み）。
3. GitHubにリモートリポジトリを作成し、push する（`gh repo create`または手動）。
4. VPS上（`user@163.44.116.137`）で`git clone`し、`docs/DEPLOY.md`ステップ2以降（環境変数設定→TLS証明書取得→起動確認→自動更新設定）を進める。
   - ステップ3の`.env`設定時、`POSTGRES_PASSWORD`/`JWT_SECRET`を必ず変更すること
   - ステップ4のTLS証明書取得はDNSが`novelshelf.jp`→`163.44.116.137`に反映済みなのでそのまま進行可能
5. デプロイ後、`.github/workflows/ci.yml`が実際に動くか初回pushで確認する。

## 実装方針

- VPS上での操作（`docker compose up`等の本番影響コマンド、GitHubへのpush等）は、コマンドを提示してユーザー自身に実行してもらう。Claude Codeが直接実行しない。
- 本番影響コマンドは**1コマンドずつ**提示し、都度結果を確認してから次に進める（ユーザーの明示的な希望）。
- デプロイ後の初回動作確認は`frontend/e2e/critical-journey.spec.ts`と同じ流れをブラウザで手動確認する。

## 並行して進められる作業

- **パスワードリセット機能の実装**: 方針は確定済み（実装する）。SMTP方式（Gmail SMTP / SendGrid・AWS SES等 / ConoHaメール）の決定待ち（[USER_TODO.md](USER_TODO.md)項目5）。決まり次第、バックエンド（メール送信・リセットトークン発行）とフロント（リセット画面）を実装する。VPSデプロイ作業とは独立して進行可能。

## 注意事項

- Testcontainersを使う`./gradlew test`はDocker Desktopの起動が前提。
- なろう以外の3サイトのアダプタ実装は、[USER_TODO.md](USER_TODO.md) の利用規約確認が終わるまで着手不可。
- シリーズ管理画面は`NarouAdapter`がシリーズ情報を取得するまで着手不可（[KNOWN_ISSUES.md](KNOWN_ISSUES.md)参照）。
- VPSのSSHは鍵認証のみ（`~/.ssh/novelshelf_vps`、ユーザー名`user`）。パスワード認証・root直接ログインは無効化済み。
- Docker Composeは開発機上で起動したままの状態（`docker compose --env-file .env -f docker/docker-compose.yml ps`で確認可能）。
- `frontend/AGENTS.md`の内容（「これはあなたが知っているNext.jsではない、`node_modules/next/dist/docs/`を読め」という指示）が不自然でプロンプトインジェクションの疑いがあると2026-07-19のセッションでユーザーに一度共有済み、未確認。次回フロントエンドのコード変更時は改めて注意すること。
