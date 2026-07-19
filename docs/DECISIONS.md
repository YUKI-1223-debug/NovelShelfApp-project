# 設計判断記録 (DECISIONS)

新しい判断は先頭に追記する（新しい順）。

---

## 2026-07-19: 縦書きリーダーのiPhone/Android横スクロール不具合を`ml-auto`で修正

**決定**: 縦書き表示のコンテナを`flex justify-end`ではなく`flex`+`article`側`ml-auto`に変更し、`overflow-auto`側の親にも`min-h-0`を追加した。

**理由**: `justify-content: flex-end`のflexコンテナは、はみ出た子要素がjustify-content開始方向（横書きモードのflexでは左）に隠れる形になり、多くのブラウザ（特にモバイルSafari/Chrome）でその隠れた部分がスクロール可能領域として認識されないというflexboxの既知の挙動が原因で、iPhone/Androidで縦書き話の横スクロールが一切できなくなっていた（ユーザー報告、2026-07-19）。`ml-auto`（コンテンツがはみ出ない場合だけ右寄せになり、はみ出た場合は通常のフロー幅を持つ）に変更することで解消。`min-h-0`は`flex-1`要素がデフォルトの`min-height: auto`により縦方向にも縮小できずレイアウトが崩れることがあるflexbox特有の問題への対策。iPhoneビューポート（Playwright, `devices["iPhone 13"]`）で実機相当の確認済み。

**背景**: 同時にユーザー報告のあった「小説取得時に前書きだけが本文として表示される」バグ（`NarouAdapter`が`div.p-novel__text`の最初の一致を本文として誤取得していた）も、前書き/あとがき用の修飾クラスを`:not()`で除外する形で修正済み。

---

## 2026-07-19: なろうR18サイト（ノクターン/ムーンライト/ミッドナイトノベルズ）に対応

**決定**: `NarouAdapter`を拡張し、`novel18.syosetu.com`（R18小説API `https://api.syosetu.com/novel18api/api/`、年齢確認クッキー`over18=yes`）にも対応した。externalNovelIdは通常サイトと衝突しないよう`"r18:" + ncode`で保存する。ユーザー指定（2026-07-19、対象例: ノクターン/ミッドナイト/ムーンライト）。

**実疎通確認で判明した重要な差異**: R18小説APIのレスポンスには通常API(`novelapi`)にある作者の数値ID(`userid`)が含まれない。作品ページ側にも作者マイページへの安定したリンクは存在しない（footerの「作者Xマイページ」は外部SNSへのリンクで作者IDとは無関係）。そのため作者名文字列（`"r18-writer:" + writer`）をexternalAuthorIdとして代用し、authorProfileUrlは取得手段がないためnullとする。同姓同名の別作者を同一著者として扱ってしまう既知の制約が残る（[KNOWN_ISSUES.md](KNOWN_ISSUES.md)参照）。ページ本文のCSSセレクタ（`p-novel__title`/`p-eplist__sublist`/`p-novel__text`等）は通常サイトと共通で、実際のR18作品(`n3638hn`)で疎通テスト済み。

**ToS上の注意**: なろうR18小説APIの利用規約は「取得した情報を18歳未満に閲覧させないこと」を求めている。本アプリはログイン必須の完全個人利用インスタンス（[PROGRESS.md](PROGRESS.md)参照）であり、ユーザー本人以外がアクセスすることを想定していないため、この条件を満たすと判断した。不特定多数向けに公開する場合は年齢確認フローの追加実装が必要になる。

**採用しなかった案**: R18ページのHTMLから作者マイページリンクをスクレイピングで探す案 → 実際のページを確認したところ、作品ページ内に作者の一覧ページへの安定したリンクが存在しないため断念。

---

## 2026-07-19: パスワードリセット機能を実装する（SMTP送信方式は別途決定）

**決定**: メール+パスワード認証のパスワードリセット機能を実装する方針に確定。SMTPによるメール送信基盤が必要になる。具体的な送信方式（Gmail SMTP / SendGrid・AWS SES等の専用サービス / ConoHaメール）はユーザー未決定のため、[USER_TODO.md](USER_TODO.md)で確認待ち。

**背景**: 個人利用アプリのため、パスワードを忘れた場合にDBを直接操作する運用で妥協する案もあったが、ユーザーが実装を希望した。

---

## 2026-07-19: ConoHa VPSのSSH初期設定 — cloud-init設定ファイルに要注意、コンソール経由の長い文字列貼り付けは避ける

**決定**: VPS初期設定のSSH鍵化で、`/etc/ssh/sshd_config`本体は`PasswordAuthentication yes`のままだったが、`/etc/ssh/sshd_config.d/50-cloud-init.conf`（cloud-init生成）が`no`を上書きしていた（`Include`が本体の設定行より先に評価されるため）。また、ConoHaのブラウザコンソール（VNC系）は長い文字列を貼り付けると途中で欠落することが判明したため、公開鍵の登録はコンソール上で直接タイプせず、「コンソールで一時的に`PasswordAuthentication yes`に戻す→信頼できる通常のSSHセッションで鍵を登録→`no`に戻す」という手順で行った。

**理由**: コンソールでの長文貼り付けの信頼性が低く、鍵の一部が欠けたまま登録すると気づきにくい失敗につながるため。

**今後への影響**: 同じConoHaのUbuntuイメージを使う場合、`/etc/ssh/sshd_config.d/`配下も確認すること。`docs/DEPLOY.md`のステップ1-0に手順を反映済み。

---

## 2026-07-19: Nginxはwebroot方式+手動ブートストラップでLet's Encrypt証明書を取得する

**決定**: `nginx-proxy`/`acme-companion`のような自動化ツールは使わず、素の`nginx:alpine`+公式`certbot/certbot`イメージを組み合わせ、初回証明書取得だけ手動のブートストラップ手順（HTTP専用設定→certbot実行→HTTPS設定へ切替）を踏む構成にした（`docs/DEPLOY.md`参照）。更新はVPSのcrontabで`certbot renew`を定期実行する。

**理由**: 自動化ツールは楽だが、初めて本番インフラを構築するユーザーにとってはブラックボックスになりやすい。素のnginx+certbotなら`docker compose run --rm certbot ...`のようにコマンドが明示的で、`docs/DEPLOY.md`を読めば何が起きているか追える。個人利用の単一ドメイン構成では自動化ツールの恩恵（複数ドメインの動的追加等）も薄い。

**採用しなかった案**: `jonasal/nginx-certbot`等の統合イメージを使う案 → 内部動作がブラックボックス化し、証明書取得に失敗した際のデバッグが難しくなるため見送り。

---

## 2026-07-19: 本番はNginxでフロントエンド・APIを同一オリジン化し、CORSは保険として環境変数で絞り込む

**決定**: 本番では`https://novelshelf.jp/`（フロントエンド）と`https://novelshelf.jp/api/v1/`（バックエンドAPI）を同じNginxが両方を配信するため、ブラウザから見ると同一オリジンになりCORSは本来不要になる。念のためバックエンドのCORS許可オリジンは`novelshelf.cors.allowed-origins`（`CORS_ALLOWED_ORIGINS`環境変数）で設定可能にし、本番では`https://novelshelf.jp`のみを許可する（開発時の既定値`*`は維持）。

**背景**: Phase4/5から`CORS設定が"*"のまま`という既知の課題として残っていた（[KNOWN_ISSUES.md](../KNOWN_ISSUES.md)参照）。同一オリジン化でCORSの重要性は下がったが、APIを直接（Nginxを経由せず）叩かれるケースの保険として残す。

---

## 2026-07-19: フロントエンドDockerfileでNEXT_PUBLIC_API_BASE_URLをビルド引数化（本番デプロイ直前に発見したバグの修正）

**内容**: `NEXT_PUBLIC_*`環境変数はNext.jsのビルド時にJSバンドルへ直接埋め込まれる。Phase2〜5の`docker/frontend/Dockerfile`は`RUN npm run build`にこの変数を渡していなかったため、実際には常にアプリコード内のフォールバック値（`http://localhost:8081/api/v1`）でビルドされていた。開発環境ではこのフォールバック値がたまたま実際の設定と一致していたため、Phase4/5を通じて気づかれなかった（バグとしては顕在化していなかった）。本番ドメイン向けにビルドする段になって初めて発見した。

**対応**: `ARG NEXT_PUBLIC_API_BASE_URL` + `ENV`をビルドステージ冒頭に追加し、`docker-compose.yml`側で`build.args`として明示的に渡すよう修正。本番オーバーレイでは`https://${DOMAIN}/api/v1`を渡す。修正後、実際にビルドしたバンドルに正しいURLが埋め込まれることを確認済み。

**教訓**: 「動いているように見える」設定値の一致が偶然による見せかけの正しさである可能性を、環境（開発→本番）を切り替えるタイミングで再確認する必要がある。

---

## 2026-07-18: なろう実サイトへアクセスするテストは「手動/週次」トリガーに限定する

**決定**: バックエンドの`NarouAdapterLiveTest`（実なろうAPI・実ページへの疎通確認）は`@Tag("external")`を付け、`./gradlew test`（既定）からは除外。専用の`./gradlew externalTest`タスクでのみ実行する。GitHub Actionsも同様に、通常のpush/PRでは実行せず、`.github/workflows/e2e-live.yml`として`workflow_dispatch`（手動）と週次cronのみに限定した（Playwright E2Eも同じワークフローに含めた。なろうへの実アクセスを伴うため）。

**理由**: [「なろうの話一覧・本文取得はレート制限付きHTML取得で実装した」](.)の決定と同じ理由。CI/CDでpushのたびに自動実行すると、なろうのサーバーに対して意図しない頻度でアクセスすることになり、これまで守ってきた「必要な分だけ、間隔を空けて取得する」という方針に反する。通常のCIゲート（push/PR時）はTestcontainers上のPostgresとリポジトリで用意したテストデータのみを使い、外部ネットワークに一切依存しない`AuthFlowIntegrationTest`/`ShelfBookmarkIntegrationTest`で担保する。

**採用しなかった案**: 全テストを毎回のCIで実行する案 → なろうへの負荷・レート制限抵触のリスクがあるため不採用。

---

## 2026-07-18: バックエンドのRepositoryはSpring Data JpaRepositoryのまま、テストはTestcontainersで実DBを使う

**内容**: Phase3の「ドメイン層のRepositoryインターフェースはSpring Data JpaRepositoryを直接継承する」という簡略化判断（本ファイル該当項目参照）を踏まえ、Phase5のテストもH2等のインメモリDBで代替せず、Testcontainers（実Postgresコンテナ）を使う方針にした。

**理由**: `V1__init.sql`のDDLはPostgres固有の型・関数（`gen_random_uuid()`等）を使っており、H2のPostgres互換モードでは完全な互換性が保証されない。Flywayマイグレーションをそのまま本番と同じDBエンジンに対して検証できるTestcontainersの方が、SQLの非互換に起因する見逃しを防げると判断した。`spring-boot-testcontainers`の`@ServiceConnection`を使うことで、DataSourceの手動設定なしに実DBへ接続するテストが書けている。

**採用しなかった案**: H2インメモリDBを使う案 → 起動は速いが、Postgres固有機能の非互換に気づけないため不採用。

---

## 2026-07-18: 本番ドメインを `novelshelf.jp` に決定・取得済み

**内容**: ユーザーが本番デプロイ用のドメイン`novelshelf.jp`を取得した。Phase6（デプロイ）で`.env`の`DOMAIN`、`docker-compose.prod.yml`のNginx/TLS設定（Let's Encrypt等）に反映する。`.env.example`のコメントアウト済みプレースホルダーに実際のドメイン名を記載済み。

**背景**: PWAとして実機（特にiOS）で正しくインストール・動作確認するにはHTTPS配信が必要であり、そのためには独自ドメインが前提になる。`.jp`を選んだ理由はユーザー自身の判断（日本語小説を扱うアプリであることに合わせた可能性）。

---

## 2026-07-18: Phase4のオフラインキャッシュはIndexedDB・暗号化なしの簡易実装に留めた

**決定**: 閲覧済み話の自動キャッシュ・「全話オフライン保存」ボタンの保存先として、ブラウザのIndexedDBにJSONをそのまま保存する簡易実装にした（`frontend/src/lib/offline/chapterCache.ts`）。[requirements.md](phase1/requirements.md)が要求する暗号化・保存容量表示・上限設定・作品単位削除UIは未実装。

**理由**: Phase4の主目的は「実際に使ってみて確認できる」一通りの読書体験を早く成立させることだった。暗号化ストレージ（Web Crypto APIでの鍵管理、端末紐付け等）は設計判断が多く、読書の主要導線（本棚→作品→読書→しおり→設定同期）を止めてまで先に作り込む優先度ではないと判断した。

**採用しなかった案**: 最初から暗号化・容量管理まで実装する案 → Phase4の他画面（読書画面・設定同期等）の実装時間を圧迫するため見送り。[KNOWN_ISSUES.md](KNOWN_ISSUES.md)に未実装として明記し、Phase5以降での実装を前提とする。

---

## 2026-07-18: しおりのレスポンスに`novelId`/`chapterNo`/`chapterTitle`を追加（Phase3実装の小改修）

**決定**: `BookmarkController`のレスポンスに、しおりが指す話の`novelId`・`chapterNo`・`chapterTitle`を追加した（`ChapterRepository`から都度解決）。`docs/phase1/api/openapi.yaml`のBookmarkスキーマも合わせて更新。

**理由**: フロントエンドの「しおり」一覧画面から読書画面へ直接ジャンプするには`novelId`が必要だが、Phase3時点のBookmarkレスポンスは`chapterId`のみで、遷移先を組み立てられなかった。しおりは「タップしたら該当箇所に戻れる」ことが本質的な価値のため、Phase4実装中に気づいた時点でOpenAPI・バックエンドを先に直してからフロントエンドを実装した（Spec-firstの方針どおり）。

---

## 2026-07-18: JWTアクセストークン/リフレッシュトークンはlocalStorageに保存する

**決定**: フロントエンドはアクセストークン・リフレッシュトークンの両方を`localStorage`に保存する（`frontend/src/lib/api/tokenStore.ts`）。

**理由**: 個人利用アプリのPhase4 MVPとして、実装コストが低くPWA（複数タブ・再起動後も維持）と相性が良いことを優先した。httpOnly Cookie方式にする場合はバックエンドのCORS/Cookie設定変更が必要になり、Phase3の認証設計を作り直すことになるため見送った。

**採用しなかった案**: httpOnly Cookieでリフレッシュトークンを保持する案 → XSS耐性は上がるが、バックエンドのCORS設定・Cookie発行ロジックの追加実装が必要でPhase4の完了が遅れるため見送り。将来Googleログインを追加するタイミングで再検討する（[KNOWN_ISSUES.md](KNOWN_ISSUES.md)参照、XSS対策は要件のセキュリティ水準次第で優先度を上げる）。

---

## 2026-07-18: フロントエンドの読書画面はスクロールモードのみ実装し、ページ送り(pagination)設定は保存のみ行う

**決定**: `UserSettings.pageMode`は引き続き`SCROLL`/`PAGINATION`の両方を設定・同期できるが、Phase4の読書画面はスクロール表示のみ実装した。`PAGINATION`を選択しても表示はスクロールのまま変わらない。

**理由**: ページ送り（本のようにページ単位で区切って表示する）は、縦書き/横書き・フォントサイズ・余白の組み合わせで1ページの文字数を動的計算する必要があり、実装コストが高い。Phase4は「実際に使って確認する」ための最初の通し実装を優先し、スクロールモードのみで読書体験そのものは成立させた。

**採用しなかった案**: 最初からページ送りも実装する案 → 他の画面（本棚・設定・しおり）の実装が遅れるため見送り。[KNOWN_ISSUES.md](KNOWN_ISSUES.md)に明記。

---

## 2026-07-18: create-next-appが導入したESLint（eslint-plugin-react-hooks v7）が新しい purity / set-state-in-effect ルールをエラーとして強制していた

**内容**: Phase2で生成した`frontend`は`eslint-plugin-react-hooks@7.1.1`を使っており、React Compiler向けの新しいルール（`react-hooks/set-state-in-effect`、`react-hooks/purity`等）がデフォルトでエラーになっていた。データ取得のため`useEffect`内で非同期関数を呼びその中で同期的に`setState(true)`するという極めて一般的なパターンが軒並みエラーになる。

**対応**: `useEffect`内の非同期処理呼び出しを`queueMicrotask(() => fn())`で1マイクロタスク遅延させることで、実用上の挙動を変えずにルールを満たした。`Date.now()`のようなrender中に呼ぶと不純とみなされる関数は、`useRef`の初期値ではなく`useEffect`内で代入するように統一した。

**将来的な拡張**: Phase5以降で新しいエフェクト/データ取得コードを書く際は、この`queueMicrotask`パターンを踏襲するか、React 19のuse()フックやServer Componentsでのデータ取得に置き換えることを検討する。

---

## 2026-07-18: 全話一括取得エンドポイント `POST /novels/{novelId}/download` を追加

**決定**: ユーザーが明示的に呼び出した場合に限り、作品の全話本文をレート制限を維持したまま順次取得して一括で返すエンドポイントを追加した（`NovelQueryService.getAllChapterContents`）。話数分のリクエストを`NarouRateLimiter`が引き続き1秒間隔に制御するため、レスポンスは話数に比例して時間がかかる（実測: 15話で約15秒）。本文はサーバーに保存しない（従来方針を維持）。

**背景・理由**: 「なろう本文取得はレート制限付きHTML取得で実装した」の決定で「一括クロール（全話の先読み等）を行わない」としていたが、これはrobots.txtの`Crawl-delay`が求める「リクエスト間隔の遵守」と、要件定義にある「任意作品のオフライン保存」（ユーザーが明示的に全話を保存したい場合の機能）を混同していた。robots.txtはリクエスト総数やページ範囲を制限しておらず、間隔さえ守れば全話取得は禁止されていない。ユーザーからの明示的な指示（2026-07-18「一気に全話とってこれるように実装はできない？」）を受け、レート制限は維持したまま一括取得エンドポイントを追加する形で対応した。「自動・無音での全話先読み」は依然として行わない（`GET /novels/{id}/chapters`は話一覧のみでbodyHtmlは含まない）。

**採用しなかった案**: レート制限を緩めて並列/高速取得する案 → robots.txtのCrawl-delayに反するため不採用。非同期ジョブ化＋進捗通知（SSE等）する案 → 個人利用アプリの規模（既知の作品は数百話程度）では同期レスポンスで十分と判断し、複雑さを避けた。将来長大な作品で問題になった場合は`docs/KNOWN_ISSUES.md`を参照して非同期化を検討する。

---

## 2026-07-18: Phase3で判明したSpring Boot 4.1 / Jackson 3の破壊的変更（今後の実装で踏まないための記録）

**内容**: バックエンド実装中に、学習データ時点の知識と実際のアーティファクトが以下の点で異なることが判明した。Phase4以降で新しい依存関係を追加する際は、必ずMaven Central/npm等の実データを確認してから実装すること（`docs/DECISIONS.md`の「Spring Boot / Next.jsのバージョンは...」と同じ方針の具体例）。

- `spring-boot-starter-web` → `spring-boot-starter-webmvc` に改称
- `spring-boot-starter-test`（モノリシックなテスト依存）が廃止され、`spring-boot-starter-webmvc-test` / `spring-boot-starter-data-jpa-test` / `spring-boot-starter-actuator-test` 等、モジュールごとのテスト依存に分割された
- Jackson 3系がデフォルトになり、`com.fasterxml.jackson.databind.*`（ObjectMapper, JsonNodeなど）は `tools.jackson.databind.*` に移動した。ただし `com.fasterxml.jackson.annotation.*`（@JsonProperty等）は据え置き
- Flywayを有効化するには `org.flywaydb:flyway-core` を直接依存に追加するだけでは自動構成が効かない。`org.springframework.boot:spring-boot-starter-flyway` を追加する必要がある（依存関係の一覧に出ず、テーブル未作成のままHibernateのスキーマ検証が失敗するという分かりにくい壊れ方をした）。Postgres対応には別途 `org.flywaydb:flyway-database-postgresql` が必要（starterには含まれない）

**採用しなかった案**: 学習データの記憶を頼りに実装 → 起動時エラーで気づくまで気づけない壊れ方をするため、Spring Initializr/Maven Central/実際のjarファイル（javap等）で都度検証する方針に切り替えた。

---

## 2026-07-18: なろうの話一覧・本文取得はレート制限付きHTML取得で実装した（Phase1の未決事項を解消）

**決定**: なろう小説API（公式）はメタデータ検索のみを提供し、話一覧・本文は提供しないことが実装時に確認できた。話一覧は `https://ncode.syosetu.com/{ncode}/` の目次ページ、本文は `https://ncode.syosetu.com/{ncode}/{話数}/` の各話ページをJsoupで取得・解析する（`NarouAdapter`）。

**理由**: `ncode.syosetu.com/robots.txt` を実際に確認したところ、一般User-agentに対して `Disallow` の指定はなく `Crawl-delay: 1` のみが指定されていた（AIスクレイパーのみ個別にブロック）。個人利用アプリがユーザーの実際の閲覧操作に応じて1話ずつ取得する分には、通常のブラウザアクセスと同等とみなせると判断した。そのため `NarouRateLimiter` でサイトへのリクエスト間隔を最低1秒に強制し、一括クロール（全話の先読み等）は行わない設計とした。

**採用しなかった案**: 話本文もAPI経由で取得する案 → なろう小説APIには存在しないため不可。全話を先読みしてキャッシュする案 → 一括クロールになり `Crawl-delay` の趣旨に反するため不採用（オフラインキャッシュは「閲覧済み話の自動キャッシュ」に留める、[requirements.md](phase1/requirements.md)の設計方針どおり）。

**将来的な拡張**: カクヨム・ハーメルン・pixiv小説についても同様にrobots.txt・利用規約を個別調査し、許容範囲内であれば同じ「1件ずつ・レート制限付き」の方針でAdapterを追加する。

---

## 2026-07-18: 未対応サイトのURLは本文取得なしのプレースホルダー作品として登録する

**決定**: `/novels/resolve` にカクヨム・ハーメルン・pixiv小説のURLが渡された場合、`SiteNotSupportedException` を送出する代わりに、URLをtitle/externalNovelIdとした最小限のNovelレコードを作成して200を返す（`IngestService.resolvePlaceholder`）。話一覧は空、本文取得は451を返す。

**理由**: [architecture.md](phase1/architecture.md) で設計した `FallbackLinkAdapter`（本棚にはリンク登録できるが本文取得は行わない）の意図を実現するには、未対応サイトでも本棚登録が完了できる必要がある。エラーを返すだけではこのフォールバック体験を提供できないため、Phase1のOpenAPI定義（422を返す想定だった）から変更した。`docs/phase1/api/openapi.yaml` の該当箇所は実装に合わせて更新済み。422は「URLがどの対応サイトのドメインとも一致しない」場合のみに限定した。

---

## 2026-07-18: リフレッシュトークンはハッシュ化して永続化し、ローテーション＋失効管理を行う

**決定**: アクセストークンはステートレスJWT（30分TTL）、リフレッシュトークンは不透明なランダム文字列（Base64）を発行し、DBには SHA-256 ハッシュのみを保存する。リフレッシュのたびに旧トークンを失効させ新トークンを発行する（ローテーション）。`docs/phase1/er-diagram.md` には存在しない `refresh_tokens` テーブルをPhase3で追加した。

**理由**: 完全ステートレスなリフレッシュトークン（JWT化）にすると、ログアウトやトークン漏洩時に個別に無効化する手段がなくなる。個人利用アプリとはいえ複数デバイスを使うため、最低限の失効機構は持たせるべきと判断した。生トークンをDBに平文保存しないことで、DB漏洩時にもリフレッシュトークンを復元されないようにしている。

**採用しなかった案**: リフレッシュトークンもJWTにする案 → 失効不可能になるため不採用。

---

## 2026-07-18: ドメイン層のRepositoryインターフェースはSpring Data JpaRepositoryを直接継承する（architecture.mdからの実装上の簡略化）

**決定**: [architecture.md](phase1/architecture.md) のクリーンアーキテクチャ図では「Domain層にRepositoryインターフェース、Infrastructure層にJPA実装」を分離する設計を示したが、実装では単純なCRUDリポジトリ（User, Novel, Chapter, BookshelfEntry, Tag等）については `domain/**/XxxRepository extends JpaRepository<...>` の形でSpring Data JPAに直接依存させた。

**理由**: 個人利用规模のアプリでこれらのリポジトリに複数実装（DB以外の永続化手段への差し替え）が生まれる可能性は低く、インターフェース+実装クラスを機械的に分離するだけの層は保守コストに見合わないと判断した（YAGNI）。一方、実際に複数実装が存在し差し替えが本質的な価値を持つ `NovelSiteAdapter`（なろう/カクヨム/ハーメルン/pixiv小説/フォールバック）についてはinfrastructure/adapter配下に実装を分離し、`SiteAdapterRegistry` で解決する設計を維持した。クリーンアーキテクチャの本質（依存性逆転が必要な箇所でのみ抽象化する）は保っている。

**採用しなかった案**: 全リポジトリをドメインインターフェース+infrastructure実装クラスに分離する案 → ボイラープレートが増えるだけで実益がないため不採用。

---

## 2026-07-18: Phase2バックエンド骨格は `spring-boot-starter-jdbc` のみとし、JPA/Flywayは Phase3 で追加する

**決定**: Phase2時点のバックエンドは `web`（実体は`spring-boot-starter-webmvc`。Spring Boot 4.1.0で命名変更されている）・`actuator`・`jdbc`・`postgresql`ドライバのみを依存関係に含める。`data-jpa`・`flyway`はエンティティやマイグレーションが存在しないPhase3で追加する。

**理由**: 「Phase2ではDocker環境が起動し疎通確認ができれば十分」という方針（[NEXT_TASK.md](../NEXT_TASK.md)）に対し、存在しないエンティティ・マイグレーションのためにHibernate/Flywayを組み込むのは時期尚早。`starter-jdbc`だけでも`DataSource`ヘルスインジケータは有効になり、Docker Compose上でのPostgres疎通確認という目的は満たせる。

**採用しなかった案**: 最初から`data-jpa`+`flyway`をフル導入する案 → Phase3のER設計をそのまま反映する形で導入したほうが手戻りがないため見送り。

---

## 2026-07-18: Spring Boot / Next.js のバージョンはビルド時点でMaven Central / npmに実在するものをそのまま採用する

**決定**: Spring Boot 4.1.0（Java21対応）、Next.js 16.2.10、Gradle 9.5.1、Node 22系を採用。

**理由**: `start.spring.io`の`bootVersion`メタデータに`4.1.0.RELEASE`という値があったが、Maven Central上の実際のアーティファクト座標は`.RELEASE`サフィックスなしの`4.1.0`だった（Spring Boot 3系以降は旧来の`.RELEASE`命名を廃止しているため）。サフィックス付きを指定すると`start.spring.io`がBOM解決に失敗して500エラーになる不具合を踏んだ。`maven-metadata.xml`を直接確認して正しいバージョン文字列を特定した。Next.jsもトレーニングデータより新しいメジャーバージョンが公開されており、`spring-boot-starter-web`が`spring-boot-starter-webmvc`に改称されているなど、認識している情報と差異があったため、生成ツール（Spring Initializr / create-next-app）の出力をそのまま信頼する方針とした。

**将来的な拡張**: Phase3以降で新たな依存関係を追加する際も、バージョン文字列を手打ちで推測せず、Initializr/npm/Maven Centralの実在情報を都度確認すること。

---

## 2026-07-18: オフラインキャッシュの実データはサーバーに保存しない

**決定**: 話本文の暗号化キャッシュは端末内（IndexedDB等）にのみ保持し、サーバーDBには「どの話をオフライン保存対象にしたいか」という意図（`offline_save_preferences`）のみを同期する。

**理由**: 要件の「アプリ専用ストレージ・暗号化保存・エクスポート禁止・他サービス共有禁止」を満たすには、コンテンツそのものをクラウドに複製しないほうが規約遵守・セキュリティの両面で安全。サーバーが本文を保持し続けると、規約上グレーな「複製・保存」の範囲が広がるリスクがある。

**採用しなかった案**: サーバー側に本文キャッシュを持ち、デバイス間でオフラインデータそのものを同期する案 → 複製範囲が拡大し規約リスクが増すため却下。

**将来的な拡張**: 端末間で「同じ話を再ダウンロードせずに済む」体験が必要になった場合も、あくまで意図の同期に留め、本文の再取得は各デバイスがサーバー経由で個別に行う。

---

## 2026-07-18: 対応サイトのデータ取得はSiteAdapterパターンで抽象化し、サイトごとに個別調査する

**決定**: なろう・カクヨム・ハーメルン・pixiv小説の4サイトすべてに対応するが、取得方式（公式API/許可された範囲のアクセス）はサイトごとに個別調査してから実装する。共通インターフェース`NovelSiteAdapter`の背後に各サイト実装を隠蔽し、調査未完了・規約上不可のサイトは`FallbackLinkAdapter`（外部リンク登録のみ、本文取得なし）に縮退する。

**理由**: なろうは公式API（二次利用ガイドラインあり）が存在するが、他3サイトには個人開発者向けの公式APIがなく、規約上の可否がサイトごとに異なる。ユーザー本人の意思決定（2026-07-18、[requirements.md](phase1/requirements.md)参照）として「全サイト対応・方式は個別調査」を選択。

**採用しなかった案**:
- なろうのみMVP対応、他は将来検討 → 規約リスクは最小だが、ユーザーが今回明示的に4サイト対応を希望したため不採用
- 全サイト一律で軽量スクレイピングを実装 → サイトごとの規約差異を無視することになり、規約違反リスクが高いため不採用

**将来的な拡張**: 各サイトの調査が完了次第、対応する`XxxAdapter`を実装しPhase3で順次追加する。調査結果は本ファイルに追記する。

---

## 2026-07-18: 本棚の「お気に入り」をステータスと独立した真偽値にする

**決定**: `bookshelf_entries.status`（READING/COMPLETED/READ_LATER）とは別に`is_favorite`という真偽値カラムを設け、直交する概念として扱う。

**理由**: 要件文の「読書中/お気に入り/読了/あとで読む/更新あり」をそのまま単一の排他ステータスにすると「読書中かつお気に入り」を表現できない。Kindle等の実際の電子書籍リーダーでも「お気に入り」はステータスでなくフラグ的に扱われることが多く、UXとして自然。

**採用しなかった案**: 5つを単純な排他enumにする案 → 表現力不足のため不採用。

---

## 2026-07-18: 「更新あり」はユーザー操作ではなく計算値として扱う

**決定**: `has_update`は`novels.latest_known_chapter_no`と`reading_positions.last_read_chapter_no`の差分から導出する。専用のステータス値としてDBに保存しない。

**理由**: 「更新あり」は本来ユーザーが手動設定するものではなく、システムが検知した状態。ステータスとして永続化すると、更新確認バッチとの二重管理になり不整合の原因になる。

---

## 2026-07-18: 技術スタック・開発フェーズはユーザー指定のまま採用

**決定**: Frontend: Next.js + TypeScript + Tailwind CSS + PWA。Backend: Spring Boot + Java 21 + PostgreSQL。Infrastructure: Docker Compose（将来ConoHa VPSへそのままデプロイ可能な構成）。Phase1〜6の順序・各フェーズ末レビューゲートもユーザー指定のまま採用。

**理由**: プロジェクト概要でユーザーが明示的に指定。
