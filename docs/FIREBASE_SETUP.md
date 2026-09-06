# プッシュ通知（Firebase / FCM）セットアップ

ミニPC で本棚作品の更新を検知 → FCM（iOS は APNs 中継）→ Android/iOS 端末へ通知、という構成。
実装済み（[PROGRESS.md](PROGRESS.md)）。あとは Firebase の設定ファイル2つを配置すれば有効になる。

## 必要なファイル（2つ）

| ファイル | 用途 | 置き場所 | 秘密度 |
|---|---|---|---|
| `google-services.json` | アプリ側（FCM トークン取得） | `frontend/android/app/` | 中（git 管理外にする） |
| サービスアカウント JSON | バックエンド側（送信） | ミニPC の `NovelShelf-secrets/` 等 → コンテナにマウント | **高（絶対に公開しない）** |

## ユーザー作業手順

### 1. Firebase プロジェクト作成
1. https://console.firebase.google.com/ →「プロジェクトを追加」
2. 名前: `NovelShelf`（任意）
3. Google アナリティクスは**無効**でよい → 作成

### 2. Android アプリを登録
1. プロジェクト概要 → アプリを追加 → Android
2. パッケージ名: `jp.novelshelf.app`
3. ニックネーム: NovelShelf（任意）、SHA-1 は空でよい
4. **`google-services.json` をダウンロード** → このファイルを渡す
5. 残りの SDK 手順（Gradle 追記等）は Capacitor 側で対応済みなのでスキップしてよい

### 3. 送信用サービスアカウント鍵
1. プロジェクトの設定（⚙️）→「サービス アカウント」タブ
2. 「新しい秘密鍵の生成」→ JSON がダウンロードされる
3. **この JSON を渡す**（これは秘密。GitHub には絶対に置かない）

### 4. （iOS を後で対応するとき）APNs 認証鍵
- Apple Developer（$99/年）加入後、APNs 用の `.p8` 鍵を作成し
  Firebase の「Cloud Messaging」→ Apple アプリの構成 に登録する。
- Android には不要。

## 配置後（こちら側の作業）

- `google-services.json` を `frontend/android/app/` に置く（`.gitignore` 追加）。
- `frontend/package.json` の `build:app` を `NEXT_PUBLIC_PUSH_ENABLED=true` に変更。
- `npm run sync:android` → `assembleRelease` → 実機インストール。
- サービスアカウント JSON をミニPCに置き、`docker-compose.minipc.yml` でコンテナにマウント、
  `.env` に `FIREBASE_CREDENTIALS=<コンテナ内パス>` を追加してバックエンド再デプロイ。
- 動作確認: アプリで通知を許可 → `POST /api/v1/push/test` で自分の端末に届くか、
  `POST /api/v1/push/run-update-check` で更新検知→通知が動くか。

## 費用

- Firebase Spark（無料）プランで FCM 送信は無制限・無料。
- iOS のプッシュのみ Apple Developer $99/年 が必要（APNs 鍵の発行に必須）。
