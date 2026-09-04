# NovelShelf 移設手順書: ConoHa VPS → 自宅ミニPC（DBデータ保持）

作成日: 2026-08-29 / 更新: 2026-09-04

> **★2026-09-04 実施完了。** カットオーバー成功（当初 09-05 予定を1日前倒し）。`novelshelf.jp` は自宅ミニPCで本番稼働中。
> この文書は「実施したことの記録」兼「ロールバック時の逆手順の参照元」として残す。移設後の残タスク・
> 全体進捗の SSOT は [`../../ミニPC移行_進捗管理.md`](../../ミニPC移行_進捗管理.md)。
>
> 実施結果の要点: 論理ダンプ方式（2章）で移設。全12テーブルの件数が VPS と完全一致。`JWT_SECRET` 据置で
> ユーザーの再ログイン不要。HSTS 有効化・Universal SSL 確認済み。VPS backend/frontend は停止で cold standby。

`https://novelshelf.jp` を、現行の ConoHa VPS（`163.44.116.137`）から自宅ミニPC（GMKtec Ryzen 7 7730U / Ubuntu Server）へ、**DBデータを保持したまま**移設する手順。

**本番環境を変更するコマンドは必ずユーザー自身の手で実行すること**（Claude Code が直接 VPS・ミニPC・Cloudflare を操作することはない）。この文書のコマンドは「用意されたものをユーザーが実行する」前提。

関連文書:
- ミニPCのOS・ネットワーク土台: [`../../ミニPC-Linux移行手順.md`](../../ミニPC-Linux移行手順.md)（Cloudflare Tunnel + 共有Caddy の構築は6章）
- 現行VPSのデプロイ手順: [`DEPLOY.md`](DEPLOY.md)

---

## 0. 方針と前提

| 項目 | 内容 |
|---|---|
| 外部公開方式 | Cloudflare Tunnel（自宅回線はau系・CGNATなしだが二重NAT＋動的IPのため。詳細は移行手順書6-0） |
| リバースプロキシ | 共有 Caddy（`/srv/edge/`）。NovelShelf 自前の `nginx` / `certbot` は**廃止** |
| TLS | Cloudflare がエッジで終端。Let's Encrypt 証明書の持ち運び不要 |
| ダウンタイム | 利用者はユーザー本人のみ → 30分程度のメンテ窓でよい。無停止化の工夫は不要 |
| ロールバック | Cloudflare の `novelshelf.jp` レコードを Tunnel(CNAME) から A→VPS へ戻すだけ。VPSは3〜7日残す |

### データの所在（コード確認済み・2026-08-29）

- 永続データは **PostgreSQL の `postgres_data` ボリュームに全て格納**されている
- 小説の本文・話一覧・章情報・ユーザー・本棚・お気に入り、すべて DB 内。**ファイルシステムへの保存は無い**（バックエンドにファイルストレージ実装なし）
- したがって移設対象は実質「Postgres の中身」だけ。証明書ボリューム（`certbot_certs`）は Cloudflare 方式では不要なので持っていかない

---

## 1. 事前準備（カットオーバーの数日前まで）

### 1-1. ミニPC の土台（移行手順書 0〜6章）を完了させる

- Ubuntu Server セットアップ、Docker/Compose 導入
- `/srv/edge/` に共有 Caddy + cloudflared を構築（移行手順書 6-3）。Cloudflare ゾーンは "Active"、Tunnel は "Registered tunnel connection" まで確認済みであること
- この時点で Cloudflare の `novelshelf.jp` レコードは **まだ A → `163.44.116.137`（プロキシOFF）のまま**にしておく（挙動を変えない）

### 1-2. ネームサーバーをムームードメイン → Cloudflare へ移管済みにする

移行手順書 6-1 の通り。移管中もサイトは無停止（Cloudflare が同じ A→VPS を返すだけ）。**現行のDNSレコードを事前に全部控えること**（A / MX / TXT(SPF) など。NovelShelf は SMTP 未設定のため MX は無い見込みだが要確認）。

### 1-3. リポジトリをミニPCへ配置

```bash
# ミニPC上
sudo mkdir -p /srv && sudo chown $USER:$USER /srv
cd /srv
git clone https://github.com/YUKI-1223-debug/NovelShelfApp-project.git
cd NovelShelfApp-project
```

### 1-4. ミニPC用の compose オーバーレイを作成

`docker/docker-compose.minipc.yml`（新規。VPS用の `docker-compose.prod.yml` に相当するミニPC版。`nginx`/`certbot` を含まず、共有 `edge` ネットワークに相乗りする）:

```yaml
# ミニPC本番オーバーレイ。共有Caddy(/srv/edge)配下で動かす。
# 使用例:
#   cd docker
#   docker compose --env-file ../.env -f docker-compose.yml -f docker-compose.minipc.yml up -d --build
#
# TLSはCloudflareがエッジで終端。このスタックは平文HTTPを共有Caddyに渡すだけ。

services:
  postgres:
    restart: unless-stopped
    ports: !reset []          # ホストに公開しない

  backend:
    restart: unless-stopped
    ports: !reset []          # 共有Caddy経由でのみ到達
    environment:
      JAVA_TOOL_OPTIONS: "-Xmx768m"    # 32GB機なので余裕はあるが現行と揃える
      FRONTEND_BASE_URL: https://${DOMAIN}
    networks:
      default: {}
      edge:
        aliases: [novelshelf-backend]

  frontend:
    build:
      args:
        NEXT_PUBLIC_API_BASE_URL: https://${DOMAIN}/api/v1
    restart: unless-stopped
    ports: !reset []
    networks:
      default: {}
      edge:
        aliases: [novelshelf-frontend]

networks:
  edge:
    external: true
```

### 1-5. `.env` をミニPCに用意

`/srv/NovelShelfApp-project/.env`（`.env.example` をコピーして編集）。**現行VPSの `.env` と揃えるべき項目に注意**:

| 変数 | 値 | 注意 |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_DB` | VPSと**同一**（既定 `novelshelf` / `novelshelf`） | pg_restore が同名で流し込むため |
| `POSTGRES_PASSWORD` | 論理ダンプ方式なら**変更可**（新ボリュームを `.env` の値で初期化するため）。物理コピー方式なら**同一必須** | 変更するなら安全な乱数に |
| `JWT_SECRET` | VPSと**同一にする** | 変えると全ユーザーのリフレッシュトークンが無効化され再ログインが必要。揃えれば無停止でセッション維持 |
| `DOMAIN` | `novelshelf.jp`（コメントアウト解除） | |
| `CORS_ALLOWED_ORIGINS` | `https://novelshelf.jp` | |
| `NEXT_PUBLIC_API_BASE_URL` | `https://novelshelf.jp/api/v1` | frontend のビルド引数に反映される |
| `ACME_EMAIL` | 不要（Cloudflare方式では使わない。空でよい） | |
| `MAIL_*` | 現状VPSでも未設定なら空のまま | |

> 現行VPSの `.env` の中身を確認するには VPS で `cat ~/NovelShelfApp-project/.env`。`JWT_SECRET` と（物理コピー方式を選ぶ場合は）`POSTGRES_PASSWORD` を書き写す。

### 1-6. Caddyfile に NovelShelf ブロックがある状態にしておく

移行手順書 6-3 の Caddyfile の `@novelshelf` ブロックが有効になっていること。

---

## 2. カットオーバー（メンテ窓、30分想定）

### 2-1. VPS 側: 書き込みを止めてダンプ

```bash
# VPS: ssh -i ~/.ssh/novelshelf_vps user@163.44.116.137
cd ~/NovelShelfApp-project/docker
COMPOSE="docker compose --env-file ../.env -f docker-compose.yml -f docker-compose.prod.yml"

# アプリを止める（postgresは起動したまま）。以降ユーザーのアクセスは502になる = メンテ開始
# ★ここで止めた backend/frontend は移行後も再起動しない（split-brain防止。T+7dまで停止のまま）
$COMPOSE stop backend frontend

# 論理ダンプ（カスタム形式）。ファイル名を固定して控える
DUMP=~/novelshelf_$(date +%Y%m%d_%H%M).dump
$COMPOSE exec -T postgres pg_dump -U novelshelf -Fc --no-owner novelshelf > "$DUMP"
ls -lh "$DUMP"
echo "$DUMP"   # このファイル名を次段で明示的に使う
```

### 2-2. ダンプをミニPCへ転送

```bash
# 開発機（Windows / Git Bash）で実行。<DUMP> は 2-1 で echo したファイル名（例 novelshelf_20260910_0130.dump）
scp -i ~/.ssh/novelshelf_vps user@163.44.116.137:'~/<DUMP>' .
scp -i ~/.ssh/minipc_key <DUMP> <ミニPCユーザー>@<ミニPCのLAN-IP>:/srv/NovelShelfApp-project/
```

（ミニPCが同一LANにあり鍵設定済みなら、VPS→ミニPC直接 scp でもよい）

### 2-3. ミニPC 側: postgres だけ起動してリストア

```bash
# ミニPC
cd /srv/NovelShelfApp-project/docker
COMPOSE="docker compose --env-file ../.env -f docker-compose.yml -f docker-compose.minipc.yml"

# postgresだけ起動（初回は空のnovelshelf DBが作られる）
$COMPOSE up -d postgres
sleep 10
$COMPOSE exec -T postgres pg_isready -U novelshelf

# リストア（<DUMP> は転送したファイル名を明示。ワイルドカードは使わない）
cat /srv/NovelShelfApp-project/<DUMP> | \
  $COMPOSE exec -T postgres pg_restore -U novelshelf -d novelshelf --no-owner --no-privileges --exit-on-error

# プランナ統計を更新（しないと autovacuum が回るまで一部クエリが遅い）
$COMPOSE exec -T postgres psql -U novelshelf -d novelshelf -c "ANALYZE;"

# 件数の目安確認
$COMPOSE exec -T postgres psql -U novelshelf -d novelshelf -c \
  "select (select count(*) from users) as users, (select count(*) from novels) as novels, (select count(*) from chapters) as chapters;"
```

> - 空DBへの初回リストアなので `--clean` は不要（付けると存在しないオブジェクトへの DROP 警告が大量に出る）。`--exit-on-error` で異常を確実に検知する。
> - `V1__init.sql` の `CREATE EXTENSION IF NOT EXISTS pgcrypto` はダンプにも含まれ、リストアユーザー（=クラスタのスーパーユーザー）で実行されるため問題ない。`postgres:16-alpine` に pgcrypto は同梱。
> - 再実行する場合は先に `$COMPOSE down -v` で postgres ボリュームごと消してやり直す（中途半端な状態への再リストアを避ける）。

### 2-4. ミニPC 側: 全サービス起動

```bash
$COMPOSE up -d --build
$COMPOSE ps        # backend / frontend が healthy になるまで待つ（初回ビルドは数分）
```

Flyway マイグレーションは backend 起動時に流れる。ダンプにスキーマ＋`flyway_schema_history` が入っているので、追加適用は無い（バージョンが揃っていれば no-op）。

### 2-5. DNS切替前の疎通確認（Cloudflareをまだ切り替えない状態で）

> Caddy の80番はホストに publish しないため `curl --resolve novelshelf.jp:80:<LAN-IP> ...` は**動かない**。
> `edge` ネットワークに使い捨てコンテナを繋いで、cloudflared と同じ経路（`http://caddy:80`）をなぞる。

```bash
# ミニPC。本番経路(cloudflared→caddy→app)を再現。ホストへの露出ゼロ。
docker run --rm --network edge curlimages/curl:latest -sS -i \
  -H 'Host: novelshelf.jp' http://caddy/ | head -30
docker run --rm --network edge curlimages/curl:latest -sS -o /dev/null -w '%{http_code}\n' \
  -H 'Host: novelshelf.jp' http://caddy/api/v1/sites
#   → / が 200 (HTML)、/api/v1/sites が 401 なら caddy→frontend/backend 到達OK
```

フロントのブラウザ操作（ログイン〜読書）は、バンドルに `https://novelshelf.jp/api/v1` が焼き込まれているため
**カットオーバー直後**に（2-6 の後、ロールバック手順を準備した状態で）実施する。詳細は
[`../../ミニPC-Linux移行手順.md`](../../ミニPC-Linux移行手順.md) の 9-2。

### 2-6. Cloudflare で `novelshelf.jp` を Tunnel へ切替（ユーザー、ブラウザ作業）

1. Cloudflare ダッシュボード → DNS → `novelshelf.jp` の **A レコード（→163.44.116.137）を削除**
2. Zero Trust → Networks → Tunnels → `minipc` → Public Hostname に `novelshelf.jp` → `HTTP` → `caddy:80` が登録済みであることを確認（未登録なら追加）
   - 保存時に Cloudflare が `novelshelf.jp` の **CNAME →`<tunnel-uuid>.cfargotunnel.com`（プロキシON）** を自動作成する
   - 自動作成されない場合は DNS で手動追加（Type: CNAME, Name: `novelshelf.jp`, Target: `<tunnel-uuid>.cfargotunnel.com`, Proxy: ON）
3. 反映は数秒〜1分（Cloudflareが権威DNSのため）

### 2-7. 本番疎通確認

```bash
# 開発機など外部から
curl -I https://novelshelf.jp/
curl -I https://novelshelf.jp/api/v1/sites      # 401 ならOK
```

ブラウザで `https://novelshelf.jp` を開き、**既存アカウントでログイン**（＝DBが引き継がれている）→ 本棚・お気に入り・読書画面まで一連の動作を確認（`frontend/e2e/critical-journey.spec.ts` と同じ流れ）。

---

## 3. ロールバック（問題が出たら）

Cloudflare DNS で:
1. `novelshelf.jp` の CNAME（→cfargotunnel）を削除
2. A レコード `novelshelf.jp` → `163.44.116.137`（プロキシは任意、元がOFFならOFF）を再作成
3. VPS 側でアプリを戻す:
   ```bash
   # VPS
   cd ~/NovelShelfApp-project/docker
   docker compose --env-file ../.env -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

VPS を停止していた間にミニPC側で発生した書き込み（＝メンテ窓中のユーザー本人の操作のみ）は失われるが、実質影響なし。

---

## 4. 事後処理（ミニPCで数日安定してから）

進捗の詳細・期限は [`../../ミニPC移行_進捗管理.md`](../../ミニPC移行_進捗管理.md) §4末尾の P1〜P14 表が正。

- [x] ミニPC で日次 `pg_dump` を timer 化（`backup.sh` + `backup.timer`、restic、毎日 03:34）— 2026-09-04
- [x] `docs/DEPLOY.md` を「ミニPC版 + 旧VPS手順（アーカイブ）」に再構成 — 2026-09-04
- [x] `docs/NEXT_TASK.md` / `docs/DECISIONS.md` / `docs/PROGRESS.md` / `docs/USER_TODO.md` に移設完了を記録 — 2026-09-04
- [ ] restic のオフサイト保存先（Backblaze B2）を設定（P3。**最優先の残タスク**）
- [ ] リストア試験（空DBへ復元 → ログインまで。ConoHa 解約の必須条件、P5）
- [ ] **T+7d（〜09-11頃）**: VPS で最終 `pg_dump` → オフサイト退避 → VPS アプリ `docker compose down`（cold standby 化）
- [ ] **T+21d（〜09-25以降）**: VPS の証明書更新 cron 削除 → ConoHa「イメージ保存」→ ConoHa VPS を解約（付録D-3 全項目クリアが条件）
- [ ] `docker/nginx/`・`certbot` サービス・`docker-compose.prod.yml` の扱いを決める（ConoHa 解約までは VPS 復帰用に残置）

---

## 5. 代替案: 物理ボリュームコピー

`pg_dump` の代わりに `postgres_data` ボリュームを丸ごと tar で移す方法。

```bash
# VPS: 全サービス停止してから
cd ~/NovelShelfApp-project/docker
docker compose --env-file ../.env -f docker-compose.yml -f docker-compose.prod.yml down
VOL=$(docker volume ls -q | grep postgres_data)      # 例: docker_postgres_data
docker run --rm -v $VOL:/data -v ~/:/backup alpine tar czf /backup/pgdata.tgz -C /data .

# ミニPC: postgresを一度も起動していない状態で
docker volume create novelshelfapp-project_postgres_data   # 実際のプロジェクト名に合わせる
docker run --rm -v novelshelfapp-project_postgres_data:/data -v /srv/NovelShelfApp-project:/backup \
  alpine sh -c "cd /data && tar xzf /backup/pgdata.tgz"
```

- 両側とも `postgres:16-alpine`・x86_64 で完全一致するため動く（Postgresのメジャー/マイナーとアーキが一致していること）
- **`POSTGRES_PASSWORD` は VPS と同一必須**（パスワードがデータに焼き込まれている）
- 速いが、破損があればそのまま運ぶ・バージョン差に弱い。**基本は `pg_dump` 方式を推奨**

---

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| backend が起動せず認証エラー | `.env` の `POSTGRES_PASSWORD` と実データのパスワードがズレている（物理コピー時に多い）。VPSの `.env` と一致させる。`--env-file ../.env` を明示しているか（`docker/` から相対指定すると `.env` を見失う既知の罠、[NEXT_TASK.md](NEXT_TASK.md) 注意事項参照） |
| `novelshelf.jp` が 502 / 503 | `docker compose ps` で backend/frontend が healthy か。Caddy が `novelshelf-backend`/`novelshelf-frontend` を名前解決できているか（`edge` ネットワークのエイリアス設定、compose の `networks:` ブロックで `default` も明示しているか＝これを忘れると backend が postgres に繋がらない） |
| Cloudflare が "Error 1033 / tunnel not found" | cloudflared のログ確認（`docker compose -f /srv/edge/docker-compose.yml logs cloudflared`）。トークン誤り or Public Hostname 未設定 |
| 小さいページは開くが、大きいレスポンス/アップロードで固まる | 二重NAT＋IPoE(MAP-E) で経路MTUが下がっている可能性。親機ルーターのMTU/MSSクランプを確認（HGWは自分のIPoE分はクランプするが内側ルーターはしないことがある）。cloudflared を `--protocol http2` にすると改善することがある |
| ログインリンク等が `http://` / Mixed Content | Caddyfile の各 `reverse_proxy { }` に `header_up X-Forwarded-Proto https` が入っているか（手順書 8-3 の Caddyfile 参照）。加えて Cloudflare の "Always Use HTTPS" が ON か |
| リストア後、日本語のソート順が変 | 稀。VPSのDBと新規DBで `LC_COLLATE` が違う場合に索引照合が変わる。`SHOW LC_COLLATE;` を両方で比較。問題があれば物理コピー方式（下記代替案）に切替 |
| 全話一括DLがタイムアウト | Caddyfile の `@download` ブロックの `read_timeout` を延長。加えて Cloudflare 無料プランはプロキシ経由のレスポンスに 100秒制限（524エラー）がある点に注意。長時間かかるDLは Cloudflare 側の制限に当たる可能性があり、その場合は当該エンドポイントだけ設計変更（非同期化 / ポーリング）が必要 |

> **重要**: 最後の「Cloudflare 100秒制限」は方式変更に伴う新しい制約。現行の同期的な `POST /novels/{id}/download`（最大600秒想定）は Cloudflare Tunnel 経由だと 524 で切られる可能性がある。移設前に「一括DLが実際に何秒かかっているか」を確認し、100秒を超えるようなら移設と別途に非同期化を検討すること。
