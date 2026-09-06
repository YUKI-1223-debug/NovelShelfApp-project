# NovelShelf モバイルアプリ化 調査・提案書

作成: 2026-09-06 / 更新: 2026-09-06 / ステータス: **提案（未着手・実装前）**

現在のWeb版（`https://novelshelf.jp` = 自宅ミニPC稼働）を残したまま、Android/iOS に
「インストールして使うアプリ」を追加できるか、現行コードを調査したうえでまとめたもの。

---

## ユーザー確認済み事項（2026-09-06）

1. **「ログインが必要なサイトとの連携」= NovelShelf 自体へのログイン**（JWT で実装済み）。
   外部小説サイト（なろう等）へのログイン連携は**対象外**。→ §5.2 の懸念は消滅。
2. **iOS: Apple Developer Program 加入の意思あり。ただし最初は無料枠で試す。**
   → ただし**無料枠では iOS のプッシュ通知（APNs）が使えない**。iOS でプッシュを動かす時点で
   $99/年 加入が必要（Android は無料枠でもプッシュ可）。§7.2・§5.3 参照。
3. **サーバープッシュ通知まで対応する。** ミニPC 側で更新を検知し、Android/iOS へプッシュ配信する構成。
   → §5.3 に専用設計を追加。

---

## 0. 結論（先に要点だけ）

| 問い | 答え |
|---|---|
| 実現可能か | **可能。** バックエンドは一切作り直し不要。 |
| 大きな作り直しは必要か | **不要。** 既存バックエンド + 既存フロントのコード資産をほぼそのまま活用できる。 |
| 推奨技術 | **Capacitor**（既存 Next.js フロントをネイティブアプリの殻に入れる）。<br>Flutter / React Native は**非推奨**（理由は §3）。 |
| Web版は残せるか | **残せる。** 同じバックエンドAPIを Web と アプリが共用するだけ。 |
| Android を自分の端末に入れる | Linux だけで完結。プッシュ通知含め費用 ¥0。 |
| iOS を自分の iPhone に入れる | **Mac 不要**（クラウドMacビルド）。無料枠で「読書・同期」までは確認できるが、**プッシュ通知と TestFlight 配布には Apple Developer Program ($99/年 ≒ ¥15,000/年)** が必要。 |
| サーバープッシュ通知 | ミニPC で更新検知 → FCM/APNs → 端末。**Android は無料で即可能、iOS は $99/年 加入後**。 |

「PWAではなくインストールするアプリにしたい」という要望に対する回答：
Capacitor で作るものは **PWA ではなく、`.apk` / `.ipa` という本物のネイティブバイナリ**です。
アプリストアにも出せる、OS のプッシュ通知が使える、アプリ専用の暗号化ストレージが使える、
ブラウザ非依存でオフライン起動する ── PWA では超えられなかった iOS の制約もすべて超えられます。
画面の描画に WebView（＝Safari/Chrome と同じ描画エンジン）を使う点だけが「フルネイティブUI」と異なります。
**日本語の縦書き小説リーダーにとっては、これはむしろ最大の利点です（§3・§5で詳述）。**

---

## 1. 現行プロジェクト構成の調査結果

### 1.1 バックエンド（`backend/`）

- Spring Boot 4.1 / Java 21 / PostgreSQL / Flyway（マイグレーション V1〜V8）
- **認証 = JWT Bearer トークン**（`Authorization: Bearer <accessToken>`）
  - アクセストークン TTL 30分 / リフレッシュトークン TTL 30日 / `POST /api/v1/auth/refresh` でローテーション
  - **セッションは完全ステートレス**（`SessionCreationPolicy.STATELESS`）。Cookie 非依存。
  - → **モバイルアプリから叩くのに理想的な形。変更不要。**
- REST API は `/api/v1/**` に整理済み。主なエンドポイント：

  | 分類 | エンドポイント |
  |---|---|
  | 認証 | `POST /auth/signup` `/login` `/refresh` `/logout` `/password-reset/request` `/password-reset/confirm` |
  | サイト | `GET /sites` |
  | 作品 | `POST /novels/resolve` `GET /novels/{id}` `PATCH /novels/{id}` `GET /novels/{id}/chapters` `GET /novels/search` |
  | 本文 | `GET /chapters/{id}/content`（`bodyHtml` を返す） |
  | 本棚 | `GET/POST /shelf` `PATCH/DELETE /shelf/{id}` |
  | タグ | `GET/POST /tags` |
  | 読書位置 | `GET/PUT /reading/positions/{novelId}` |
  | 読書履歴 | `POST/GET /reading/history` |
  | しおり | `GET/POST /bookmarks` `PATCH/DELETE /bookmarks/{id}` |
  | 更新管理 | `GET /updates` `POST /updates/check` |
  | 統計 | `GET /stats/summary` `/breakdown` `/calendar` |
  | 設定同期 | `GET/PUT /settings` |
  | オフライン指定 | `GET/POST /offline/preferences` `DELETE /offline/preferences/{chapterId}` |

- CORS は環境変数 `CORS_ALLOWED_ORIGINS` で制御（`CorsProperties`）。
  - **Capacitor アプリのオリジンは `capacitor://localhost`（iOS） / `https://localhost`（Android）または `http://localhost`。ここを許可リストに足すだけ。** バックエンドのコード変更は不要、環境変数の追記のみ。
- 小説サイト連携（`NovelSiteAdapter`）は **なろう / カクヨム / ハーメルンへの未認証スクレイピング**。
  ユーザーがそれらのサイトにログインする仕組みは持っていない（§5「ログインが必要なサイト」参照）。
- OpenAPI 定義ファイルは**未整備**（要件には「OpenAPIで型共有」とあるが springdoc 未導入）。

### 1.2 フロントエンド（`frontend/`）

- **Next.js 16.2 / React 19 / Tailwind CSS 4**、`output: "standalone"`
- **ほぼ全画面がクライアントコンポーネント**（`"use client"`）。サーバーコンポーネント固有機能
  （`next/headers`・`cookies()`・Server Actions・RSCでのfetch）は**未使用**。
  API ルートは `GET /api/health` の1本のみ。ミドルウェアなし。
  → **実質 SPA。Capacitor 化（静的バンドル化）と相性が良い。**
- 認証トークンは `localStorage`（`novelshelf.accessToken` / `.refreshToken`）に保存。
  API クライアント `src/lib/api/client.ts` が 401 で自動リフレッシュ＆リトライ。
- **オフライン層はすべて実装済み**（`src/lib/offline/`）：
  - `db.ts` … IndexedDB スキーマ（`chapters` / `pendingPositions` / `shelfCache`）
  - `chapterCache.ts` … 話本文の端末内キャッシュ
  - `downloadNovel.ts` … 「全話をオフライン保存」（1話ずつ逐次DL・再開可・バックオフ）
  - `positionQueue.ts` … オフライン中の読書位置をキューし、オンライン復帰時に自動送信
  - `shelfCache.ts` … 本棚一覧のオフライン表示
- **読書画面 `src/app/(protected)/novels/[novelId]/chapters/[chapterId]/page.tsx`（約1,100行）が心臓部**：
  - 縦書き（`writing-mode: vertical-rl`）／横書き
  - スクロールモード／ページ送りモード
  - ページ送りは **DOM の実測（`getClientRects()` を1文字ずつ）でページ境界を算出**する自前実装。
    CSS多段組では縦書きの `column-gap` が効かず文字が見切れる問題を、実機検証を重ねて回避した経緯がある。
  - → **この縦書きページャは「ブラウザの描画エンジン + DOM測定 API」に強く依存している。
    最大の技術資産であり、作り直しコストが最も高い部分。**
- PWA 対応済み（`manifest.ts` / `public/sw.js` / `share_target`）。

### 1.3 その他

- `browser-extension/` … Chrome/Edge 拡張（PC専用、Android Chrome・iOS 非対応）。モバイル化とは無関係。
- インフラ = Docker Compose、Cloudflare Tunnel + 共有 Caddy。ミニPCで24/7稼働。

---

## 2. 希望構成が実現できるか（項目別）

| 希望 | 可否 | 補足 |
|---|---|---|
| Android アプリを作る | ✅ | Capacitor で `.apk` 生成。Linux のみで可能。 |
| iOS アプリを作る | ✅ | Capacitor で `.ipa` 生成。クラウドMacビルドで Mac 不要にできる。 |
| PWA ではなくインストールするアプリ | ✅ | Capacitor の成果物は本物のネイティブバイナリ。 |
| Android/iOS で同一機能 | ✅ | コードは1つ（Web版と共通）。差は通知まわりの細部のみ。 |
| 個人利用前提 | ✅ | むしろ最適。審査・規約対応が要らない。 |
| ストア公開は今はしない | ✅ | Android は野良apk、iOS は TestFlight or Ad-hoc で配布。 |
| 将来のストア公開余地を残す | ✅ | Capacitor アプリはそのまま審査提出可能。 |
| 既存バックエンド/API をそのまま使う | ✅ | `アプリ → /api/v1 → Spring Boot → PostgreSQL` そのまま成立。 |
| Web版を残したままアプリを追加 | ✅ | 同じAPIを共用。Web と アプリが並存。 |

**「スマホアプリ → API → 既存バックエンド → PostgreSQL」構成は、いま現在のバックエンドで
そのまま成立します。** Web ブラウザがやっていることを、アプリの WebView が同じAPIで行うだけです。

---

## 3. 技術選定：Flutter / React Native / Capacitor

### 3.1 判断の軸 ── 縦書き日本語小説の描画

| 方式 | 縦書き（tategaki）対応 | 既存リーダーの扱い |
|---|---|---|
| **Capacitor（WebView描画）** | `writing-mode: vertical-rl` が**そのまま動く**。iOS は WKWebView = Safari、Android は Chromium ベース。禁則処理・ルビも CSS/ブラウザ任せ。 | **1,100行の読書画面をそのまま流用。改修ほぼゼロ。** |
| **Flutter** | 標準の縦書きサポート**なし**。`writing-mode` は存在しない。コミュニティ製パッケージは未成熟（ルビ・禁則処理なし）。実質、縦書きテキストレイアウトエンジンを自作するか、結局 WebView を埋め込むことになる。 | **読書画面を全面作り直し。** DOM測定ベースのページャは移植不能。 |
| **React Native** | CSS がなく `Text` は横書きのみ。縦書きは `react-native-webview` を読書画面にだけ埋め込むのが定石 = **結局 WebView に戻る。** | 読書画面は作り直し or WebView 埋め込み。 |

日本語の縦書き小説リーダーは、**「ネイティブ」を謳うアプリでも本文描画だけは WebView を使う**のが
現実解です（縦書き・ルビ・禁則処理をネイティブで再実装するのは費用対効果が合わない）。
だとすれば、**最初からアプリ全体を WebView ベースにする Capacitor が最も合理的**です。

### 3.2 コード資産の再利用度

| 方式 | バックエンド | APIクライアント/型 | オフライン層 | 読書画面 | 全画面UI | 概算工数 |
|---|---|---|---|---|---|---|
| **Capacitor** | 100% | 100% | 90%（IndexedDB のまま可、暗号化のみ追加） | **95%** | 95% | **小（2〜4週間）** |
| React Native | 100% | 70%（fetch/型は流用、状態管理は書き直し） | 0%（SQLite/MMKVへ移植） | 0〜30% | 0% | 大（2〜4ヶ月） |
| Flutter | 100% | 0%（Dartへ書き直し） | 0% | 0% | 0% | 特大（3〜6ヶ月） |

### 3.3 結論

> **Capacitor を推奨。**

- 個人開発・Linux 環境・Mac なし・縦書きリーダー既存 ── すべての条件で Capacitor が最適。
- Flutter / React Native は「フルネイティブUI」の見た目の魅力はあるが、この小説リーダーの
  中核（縦書きページャ）を捨てて数ヶ月かけて作り直す価値は、個人利用では見合わない。
- 「WebView だから PWA と同じでは？」への回答は §0 のとおり。**成果物は本物のネイティブアプリ**で、
  PWA では不可能だった以下がすべて可能になる：
  - iOS でも確実に動くオフライン（iOS の PWA はストレージが不安定・容量制限が厳しい）
  - OS ネイティブのプッシュ通知（iOS PWA の通知は制約が多い）
  - アプリ専用の暗号化ストレージ（要件 3.5「アプリ専用ストレージに暗号化して保存」を満たせる）
  - App アイコン・スプラッシュ・共有シート・生体認証など OS 機能へのフルアクセス
  - アプリストア提出（将来）

---

## 4. 推奨アーキテクチャ

```
┌─────────────────────────┐        ┌─────────────────────────┐
│  Android アプリ (.apk)   │        │   iOS アプリ (.ipa)      │
│  ┌───────────────────┐  │        │  ┌───────────────────┐  │
│  │ Capacitor 殻       │  │        │  │ Capacitor 殻       │  │
│  │  + ネイティブ Plugin│  │        │  │  + ネイティブ Plugin│  │
│  │  ┌──────────────┐ │  │        │  │  ┌──────────────┐ │  │
│  │  │ WebView       │ │  │        │  │  │ WKWebView     │ │  │
│  │  │ = 既存 Next.js │ │  │        │  │  │ = 既存 Next.js │ │  │
│  │  │   フロント一式  │ │  │        │  │  │   フロント一式  │ │  │
│  │  └──────────────┘ │  │        │  │  └──────────────┘ │  │
│  └───────────────────┘  │        │  └───────────────────┘  │
└───────────┬─────────────┘        └───────────┬─────────────┘
            │       HTTPS / JSON (Bearer JWT)  │
            └────────────────┬─────────────────┘
                             ▼
        ┌────────────────────────────────────────┐
        │  https://novelshelf.jp  (Cloudflare)    │
        │  Caddy → Spring Boot (/api/v1)          │
        │            └→ PostgreSQL                │
        │  ※ Web版フロントも同じサーバーが配信     │
        └────────────────────────────────────────┘
```

- **フロントのコードは1つ**（`frontend/`）。ビルド成果物を
  (a) 従来どおり Web として配信 (b) Capacitor でアプリにバンドル ── の2通りに出力するだけ。
- アプリ内 WebView には**アプリにバンドルした静的ファイルをロード**する（オフライン起動のため）。
  API 通信先だけ `https://novelshelf.jp/api/v1` を向く。
- 読書位置・本棚・設定・履歴の**端末間同期は既存の `/reading` `/shelf` `/settings` API がそのまま担う**。
  Android で読んだ位置を iPhone で開けば続きから ── は今の Web 版で既に動いている仕組みそのまま。

### 4.1 Next.js を Capacitor 用に出力する際の作業

- `next.config` を `output: "export"`（静的エクスポート）に切替。
- 動的ルート（`novels/[novelId]`, `chapters/[chapterId]`, `authors/[authorName]`, `bookmarks` 等 約4系統）に
  `generateStaticParams`（+ クライアント側フェッチ）を用意 ── **中程度の作業。数日規模。**
- `GET /api/health` ルートハンドラはアプリでは不要（Web版専用に分離）。
- `manifest.ts` / Service Worker はアプリ側では Capacitor の仕組みに委譲。

---

## 5. 機能ごとの Android/iOS 実現性・追加実装

| 機能 | 現状 | Capacitor アプリでの扱い | 追加実装 |
|---|---|---|---|
| 縦書き表示 | Web実装済み | WebView でそのまま動作 | **なし** |
| 横書き表示 | Web実装済み | 同上 | なし |
| ダークモード | 設定同期済み（`darkMode`） | そのまま。加えて OS のダーク設定連動やステータスバー色は Capacitor で微調整可 | 任意（小） |
| 小説本文の表示 | `GET /chapters/{id}/content` の `bodyHtml` を描画 | そのまま | なし |
| 読書位置の保存 | `PUT /reading/positions/{novelId}` + オフラインキュー | そのまま | なし |
| 読書履歴 | `POST/GET /reading/history` | そのまま | なし |
| 本棚 | `GET /shelf` + `shelfCache` | そのまま | なし |
| 作者単位の管理 | `authors/[authorName]` 画面 + `GET /shelf?groupBy=author` | そのまま | なし |
| **Android/iOS 間の読書位置同期** | サーバー経由で既に実現（デバイス非依存） | そのまま。**両OSとも同じAPIを見るので自動的に同期** | なし |
| 小説データのキャッシュ | IndexedDB（`chapterCache`） | WebView の IndexedDB がそのまま使える | 任意：暗号化（要件3.5） |
| オフライン読書 | ネット優先・断時キャッシュ・位置キュー | そのまま。アプリバンドルなので**アプリ本体もオフライン起動** | なし |
| **通知（サーバープッシュ）** | **未実装**（設計余地のみ、`docs/KNOWN_ISSUES.md`） | 新規実装。§5.3 に専用設計 | **あり（中）** |
| ログインが必要なサイトとの連携 | = NovelShelf へのログイン（JWT） | そのまま | **なし**（確認済み） |

### 5.1 通知の方針（確認済み: サーバープッシュを採用）

ミニPC 側で小説の更新を検知し、Android / iOS へプッシュ通知を送る。詳細設計は §5.3。

参考: 実装量を抑えたいなら「アプリ内でのローカル通知（`@capacitor/local-notifications`）＋
バックグラウンド定期取得」でも近いことはできるが、iOS はバックグラウンド実行が OS に強く
絞られ確実性が低い。**サーバープッシュ（FCM/APNs）が本命で正解。**

### 5.2 「ログインが必要なサイトとの連携」→ 対象外（確認済み）

「NovelShelf 自体へのログイン」の意味であり、これは JWT で実装済み。アプリでもそのまま動く。
外部小説サイト（なろう等）への読者ログイン連携は**やらない**。

### 5.3 サーバープッシュ通知の設計（ミニPC → Android/iOS）

#### 全体像

```
┌──────────────── ミニPC (Spring Boot) ────────────────┐
│  ① @Scheduled 定期ジョブ（例: 1日2回, レート制限順守）  │
│     本棚にある全作品を再 ingest → latestKnownChapterNo 更新 │
│         │                                              │
│  ② 更新のあった novel を検出                            │
│         │  その novel を本棚に持ち かつ 未読の user を抽出 │
│         ▼                                              │
│  ③ PushSender: user の登録デバイストークンごとに送信     │
│     ├─ Android トークン → FCM HTTP v1 API              │
│     └─ iOS トークン     → APNs (直接 or FCM 経由)       │
└───────┬────────────────────────────────┬───────────────┘
        │ HTTPS                            │ HTTPS
        ▼                                  ▼
   Google FCM                         Apple APNs
        │                                  │
        ▼                                  ▼
  Android 端末の                     iPhone の
  システム通知                        システム通知
        │                                  │
        ▼ タップ                           ▼ タップ
   アプリ起動 → 該当作品の話一覧へ遷移（deep link）
```

#### バックエンド追加分（Spring Boot、いずれも小〜中規模）

| 追加物 | 内容 |
|---|---|
| マイグレーション `V9__push_device_tokens.sql` | `push_device_tokens(id, user_id, platform['ANDROID'/'IOS'], token, created_at, last_seen_at)`。`(user_id, token)` 一意。 |
| `POST /api/v1/push/devices` | アプリ起動時にトークンを登録／更新（upsert）。`{ platform, token }`。 |
| `DELETE /api/v1/push/devices/{token}` | ログアウト時・通知OFF時に解除。 |
| `PushDispatchService` | 更新検知結果 → 対象ユーザー → トークン → FCM/APNs 送信。失敗トークン（`NotRegistered` 等）は自動削除。 |
| `@Scheduled` 更新ジョブ | 既存 `UpdateService.checkUpdatesAsync` を「全ユーザー横断・重複作品は1回だけ再取得」する形に拡張し、差分を `PushDispatchService` に渡す。**なろう等へのアクセス頻度は `NarouRateLimiter`（全体1req/秒）＋ ジョブ間隔（1日1〜2回程度）で従来の配慮方針を維持**（`docs/DECISIONS.md` のレート制限方針）。 |
| 送信ライブラリ | Android/iOS 両方を1本で扱える **Firebase Admin SDK（`com.google.firebase:firebase-admin`）** が最有力。iOS も「APNs 鍵を Firebase に登録 → FCM トークンに送るだけ」で済み、APNs と直接 HTTP/2 で話す実装を書かなくてよい。 |
| 設定 | `FIREBASE_CREDENTIALS`（サービスアカウント JSON のパス）を `.env` / compose に追加。ミニPC のコンテナにマウント。 |
| 通知ON/OFF設定 | `UserSettings` に `pushEnabled` 等を追加（`V10`）。既存の設定同期の仕組みに乗るだけ。 |

#### フロントエンド追加分（Capacitor）

- `@capacitor/push-notifications` プラグイン導入。
- 起動時：権限リクエスト → `register()` → 取得した FCM トークンを `POST /push/devices` へ。
- 通知タップ時：ペイロードの `novelId` を見て `/novels/{novelId}` へ画面遷移（deep link ハンドラ）。
- ネイティブ側の1回設定：
  - Android … `google-services.json` を `android/app/` に配置。
  - iOS … Xcode（＝クラウドビルド側）で Push Notifications capability を有効化 + `GoogleService-Info.plist` 配置。

#### 外部サービス・費用

| サービス | 用途 | 費用 |
|---|---|---|
| Firebase プロジェクト（Spark 無料プラン） | FCM（Android 送信 + iOS 中継） | **¥0**（FCM は送信無制限・無料） |
| APNs 認証鍵（`.p8`, Apple Developer で発行） | iOS へ届けるのに必須。Firebase に登録して使う | **Apple Developer Program $99/年 が必要** |

> **重要な制約: iOS のプッシュ通知は Apple Developer 無料枠では動かない。**
> APNs 鍵の発行にも、Push Notifications capability の付与にも、有料メンバーシップが要る。
> したがって進め方は：
> - **フェーズA（無料枠）**: Android アプリ + Android へのサーバープッシュまで完成させる。
>   iOS は無料プロビジョニングで「本棚・読書・同期」までを実機確認（プッシュ無し・7日ごと入れ直し）。
> - **フェーズB（$99/年 加入後）**: iOS のプッシュを有効化。TestFlight 配布に切替。
>   バックエンドの `PushDispatchService` は最初から iOS トークンも扱えるように作っておき、
>   加入したら APNs 鍵を Firebase に登録するだけで iOS 配信が動き出す状態にしておく。

---

## 6. Android：自分の端末へ直接インストールするのに必要な作業

すべて **Linux で完結・費用 ¥0**。

1. Node.js（既存）+ Android Studio または Android SDK コマンドラインツール + JDK 17 を Linux に導入
2. `npx cap add android` で `android/` ネイティブプロジェクト生成
3. 署名鍵（keystore）を1回作成：`keytool -genkey -v -keystore novelshelf.keystore ...`
4. `npm run build`（Next 静的出力）→ `npx cap sync android` → `./gradlew assembleRelease`
5. できた `app-release.apk` を端末へ：
   - USB + `adb install app-release.apk`、または
   - apk ファイルを端末に転送 → 「提供元不明のアプリ / 不明なアプリのインストール」を許可して開く
6. 更新時は 4〜5 を繰り返すだけ（同じ署名鍵なら上書きインストール）

Google Play に出す場合のみ Play Console 登録料 **$25（1回のみ）**。今回は不要。

---

## 7. iOS：自分の iPhone へ直接インストールするのに必要な環境

### 7.1 必要なもの

| 項目 | 要否 | 備考 |
|---|---|---|
| Apple ID | 必須 | 無料 |
| **Apple Developer Program** | **実質必須（$99/年 ≒ ¥15,000/年）** | 無料枠でも入れられるが §7.2 の理由で実用に耐えない |
| Mac 実機 | **不要にできる** | クラウドMacビルド（§8）で回避可能 |
| Xcode | Mac上で必要 | クラウドビルドサービス側が持っているので自前では不要 |
| iOS の証明書・プロビジョニングプロファイル | 必須 | Apple Developer アカウントで発行。クラウドビルドサービスが自動管理してくれるものもある |

### 7.2 無料 Apple ID で始める場合の制約（ユーザー方針: まず無料枠）

無料（Personal Team）でできること・できないこと：

| | 無料 Apple ID | Apple Developer Program（$99/年） |
|---|---|---|
| アプリの実機インストール | ✅ 可能 | ✅ 可能 |
| 有効期限 | **7日**（毎週リビルド＆入れ直し） | 1年 |
| インストール手段 | Mac + Xcode か AltStore/Sideloadly 等の非公式ツール（Linux/Windows からは不安定） | **TestFlight**（iPhone だけで完結・90日更新・更新通知あり） |
| 同時アプリ数 | 3個まで | 制限緩い |
| **プッシュ通知（APNs）** | **❌ 使えない**（capability 付与・鍵発行に有料メンバーシップが必須） | ✅ 使える |
| Ad-hoc 配布 | ❌ | ✅ |

- **無料枠でできるのは「iOS 実機で本棚・読書・端末間同期の動作確認」まで。**
  希望されているサーバープッシュ通知は **iOS では $99/年 加入まで動きません**（§5.3 の重要制約）。
- そのため §10 の手順は「**Android で全機能（プッシュ含む）を完成 → iOS は無料枠で下見 →
  $99 加入で iOS のプッシュと TestFlight を開通**」という段階構成にしてあります。
- Android には同種の年額費用は一切ありません。年額コストは iOS 側だけの話です。

---

## 8. 開発環境が Linux 中心の場合の対応可否

| 作業 | Linux だけで可能か |
|---|---|
| Capacitor プロジェクト管理・Web ビルド | ✅ 完全に可能 |
| **Android の apk ビルド・署名・実機インストール** | ✅ **完全に可能**（Android Studio / SDK は Linux 版あり） |
| **iOS の ipa ビルド・署名** | ❌ ローカル不可。**macOS + Xcode が必須**（Apple の制約） |
| iOS を Mac なしでビルドする現実的な方法 | ✅ **クラウド Mac ビルドサービス**を使う |

### 8.1 Mac を買わずに iOS ビルドする現実的な選択肢

| サービス | 無料枠 | 特徴 |
|---|---|---|
| **Codemagic** | 500 ビルド分/月（無料） | Capacitor/Ionic 公式が推奨。証明書管理が楽。個人利用ならほぼ無料で回る。 |
| **EAS Build（Expo）** | 無料枠あり（月数回） | Capacitor でも利用可。設定がシンプル。 |
| GitHub Actions（macOS runner） | パブリックリポジトリは無料 / プライベートは分数課金 | 自分でワークフローを書く必要あり。柔軟。 |
| Bitrise | 無料枠あり | UI が親切。 |

- 手順イメージ：コードを push → クラウド上の Mac で `xcodebuild` → 署名済み `.ipa` が生成 →
  TestFlight へ自動アップロード → iPhone の TestFlight でインストール。
- **Mac は一度も触らずに iOS アプリを配布・更新できる。** ただし §7.2 のとおり Apple Developer 登録は必要。

### 8.2 中古 Mac という選択肢

- クラウドビルドの設定・トラブル対応を自分でやるのが面倒なら、中古の Mac mini（M1, 3〜5万円）を
  1台持つと iOS 開発が一気に楽になる。必須ではないが「あると段違い」。

---

## 9. プロジェクトを作り直す必要があるか

**作り直し不要。** 内訳：

| 部分 | 判定 |
|---|---|
| PostgreSQL スキーマ | そのまま |
| Spring Boot バックエンド全体 | そのまま（CORS 許可オリジンの環境変数追記のみ） |
| REST API | そのまま |
| 認証（JWT） | そのまま |
| Next.js フロント（画面・状態管理・スタイル） | そのまま |
| **縦書きページャ（最重要資産）** | **そのまま** |
| オフライン層（IndexedDB） | そのまま（暗号化を足すかは任意） |
| サイトアダプタ | そのまま |

**新規で作るもの：**

1. Capacitor プロジェクトの導入（`@capacitor/core` `/cli` `/android` `/ios`）
2. Next.js の静的エクスポート対応（動的ルートの `generateStaticParams` 化）── 中程度
3. アプリ用の設定分岐（API ベースURL 固定、Service Worker/manifest はアプリ側に委譲）
4. Android 署名鍵の作成、iOS 証明書・プロビジョニングの発行
5. iOS 用クラウドビルドの CI 設定（Codemagic 等）
6. **サーバープッシュ通知**（§5.3）：バックエンドにデバイストークン登録 API + `@Scheduled` 更新検知 +
   Firebase Admin SDK 送信 / フロントに `@capacitor/push-notifications` + deep link。
   マイグレーション `V9`（トークン表）・`V10`（通知ON/OFF設定）。Firebase プロジェクト作成。
7. （任意）キャッシュの暗号化、生体認証ロック、ネイティブ共有シート統合

---

## 10. 回答まとめ（依頼フォーマット）

### 実現可能か
**可能。** バックエンド・DB は無改修。フロントも大半を流用。

### 推奨する技術
**Capacitor**（既存 Next.js フロントをネイティブアプリ化）。
Flutter・React Native は縦書きリーダーを作り直す羽目になるため非推奨。

### 推奨するアーキテクチャ
`Android/iOS アプリ（Capacitor 殻 + WebView に既存フロント）` → `HTTPS + Bearer JWT` →
`既存 Spring Boot (/api/v1)` → `PostgreSQL`。Web 版フロントも同じサーバーが並行配信。
読書位置・本棚・設定の端末間同期は既存の同期APIがそのまま担当。

### 現在のプロジェクトから再利用できる部分
バックエンド全体 / DB / REST API / JWT認証 / Next.js 全画面 / 縦書き・横書きリーダー /
オフライン層 / サイトアダプタ / 設定・履歴・統計・しおり・本棚・作者ページ。**9割以上。**

### 新規開発が必要な部分
Capacitor 導入 / Next.js 静的エクスポート化（動的ルート対応、中程度）/ アプリ用ビルド設定 /
署名・証明書 / iOS クラウドビルド CI / **サーバープッシュ通知（§5.3、バックエンド + フロント + Firebase）** /
（任意）キャッシュ暗号化・生体認証。

### Android で必要な環境
Linux + Node.js（既存）+ JDK 17 + Android Studio/SDK。署名鍵1個。Firebase プロジェクト（無料）。**費用 ¥0。**

### iOS で必要な環境
- **無料枠で始める場合**: Apple ID のみ。本棚・読書・同期の実機確認まで可能（プッシュ不可・7日ごと入れ直し）。
- **プッシュ通知・TestFlight 配布まで**: **Apple Developer Program $99/年** + APNs 認証鍵（`.p8`）。
- ビルドはクラウド Mac ビルド（Codemagic 等、無料枠）。Mac 所有は不要。

### Mac が必要になる作業
iOS の `.ipa` ビルドと署名（`xcodebuild`）。**ただしクラウド Mac ビルドで肩代わり可能なので、
Mac を所有する必要はない。** ローカル Linux では iOS ビルドは一切できない。

### 個人利用の場合の費用
| 項目 | 費用 |
|---|---|
| Android（自分の端末に入れる） | ¥0 |
| iOS（自分の iPhone に入れる） | **Apple Developer Program $99/年（≒ ¥15,000/年）** |
| クラウド Mac ビルド | ¥0（Codemagic/EAS の無料枠で個人利用は十分） |
| サーバー | 現状のまま（ミニPC、追加費用なし） |
| Firebase（FCM、Spark 無料プラン） | ¥0（FCM 送信は無料・無制限） |
| （将来）Google Play 公開 | $25（1回のみ） |
| （将来）App Store 公開 | 上記 $99/年に含まれる |
| **当面の合計** | **Android のみ ¥0** / **iOS プッシュまで含めて ¥15,000/年** |

### 想定される問題点・制約
- **iOS のプッシュ通知は Apple Developer 無料枠では動かない**（APNs 鍵・capability が有料メンバー限定）。
  無料枠期間は Android でプッシュ完成 → iOS はプッシュ以外を確認、という段階分けが必要。
- **無料 Apple ID はアプリが7日で切れ、インストールに Mac/非公式ツールが要る**。$99 加入で TestFlight に移行。
- Next.js 静的エクスポートで**動的ルートの対応**（`generateStaticParams`）が必要 ── 数日規模の作業。
- **サーバープッシュは新規実装**：デバイストークン表・登録API・`@Scheduled` 更新検知の全ユーザー横断化・
  Firebase Admin SDK 連携。中規模だが既存の `UpdateService` / 設定同期 に乗せられる。
- **更新検知ジョブのアクセス頻度**：なろう等への再取得は `NarouRateLimiter`（全体1req/秒）＋
  ジョブ間隔 1日1〜2回程度に抑え、既存のレート制限方針（`docs/DECISIONS.md`）を維持すること。
- WebView 描画のため、極端に古い OS では描画エンジンの差が出る可能性（実用上は問題になりにくい）。
- iOS の WebView オフラインストレージは Android より上限が渋め（大量作品の一括保存時に要注意。
  Capacitor の Filesystem プラグインで逃がす手はある）。
- クラウド Mac ビルドは初回の証明書・プロビジョニング設定でつまずきやすい（一度通れば安定）。
- iOS の WKWebView は縦書きは問題ないが、稀に `100vh` 計算やスクロール慣性で癖が出る
  （既存で `h-dvh` 対応済みなので大きな懸念ではない）。

### 開発難易度
**中。** バックエンドの中核（認証・API・DB）は無改修。フロントも既存流用が中心。
難所は (1) Next.js 静的エクスポート化、(2) サーバープッシュ通知の新規実装（バックエンド + Firebase）、
(3) iOS の証明書・クラウドビルド初期設定。
Flutter/RN を選んだ場合の「読書画面フル作り直し」に比べれば圧倒的に軽い。

### おすすめの開発手順（段階構成）

**フェーズ 0 — Web 側の準備（アプリ着手前に単独で進められる）— ✅ 完了（2026-09-06）**
1. ~~Next.js を `output: "export"` 対応に~~ → 完了。動的ルートはクエリパラメータ方式（`/novel?id=` /
   `/reader?novel=&chapter=` / `/author?name=`）へ移行（`generateStaticParams` 方式より Capacitor SPA に堅牢）。
   `NEXT_OUTPUT=export` で `out/` 生成を確認。Web の standalone ビルドは無変更で従来どおり動作。詳細は PROGRESS.md。

**フェーズ A — Android を無料で完成させる（費用 ¥0）**
2. Capacitor 導入（`capacitor.config.ts`、webDir を Next 出力先に、API を `https://novelshelf.jp/api/v1` へ固定）。
3. `npx cap add android` → 署名鍵作成 → apk ビルド → 自分の Android にインストール。
   ← **最初のマイルストーン：Android で本棚・読書・端末間同期が本物のアプリとして動く。**
4. **サーバープッシュ（バックエンド）**：`V9` デバイストークン表 + `POST/DELETE /push/devices` +
   `@Scheduled` 全ユーザー横断の更新検知 + Firebase Admin SDK 送信。ミニPC に `FIREBASE_CREDENTIALS` 追加。
5. **サーバープッシュ（フロント/Android）**：`@capacitor/push-notifications` + `google-services.json` +
   通知タップの deep link。Android 実機で「ミニPCが更新検知 → スマホに通知 → タップで作品へ」を確認。
6. 通知 ON/OFF 設定（`V10`、既存の設定同期に相乗り）。

**フェーズ B — iOS を無料枠で下見**
7. 無料 Apple ID + クラウド Mac ビルド（Codemagic）で `.ipa` 生成 → 実機へ（7日期限）。
   縦書き・オフライン・端末間同期を iPhone で確認。**プッシュはこの段階では未確認でよい。**

**フェーズ C — iOS 本開通（$99/年 加入）**
8. Apple Developer Program 加入 → APNs 認証鍵（`.p8`）を Firebase に登録 → Push capability 有効化。
   バックエンドは iOS トークンを最初から扱えるようにしてあるので、鍵登録だけで iOS 配信が動き出す。
9. TestFlight 配布に切替（iPhone だけで入れ直し可能に）。iOS 実機でプッシュ通知を確認。

**フェーズ D — 仕上げ（任意）**
10. キャッシュ暗号化、生体認証ロック、ネイティブ共有シート、スプラッシュ/アイコン、OS ダークモード連動。

**フェーズ E — 将来**
11. 必要になったら Capacitor アプリをそのまま Google Play / App Store 審査へ提出。

---

## 付録：次に決める / 用意すること

- **開発環境**（着手時にインストール依頼）: JDK 17 / Android Studio（or cmdline-tools）。Node.js は既存。
- **Firebase プロジェクト**の作成（無料）。フェーズ A-4 で必要。
- iOS は当面フェーズ B まで（無料枠）。プッシュを iPhone でも使いたくなった時点でフェーズ C（$99/年）へ。
- 着手判断：この提案でよければ、まずフェーズ 0（Next.js 静的エクスポート化）から着手可能。
