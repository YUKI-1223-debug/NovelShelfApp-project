# Android リリース署名

## 署名鍵（keystore）

- **ファイル**: `frontend/android/app/novelshelf-release.keystore`（**git 管理外**）
- **設定ファイル**: `frontend/android/app/keystore.properties`（**git 管理外**、パスワード等を保持）
- **エイリアス**: `novelshelf` / 鍵種別 RSA 2048 / 有効期限 約27年（validity 10000 日）
- **証明書 SHA-256**: `00c5da29546a9b88cd0d2daa7d50dc8eebc09c0cea81e114e4db10f782027407`

### バックアップ（重要）

この鍵を失うと **同じアプリとしてのアップデートが二度とできなくなる**（Android は更新時に
同一署名鍵を要求。将来 Play Store に出す場合も、Play App Signing に登録するまでは同じ）。

- リポジトリ（Public）には**絶対にコミットしない**。`.gitignore` 済み。
- 開発機のバックアップ: `C:\Users\yuuki\WorkSpace\NovelShelf-secrets\`
  （`novelshelf-release.keystore` + `keystore.properties`）
- **上記フォルダを別の場所（クラウドの非公開ストレージ等）にもコピーしておくこと。**
- パスワードはパスワードマネージャ等に記録（このファイルには書かない）。

## ビルド

```
cd frontend
npm run sync:android          # web を静的エクスポート → cap sync
cd android
./gradlew :app:assembleRelease
# → app/build/outputs/apk/release/app-release.apk（署名済み）
```

`keystore.properties` が無いマシンでは署名がスキップされ、release は未署名 apk になる
（`android/app/build.gradle` の `signingConfigs.release` 参照）。

## 実機インストール

初回、または debug 版から切り替えるときは署名が変わるため**アンインストールしてから**入れる:

```
adb uninstall jp.novelshelf.app     # 端末内データ（キャッシュ・ログイン）も消える
adb install app/build/outputs/apk/release/app-release.apk
```

2回目以降（同じ release 鍵）は `adb install -r ...` で上書き可、データも保持される。

## バージョン更新時

`frontend/android/app/build.gradle` の `versionCode`（整数、必ず増やす）と `versionName`
（表示用、例 "1.1"）を更新してから release ビルドする。
