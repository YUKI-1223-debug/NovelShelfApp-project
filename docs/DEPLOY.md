# デプロイ手順書 (DEPLOY)

ConoHa VPS（Ubuntu想定）へのデプロイ手順。**本番環境を変更するコマンドは必ずユーザー自身の手で実行すること**（Claude Codeが直接VPSを操作することはない）。ここに書かれたコマンドはすべてVPS上のSSHセッションで実行する想定。

## 0. 前提条件

- ConoHa VPSを契約済みで、IPアドレスが分かっている（`docs/USER_TODO.md`に記載）
- `novelshelf.jp`のDNS Aレコードを、そのIPアドレスに向けてある（反映まで数分〜数時間かかる場合がある）
- VPSへSSHでログインできる（ConoHaのコントロールパネルで初期パスワード or SSH鍵を設定済み）
- 推奨スペック: メモリ2GB以上（[会話ログ参照] JVMの起動時メモリ消費を考慮）

## 1. VPS初期設定

### 1-0. SSH鍵認証への切り替え（rootパスワードログインは初回のみ）

ConoHaコントロールパネルで設定した初期rootパスワードは、初回ログインの突破口としてのみ使う。ログイン後すぐにSSH鍵認証へ切り替え、パスワードログイン・root直接ログインを無効化する。

```bash
# 開発機（Windows/Git Bash）側で、まだ鍵がなければ生成
ssh-keygen -t ed25519 -C "novelshelf-vps"

# 公開鍵をVPSに登録（初回はrootパスワードでログインが必要）
ssh-copy-id root@<VPSのIP>
# ssh-copy-idが使えない場合は、公開鍵の中身をコピーして
# VPS側の ~/.ssh/authorized_keys に手動で追記する

# VPSにSSHログイン後、sudo権限を持つ一般ユーザーを作成
adduser user
usermod -aG sudo user
rsync --archive --chown=user:user ~/.ssh /home/user

# 一般ユーザーでログインし直せることを確認してから、以降はrootで作業しない
```

一般ユーザーでのログイン確認ができたら、`sudo vi /etc/ssh/sshd_config`で以下を設定してパスワード認証・root直接ログインを無効化する:

```
PasswordAuthentication no
PermitRootLogin no
```

```bash
sudo systemctl restart sshd
```

以降の手順はすべて`user@<VPSのIP>`（一般ユーザー、sudo経由）で実行する想定に読み替える。

### 1-1. パッケージ更新・ファイアウォール・Docker導入

```bash
# VPSにSSHログイン後
sudo apt update && sudo apt upgrade -y

# ファイアウォール（SSH/HTTP/HTTPSのみ許可）
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Docker本体 + Composeプラグインをインストール
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# 一度ログアウト・再ログインしてグループ変更を反映
```

再ログイン後、`docker compose version`が動くことを確認する。

### 1-2. スワップの追加（メモリ2GBプラン向けの安全策）

Spring Boot（JVM）+ Postgres + Next.js + Nginxを2GBメモリで同居させるため、念のためスワップを追加してOOM Killのリスクを下げる。

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 2. リポジトリの配置

GitHubリモートを未設定の場合、開発機からVPSへ直接転送する（`rsync`推奨、`.env`は転送しないこと）:

```bash
# 開発機（Windows/Git Bash）側で実行
rsync -avz --exclude='.env' --exclude='node_modules' --exclude='.next' \
  --exclude='build' --exclude='.gradle' --exclude='.git' \
  ./ user@<VPSのIP>:/home/user/NovelShelfApp-project/
```

GitHubリモートを設定済みなら、VPS上で`git clone`する方がその後の更新（`git pull`）が楽になる。

## 3. 環境変数の設定

```bash
# VPS上、プロジェクトルートで
cp .env.example .env
nano .env  # または vim
```

`.env`で必ず変更する項目:

| 変数 | 値 |
|---|---|
| `POSTGRES_PASSWORD` | 開発用の既定値から必ず変更 |
| `JWT_SECRET` | `openssl rand -base64 48` 等でランダムな32byte以上の値に変更 |
| `DOMAIN` | `novelshelf.jp`（コメントアウトを外す） |
| `ACME_EMAIL` | Let's Encryptからの通知を受け取るメールアドレス |
| `CORS_ALLOWED_ORIGINS` | `https://novelshelf.jp`（コメントアウトを外す） |
| `NEXT_PUBLIC_API_BASE_URL` | `https://novelshelf.jp/api/v1`（コメントアウトを外す） |
| `POSTGRES_PORT`/`BACKEND_PORT`/`FRONTEND_PORT` | 本番オーバーレイではNginx以外は外部公開しないため、既定値のままで問題ない |

## 4. TLS証明書の初回取得（ブートストラップ）

Nginxに証明書がまだ無い状態でいきなりHTTPS設定を使うと起動できないため、一時的にHTTP専用設定に切り替えてから証明書を取得する。

```bash
cd docker

# 1. 一時的にHTTP専用設定に切り替え
cp nginx/nginx.conf nginx/nginx.conf.bak
cp nginx/nginx-bootstrap.conf nginx/nginx.conf

# 2. backend/frontend/nginxを起動（この時点ではHTTPのみ）
docker compose --env-file ../.env -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 3. 起動確認（このタイミングで http://novelshelf.jp/ が開ければOK）
curl -I http://novelshelf.jp/nginx-health

# 4. 証明書を取得（<メールアドレス>は.envのACME_EMAILと同じものを指定）
docker compose --env-file ../.env -f docker-compose.yml -f docker-compose.prod.yml \
  --profile tools run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d novelshelf.jp \
  --email <メールアドレス> --agree-tos --no-eff-email

# 5. 本番用HTTPS設定に戻す
cp nginx/nginx.conf.bak nginx/nginx.conf

# 6. Nginxを再起動してHTTPSを有効化
docker compose --env-file ../.env -f docker-compose.yml -f docker-compose.prod.yml restart nginx
```

## 5. 起動確認

```bash
docker compose --env-file ../.env -f docker-compose.yml -f docker-compose.prod.yml ps
curl -I https://novelshelf.jp/
curl -I https://novelshelf.jp/api/v1/sites   # 401が返れば正常（要認証エンドポイントのため）
```

ブラウザで`https://novelshelf.jp`を開き、サインアップ〜読書までの一連の動作を確認する（`frontend/e2e/critical-journey.spec.ts`と同じ流れ）。

## 6. 証明書の自動更新

Let's Encryptの証明書は90日で失効する。VPSのcrontabに更新ジョブを登録する。

```bash
crontab -e
```

以下を追記（毎週月曜4:00に更新を試行。期限が近くなければcertbotは何もしない）:

```
0 4 * * 1 cd /home/user/NovelShelfApp-project/docker && docker compose --env-file ../.env -f docker-compose.yml -f docker-compose.prod.yml --profile tools run --rm certbot renew --webroot -w /var/www/certbot && docker compose --env-file ../.env -f docker-compose.yml -f docker-compose.prod.yml restart nginx
```

## 7. 再デプロイ（コード更新時）

```bash
cd /home/user/NovelShelfApp-project
git pull   # またはrsyncで再転送
cd docker
docker compose --env-file ../.env -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## トラブルシューティング

- ログ確認: `docker compose --env-file ../.env -f docker-compose.yml -f docker-compose.prod.yml logs <service>`
- Nginxが起動しない: `nginx/nginx.conf`の証明書パス（`/etc/letsencrypt/live/novelshelf.jp/`）が存在するか確認。手順4を最初からやり直す。
- 502/504エラー: `docker compose ps`でbackend/frontendがhealthyか確認。
- `POST /novels/{id}/download`がタイムアウトする: Nginxの`proxy_read_timeout`は600秒に設定済み（`docker/nginx/nginx.conf`）。それでも足りない場合は値を調整する。

## 検証済み事項（開発機で確認したこと）

- `docker-compose.yml` + `docker-compose.prod.yml`のマージ設定（`docker compose config`）で、frontend/backend/postgresのポート非公開・`NEXT_PUBLIC_API_BASE_URL`のビルド引数差し替え・`certbot`サービスの`tools`プロファイル隔離が正しく反映されることを確認済み。
- `nginx-bootstrap.conf`/`nginx.conf`は`nginx -t`で構文検証済み。`nginx.conf`は一時的な自己署名証明書を使い、実際にコンテナを起動してbackend/frontendへのプロキシ・HTTP→HTTPSリダイレクト・HSTSヘッダ・`/download`エンドポイントの長時間タイムアウトルートまで動作確認済み（本物のドメイン・証明書ではないため、実VPS上での最終確認は必要）。
