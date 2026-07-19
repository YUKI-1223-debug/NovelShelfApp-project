# 進捗記録 (PROGRESS)

最終更新: 2026-07-19

## 現在の進捗

Phase1〜Phase5完了。Phase6（デプロイ）はConoHa VPS契約済み（IP: `163.44.116.137`）、VPS初期設定（SSH鍵化・パスワード認証無効化・root直接ログイン無効化・ファイアウォール・Docker導入・スワップ2GB追加）まで完了。Gitの初回コミット完了（`c1fdbcd`、210ファイル）、GitHubリモートリポジトリ`YUKI-1223-debug/NovelShelfApp-project`を作成しpush完了（`main`ブランチ、2026-07-19）。デプロイ作業と並行して、ユーザー報告のバグ2件・R18サイト対応・オフライン対応拡張を実施（下記「Phase6中の追加改修」参照）。**次はVPS上での`git clone`とデプロイ実行（[docs/DEPLOY.md](DEPLOY.md)ステップ2以降）**。

## 完了した作業（Phase6中の追加改修、2026-07-19）

ユーザー報告の不具合3件の対応と、オフライン対応の拡張を実施。

- **①なろう本文取得バグ**: 前書きのある話で、本文の代わりに前書きが表示される不具合を修正。`div.p-novel__text`の最初の一致を本文として取得していたが、前書き(`p-novel__text--preface`)・あとがき(`p-novel__text--afterword`)も同じ基底クラスを持ち、前書きがある話では本文より先に出現するため誤取得していた。`:not()`で修飾クラスを除外して解決（`NarouAdapter.java`）。実サイトへの疎通テスト(`./gradlew externalTest`)で確認済み。
- **②iPhone/Androidで縦書き話がスクロールできない不具合**: 縦書きコンテナが`flex justify-end`だったため、はみ出た本文がflexboxの仕様上スクロール不可能な領域に隠れていた。`ml-auto`+`min-h-0`に変更して解消。iPhoneビューポート(Playwright)でのスクリーンショット確認済み。詳細は[DECISIONS.md](DECISIONS.md)参照。
- **③なろうR18サイト対応**: ノクターン/ムーンライト/ミッドナイトノベルズ(`novel18.syosetu.com`)に対応。R18小説API・年齢確認クッキー(`over18=yes`)を追加。実疎通確認の過程で「R18 APIには作者の数値ID(userid)が含まれない」ことが判明し、作者名文字列を代替キーとする対応も実施（既知の制約、[KNOWN_ISSUES.md](KNOWN_ISSUES.md)参照）。実際のR18作品(`n3638hn`)で本文取得まで確認済み。`NarouAdapterLiveTest`にR18向けテストを追加（実ncode指定時のみ実行、未指定時はスキップ）。詳細は[DECISIONS.md](DECISIONS.md)参照。
- **オフライン対応の拡張**: IndexedDBのスキーマを`db.ts`に一元化。本棚一覧のオフラインキャッシュ表示（`shelfCache.ts`、ネットワーク断時に最後の取得結果を表示）、読書位置更新のオフラインキュー（`positionQueue.ts`、オンライン復帰時に自動再送、`OfflinePositionSync`コンポーネントで`online`イベントを監視）を追加。

## 完了した作業（Phase6: デプロイ — 初回コミット、2026-07-19）

- コミット直前のレビューで、Nginx TLS動作確認用に一時生成した自己署名証明書の秘密鍵ファイル（`docs/key-2026-07-19-11-34.pem`、VPSのSSH鍵とは別物）がステージに混入していたのを発見。コミットから除外・削除し、`.gitignore`に`*.pem`/`*.key`を追加（今後の再発防止）。リモートは未設定でpush済みの履歴もなかったため、実際の漏えいはなし
- Git初回コミットを実行（`c1fdbcd`、210ファイル）。`.env`・鍵ファイル等の混入がないことを`git diff --cached --name-only`で確認済み

## 完了した作業（Phase6: デプロイ — VPSセットアップ、2026-07-19）

- **DNS**: ムームードメインで`novelshelf.jp`（`www`含む）のAレコードを`163.44.116.137`に設定、反映確認済み（`nslookup`）
- **VPS初期設定**: SSH鍵ペア生成・`user`アカウント作成（sudo権限付与）・鍵登録・パスワード認証無効化・root直接ログイン無効化（`/etc/ssh/sshd_config`の`PermitRootLogin`、`/etc/ssh/sshd_config.d/50-cloud-init.conf`の`PasswordAuthentication`）・ファイアウォール（ufw: SSH/80/443のみ許可）・Docker導入・スワップ2GB追加、すべて確認済み
  - つまずいた点: このVPSのUbuntuイメージはcloud-init生成の`/etc/ssh/sshd_config.d/50-cloud-init.conf`で`PasswordAuthentication no`が設定されており、本体の`sshd_config`側の`yes`より優先されていた（`Include`が本体設定より先に読まれるため）。ConoHaのブラウザコンソール（VNC系）は長い文字列の貼り付けで文字が欠落する問題があったため、公開鍵の登録は「コンソールで一時的に`PasswordAuthentication yes`に戻す→通常のSSH（信頼できるペースト）で鍵を登録→`no`に戻す」という手順で回避した
  - systemdのサービス名は`sshd`ではなく`ssh`（Ubuntu/Debian系）
  - JVMメモリ対策として`docker-compose.prod.yml`のbackendサービスに`JAVA_TOOL_OPTIONS: "-Xmx768m"`を追加
  - `docs/DEPLOY.md`のステップ1に「1-0. SSH鍵認証への切り替え」「1-2. スワップの追加」を追記
- **パスワードリセット機能**: 実装する方針が確定（ユーザー決定、2026-07-19）。SMTP方式（Gmail SMTP / SendGrid・AWS SES等 / ConoHaメール）は未決定、[USER_TODO.md](USER_TODO.md)参照
- **Git初回コミット**: `git add -A`は完了（211ファイル、`.env`や`node_modules`等の混入なし確認済み）。`git commit`が`user.name`/`user.email`未設定で失敗、ユーザーの設定待ち

## 完了した作業（Phase6: デプロイ準備）

- **フロントエンドDockerfileのバグ修正**: `NEXT_PUBLIC_API_BASE_URL`をビルド引数化。これまで本番ドメイン向けにビルドしても常に開発用フォールバック値が埋め込まれる状態だった（[DECISIONS.md](DECISIONS.md)参照、実際にビルド後のバンドルに正しいURLが入ることを確認済み）
- **CORS設定の環境変数化**: `novelshelf.cors.allowed-origins`（`CORS_ALLOWED_ORIGINS`）で本番オリジンに絞り込めるようにした
- **Nginx + Let's Encrypt構成**: `docker/nginx/nginx.conf`（本番HTTPS設定）、`nginx-bootstrap.conf`（証明書取得前のHTTP専用設定）、`docker-compose.prod.yml`（Nginx/certbotサービス追加、backend/frontend/postgresの直接公開を停止、`NEXT_PUBLIC_API_BASE_URL`を本番ドメインでビルド）
  - `docker compose config`でオーバーレイのマージ結果を検証（ポート非公開・ビルド引数差し替え・certbotの`tools`プロファイル隔離が正しく反映されることを確認）
  - `nginx -t`で両設定ファイルの構文を検証
  - 自己署名証明書を一時生成し、実際にNginxコンテナを起動して本物のbackend/frontendコンテナへのプロキシ、HTTP→HTTPSリダイレクト、HSTSヘッダ、`/download`エンドポイントの延長タイムアウトルートまで動作確認
- **デプロイ手順書** `docs/DEPLOY.md`: VPS初期設定〜DNS〜証明書取得〜起動確認〜自動更新〜再デプロイまでのランブック

## 完了した作業（Phase5後半: 追加画面）

- **検索画面**（`/search`）: タイトル/作者名 + サイトフィルタ
- **作者ページ**（`/authors/[authorName]`）: 全作品数・読了数・お気に入り数を表示。作品詳細画面の作者名をリンク化
- **更新一覧画面**（`/updates`）: 更新のある作品一覧 + 「更新を確認」ボタン（`POST /updates/check`）
- **読書統計・カレンダー画面**（`/stats`）: サマリー（読了作品数/総読了話数/総読書時間）、月間カレンダーヒートマップ、サイト別/作者別/月別の内訳バーチャート
- **ナビゲーション**: ボトムナビを本棚/検索/更新/しおり/設定の5項目に拡張。統計へは本棚画面右上のアイコンからアクセス
- 新規ユーティリティ`formatDuration`（秒→"○時間○分"表記）を単体テスト付きで追加
- E2Eテスト（`critical-journey.spec.ts`）に検索→作者ページ→更新一覧→統計の導線を追加し、スクリーンショットでも見た目を確認（本棚グリッド・検索結果・作者ページの集計値・カレンダー空表示、いずれも崩れなし）

## 完了した作業（Phase5前半）

- **バックエンド Testcontainers基盤**: `TestcontainersConfiguration`（`@ServiceConnection`で実Postgresコンテナに自動接続）を導入し、これまでDB未接続で失敗していた`BackendApplicationTests`を修正
- **バックエンド 単体テスト**: `NovelUpdateCheckerTest`（更新判定ロジック）、`JwtServiceTest`（トークン生成/検証/改ざん検知）、`RefreshTokenGeneratorTest`（一意性・ハッシュ化）、`StatsServiceTest`（JST日付集計・サイト別集計）
- **バックエンド 統合テスト**: `AuthFlowIntegrationTest`（signup/login/refresh rotation/logout/401系、6件）、`ShelfBookmarkIntegrationTest`（本棚/タグ/読書位置/履歴/統計/しおり/オフライン設定/検索、5件）を`TestRestTemplate`+実Postgresで実施。**合計26テスト、すべて成功**
- **バックエンド なろう実疎通テスト**: `NarouAdapterLiveTest`を`@Tag("external")`で分離し、`./gradlew test`（既定）からは除外、`./gradlew externalTest`で手動実行できるようにした（なろうサーバーへの負荷配慮）
- **フロントエンド 単体テスト**: Vitest導入。`colorHash`/`applyTheme`/APIクライアント（401自動リフレッシュ・リトライ・失敗時のハンドラ呼び出し）のテスト、**9件すべて成功**
- **フロントエンド E2Eテスト**: Playwright導入（Chromiumインストール済み）。サインアップ→なろうURLから作品追加→作品詳細→読み始める→次の話へ→縦横書き/ダークモード切替→しおり追加→設定変更(リロード後も保持)→本棚から削除、という一連の導線を実際のDocker Composeスタック（本番相当のコンテナ）に対して**実ブラウザで実行し、成功を確認**
- **UIの目視確認**: E2Eテスト中にスクリーンショットを撮影し、本棚・作品詳細・読書画面（縦書き/横書き/ダーク）・設定・追加ダイアログの見た目を確認。レイアウト崩れなし、Phase1のUIモックの意匠を概ね踏襲できていることを確認
- **CI/CDワークフロー**: `.github/workflows/ci.yml`（push/PR時にbackend/frontendのビルド・テストを実行、外部アクセスなし）、`.github/workflows/e2e-live.yml`（手動実行 or 週次でなろう実疎通テスト+Playwright E2Eを実行）を追加

## 変更したファイル

```
backend/build.gradle                                    (更新: testcontainers/restclient等追加、externalTestタスク追加)
backend/src/test/java/com/novelshelf/TestcontainersConfiguration.java (新規)
backend/src/test/java/com/novelshelf/BackendApplicationTests.java     (更新)
backend/src/test/java/com/novelshelf/integration/*.java               (新規、2ファイル)
backend/src/test/java/com/novelshelf/application/**/*.java            (新規、単体テスト2ファイル)
backend/src/test/java/com/novelshelf/infrastructure/security/*.java   (新規、単体テスト2ファイル)
backend/src/test/java/com/novelshelf/infrastructure/adapter/narou/NarouAdapterLiveTest.java (新規)
backend/src/main/java/com/novelshelf/presentation/bookmark/BookmarkController.java (更新、Phase4分)
frontend/package.json, vitest.config.ts, vitest.setup.ts, playwright.config.ts (新規/更新)
frontend/src/lib/**/*.test.ts                            (新規、単体テスト3ファイル)
frontend/e2e/critical-journey.spec.ts                     (新規)
frontend/.gitignore                                       (更新)
.github/workflows/ci.yml, e2e-live.yml                    (新規)
.claude/settings.json                                      (新規、permissions.allow)
docs/DECISIONS.md, KNOWN_ISSUES.md                        (更新)

# Phase5後半（追加画面）
frontend/src/app/(protected)/(shell)/search/page.tsx              (新規)
frontend/src/app/(protected)/(shell)/authors/[authorName]/page.tsx (新規)
frontend/src/app/(protected)/(shell)/updates/page.tsx              (新規)
frontend/src/app/(protected)/(shell)/stats/page.tsx                (新規)
frontend/src/app/(protected)/(shell)/novels/[novelId]/page.tsx     (更新: 作者名をリンク化)
frontend/src/components/BottomNav.tsx                              (更新: 検索/更新を追加)
frontend/src/components/icons.tsx                                  (更新: SearchIcon/BellIcon/ChartIcon追加)
frontend/src/lib/utils/formatDuration.ts, formatDuration.test.ts   (新規)
frontend/e2e/critical-journey.spec.ts                              (更新: 検索/作者/更新/統計の導線を追加)
docs/USER_ACTION.md → docs/USER_TODO.md                            (リネーム、ユーザー指示による)
docs/KNOWN_ISSUES.md, NEXT_TASK.md, phase1/architecture.md, phase1/directory-structure.md, phase1/requirements.md (更新: USER_ACTION参照をUSER_TODOに置換)

# Phase6（デプロイ準備）
docker/frontend/Dockerfile                                    (更新: NEXT_PUBLIC_API_BASE_URLをビルド引数化)
docker/docker-compose.yml                                     (更新: build.args追加、CORS_ALLOWED_ORIGINS追加)
docker/docker-compose.prod.yml                                (全面更新: Nginx/certbotサービス追加)
docker/nginx/nginx.conf, nginx-bootstrap.conf                 (新規)
backend/src/main/java/com/novelshelf/infrastructure/security/CorsProperties.java (新規)
backend/src/main/java/com/novelshelf/infrastructure/security/SecurityConfig.java (更新: CORS設定を環境変数化)
backend/src/main/resources/application.yml                    (更新: novelshelf.cors追加)
.env.example                                                   (更新: CORS_ALLOWED_ORIGINS/NEXT_PUBLIC_API_BASE_URL本番例を追加)
docs/DEPLOY.md                                                 (新規)

# Phase6中の追加改修（バグ修正3件・オフライン拡張、2026-07-19）
backend/src/main/java/com/novelshelf/infrastructure/adapter/narou/NarouAdapter.java     (更新: 前書き誤取得修正、R18サイト対応)
backend/src/main/java/com/novelshelf/infrastructure/adapter/narou/NarouProperties.java  (更新: R18 API/サイトURL設定を追加)
backend/src/main/java/com/novelshelf/infrastructure/adapter/SiteAdapterRegistry.java    (更新: novel18.syosetu.comをNAROUとして認識)
backend/src/main/resources/application.yml                                              (更新: novelshelf.narou.r18-*を追加)
backend/build.gradle                                                                    (更新: externalTestにR18 ncode転送用のsystemProperty追加)
backend/src/test/java/com/novelshelf/infrastructure/adapter/narou/NarouAdapterLiveTest.java (更新: R18向け実疎通テスト追加)
frontend/src/app/layout.tsx                                    (更新: OfflinePositionSyncを配線)
frontend/src/app/(protected)/(shell)/page.tsx                  (更新: 本棚オフラインキャッシュ表示)
frontend/src/app/(protected)/novels/[novelId]/chapters/[chapterId]/page.tsx (更新: 縦書き横スクロール修正、位置更新オフラインキュー)
frontend/src/components/AddNovelDialog.tsx                     (更新: R18 URLも案内)
frontend/src/components/OfflinePositionSync.tsx                (新規)
frontend/src/lib/offline/db.ts                                 (新規: IndexedDBスキーマ一元化)
frontend/src/lib/offline/chapterCache.ts                       (更新: db.tsのスキーマを利用するようリファクタ)
frontend/src/lib/offline/shelfCache.ts                         (新規)
frontend/src/lib/offline/positionQueue.ts                      (新規)
```

## 実装した機能

Phase5前半はテスト整備のみ（新規アプリケーション機能なし）。Phase5後半で以下のフロントエンド機能を追加: 検索、作者ページ、更新一覧、読書統計・カレンダー。

## 未完了の作業

- **ConoHa VPSの契約・IPアドレス共有待ち**（[USER_TODO.md](USER_TODO.md)参照、Phase6の実デプロイのブロッカー）
- 実VPSでのデプロイ手順（`docs/DEPLOY.md`）の実行・検証（開発機上での検証は完了、実環境は未検証）
- カクヨム・ハーメルン・pixiv小説向けSiteAdapter（規約確認待ち）
- シリーズ管理画面（Adapter側でシリーズ検出を実装するまで保留、[KNOWN_ISSUES.md](KNOWN_ISSUES.md)参照）
- Reactコンポーネント単体のレンダリングテスト、エラーケースのE2E（[KNOWN_ISSUES.md](KNOWN_ISSUES.md)参照）
- GitHub Actionsワークフローの実機（実際のActions実行）確認（GitHubリモート未設定のため）

## 次回最初に行う作業

[NEXT_TASK.md](NEXT_TASK.md) を参照。要約: VPS契約・IPアドレスが揃い次第、`docs/DEPLOY.md`に沿って実デプロイを行う。

## 注意事項

- **重要な発見**: `docker compose ps --format json`はJSON配列ではなく改行区切りJSON（NDJSON、1コンテナ1行）を返す。CIのヘルスチェックスクリプトでは`jq -s`（slurp）で配列化してから処理する必要がある。
- Testcontainersのテスト実行にはDocker Desktopの起動が必須（`./gradlew test`実行時にDockerが動いていないと失敗する）。
- E2Eテスト・なろうライブテストは意図的にCIの既定トリガー（push/PR）から除外している。理由と代替トリガーは[DECISIONS.md](DECISIONS.md)参照。今後同種のテストを追加する場合もこの方針を踏襲すること。
- Spring Boot 4.1のテスト関連クラスもさらに移動していた: `TestRestTemplate`は`org.springframework.boot.resttestclient.TestRestTemplate`（要`spring-boot-restclient`依存＋`@AutoConfigureTestRestTemplate`）。Testcontainers 2.xでは`postgresql`/`junit-jupiter`モジュールが`testcontainers-postgresql`/`testcontainers-junit-jupiter`に改称されている。[DECISIONS.md](DECISIONS.md)参照。

## 現在のブランチ

`main`（GitHubリモート`YUKI-1223-debug/NovelShelfApp-project`にpush済み、直近コミット`63d48ad`）。今回のバグ修正3件・オフライン拡張分はコミット待ち。

## 実行したコマンド

```
# バックエンドテスト
cd backend && ./gradlew test              # 26テスト全成功（externalは除外）
cd backend && ./gradlew externalTest      # なろう実疎通2テスト成功

# フロントエンドテスト
cd frontend && npx vitest run             # 9テスト全成功
cd frontend && npx playwright install chromium
cd frontend && npx playwright test        # E2Eジャーニー1本成功（スクリーンショットで目視確認も実施）

# CI設定検証
npx js-yaml .github/workflows/ci.yml
npx js-yaml .github/workflows/e2e-live.yml

# Phase6: Nginx構成の検証
docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.prod.yml config
docker run --rm --network docker_default -v ".../nginx-bootstrap.conf:/etc/nginx/conf.d/default.conf:ro" nginx:1.27-alpine nginx -t
docker run --rm --network docker_default -v ".../nginx.conf:...:ro" -v "<自己署名証明書>:/etc/letsencrypt:ro" nginx:1.27-alpine nginx -t
# 実際にコンテナを起動してHTTPS経由でbackend/frontendへ到達することも確認（curl -sk https://localhost:8443/...）
```

## エラー

- `TestRestTemplate`のBean未定義エラー → `spring-boot-restclient`依存追加＋`@AutoConfigureTestRestTemplate`アノテーションで解決（[DECISIONS.md](DECISIONS.md)参照）。
- Testcontainers 2.xで`org.testcontainers:postgresql`/`junit-jupiter`が依存解決エラー → `testcontainers-postgresql`/`testcontainers-junit-jupiter`への改称が原因、修正済み。
- Playwrightの複数`test()`に分けた導線テストが2件目でログイン状態を失い失敗 → Playwrightはtestごとに新しいブラウザコンテキスト（=localStorageクリア）を作るため。1つの`test()`内で`test.step()`を使う構成に変更して解決。
- フロントエンドの本番ビルドで`NEXT_PUBLIC_API_BASE_URL`が常に開発用フォールバック値になっていた → Dockerfileがビルド引数を受け取っていなかったのが原因。ビルド引数化して解決（[DECISIONS.md](DECISIONS.md)参照）。
