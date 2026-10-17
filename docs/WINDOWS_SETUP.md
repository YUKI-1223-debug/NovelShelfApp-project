# Windows デスクトップアプリ（Tauri）

2026-10 に追加（個人利用アプリ化 S2-5）。画面は `frontend` の静的エクスポート（`out/`）をそのまま同梱し、API はミニPCの tailnet 入口 `https://minipc.tail0347f4.ts.net:8445` に `tauri-plugin-http` 経由で送る（WebView の CORS の対象外）。ログインは無く、サーバーのオーナー固定モードで認証する。

JavaSilver の `desktop/`(元は AI秘書の `desktop/`)を雛形にし、トレイ常駐・自動起動・サイドカーは外した。自動更新とコード署名はしない（自分の PC だけで使うため）。

## 前提

- Node.js、Rust（`cargo`）、WebView2（Windows 11 は標準で入っている）
- PC が Tailscale に参加していること

## ビルド

```bash
cd frontend
npm run build:app          # out/ を作る（API の向き先は package.json の build:app で指定）
cd ../desktop
npm install                # 初回だけ
npx tauri build
```

できるもの: `desktop/src-tauri/target/release/bundle/nsis/NovelShelf_<version>_x64-setup.exe`

## インストール

上の setup.exe を実行する（ユーザー単位のインストール。管理者権限は不要）。2回目以降は上書きインストールでよい。

## 設定の要点

| ファイル | 内容 |
|---|---|
| `src-tauri/tauri.conf.json` | `identifier: jp.novelshelf.desktop`、`frontendDist: ../../frontend/out`、NSIS のみ |
| `src-tauri/capabilities/default.json` | HTTP は `https://minipc.tail0347f4.ts.net:8445/*` だけ許可。API の向き先を変えたらここも変える |
| `src-tauri/Cargo.toml` | `tauri-plugin-http` は frontend の `@tauri-apps/plugin-http`（2.6.0）と版をそろえる（`~2.6`） |
| `src-tauri/icons/` | iOS のアイコン（`AppIcon-512@2x.png`）から `npx tauri icon` で作った |

ウィンドウの位置と大きさは `tauri-plugin-window-state` が覚える。

## NovelShelf 固有の注意

- backend の CORS で `http://tauri.localhost` を許可している必要がある（`docker/docker-compose.minipc.yml` の `CORS_ALLOWED_ORIGINS`）。Tauri の plugin-http は Origin ヘッダを付けて送るので、許可しないと 403 になる
- オフライン保存（IndexedDB）は WebView2 のプロファイルに保存される。アンインストールしても残ることがある
- 共有シートは無いので、PC ではブラウザ拡張（`browser-extension/`）か「URL を貼り付けて追加」を使う
