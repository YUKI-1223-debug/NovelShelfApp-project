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

## 配置状況（アプリ側）— 完了

- `frontend/android/app/google-services.json` 配置済み（project `novelshelf-6520c`、`.gitignore` 済み）。
- `build:app` は `NEXT_PUBLIC_PUSH_ENABLED=true`。push 有効版 release apk をビルド・実機インストール済み。

## バックエンド側（ミニPC デプロイ手順）

サービスアカウント JSON を受領後、ミニPC で:

```bash
cd /srv/NovelShelfApp-project
git pull
mkdir -p secrets
# サービスアカウント JSON を secrets/firebase-service-account.json として配置（scp 等）
cd docker
docker compose --env-file ../.env -f docker-compose.yml -f docker-compose.minipc.yml up -d --build
```

- `docker-compose.minipc.yml` が `../secrets/` を `/run/secrets/`（ro）にマウント、
  `FIREBASE_CREDENTIALS=/run/secrets/firebase-service-account.json` を設定済み。
- ファイルが無くてもバックエンドは起動する（「未設定」扱い＝送信せずログのみ）。
- 起動ログに `Firebase Cloud Messaging を初期化しました（project=novelshelf-6520c）` が出れば有効。

## 動作確認

1. アプリでログイン → 通知の許可ダイアログで許可（トークンが `POST /api/v1/push/devices` で登録される）
2. `POST /api/v1/push/test`（要ログイン）→ 自分の端末に「テスト通知です」が届くか
3. `POST /api/v1/push/run-update-check` → 本棚作品を再取得し、更新があれば通知（時間がかかる）
4. 以降は毎日 07:00 / 19:00（JST）に自動実行

## 費用

- Firebase Spark（無料）プランで FCM 送信は無制限・無料。
- iOS のプッシュのみ Apple Developer $99/年 が必要（APNs 鍵の発行に必須）。
