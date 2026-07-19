# NovelShelf システム構成

## 1. 全体構成図

```mermaid
flowchart TB
    subgraph Client["クライアント (PWA)"]
        Browser["Next.js App\n(Android / iPhone / iPad / PC Browser)"]
        SW["Service Worker\n(オフラインキャッシュ・暗号化ストレージ)"]
        Browser <--> SW
    end

    subgraph Server["アプリケーションサーバー (Spring Boot)"]
        API["REST API\n(クリーンアーキテクチャ)"]
        Auth["認証モジュール\n(Email/Password, 将来: OAuth)"]
        Sync["同期モジュール\n(読書位置/設定/しおり)"]
        Ingest["SiteAdapter\n(サイト別データ取得)"]
        API --> Auth
        API --> Sync
        API --> Ingest
    end

    subgraph External["外部小説サイト"]
        Narou["小説家になろう\n(公式API)"]
        Kakuyomu["カクヨム\n(要個別調査)"]
        Hameln["ハーメルン\n(要個別調査)"]
        Pixiv["pixiv小説\n(要個別調査)"]
    end

    DB[(PostgreSQL)]

    Browser -- HTTPS / JSON --> API
    Ingest -- 許可された方法のみ --> Narou
    Ingest -. 調査後に接続 .-> Kakuyomu
    Ingest -. 調査後に接続 .-> Hameln
    Ingest -. 調査後に接続 .-> Pixiv
    API --> DB
```

## 2. SiteAdapter パターン（データ取得の抽象化）

サイトごとに取得可否・取得方式が異なるため、共通インターフェースの背後にサイト固有の実装を隠蔽する。

```mermaid
classDiagram
    class NovelSiteAdapter {
        <<interface>>
        +fetchNovelMetadata(url) NovelMetadata
        +fetchChapterList(novelId) List~Chapter~
        +fetchChapterContent(chapterId) ChapterContent
        +isSupported() boolean
    }
    class NarouAdapter {
        +公式APIを利用
    }
    class KakuyomuAdapter {
        +調査結果に応じて実装
        +未対応時はUnsupportedOperation
    }
    class HamelnAdapter {
        +調査結果に応じて実装
    }
    class PixivNovelAdapter {
        +調査結果に応じて実装
    }
    class FallbackLinkAdapter {
        +外部リンク登録のみ
        +本文取得は行わない
    }
    NovelSiteAdapter <|.. NarouAdapter
    NovelSiteAdapter <|.. KakuyomuAdapter
    NovelSiteAdapter <|.. HamelnAdapter
    NovelSiteAdapter <|.. PixivNovelAdapter
    NovelSiteAdapter <|.. FallbackLinkAdapter
```

`isSupported()` が false を返すサイトは `FallbackLinkAdapter` に切り替わり、本棚には作品を登録できるが本文取得・オフラインキャッシュは行わず、閲覧はブラウザの別タブに委譲する。

## 3. オフラインキャッシュのデータフロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant SW as Service Worker
    participant IDB as 暗号化ローカルDB (IndexedDB)
    participant API as Spring Boot API

    U->>SW: 話を開く
    SW->>IDB: キャッシュ有無を確認
    alt キャッシュあり
        IDB-->>SW: 暗号化データを復号して返却
    else キャッシュなし
        SW->>API: 話本文を取得
        API-->>SW: 本文データ
        SW->>IDB: 暗号化して保存（自動キャッシュ）
    end
    SW-->>U: 表示

    U->>SW: 読書位置/しおり更新（オフライン中）
    SW->>IDB: ローカルに保存（未同期フラグ）
    Note over SW,API: オンライン復帰
    SW->>API: 未同期データを送信
    API-->>SW: 同期完了
    SW->>IDB: 未同期フラグ解除
```

## 4. レイヤー構成（バックエンド: クリーンアーキテクチャ）

```mermaid
flowchart LR
    subgraph Presentation
        Controller[REST Controller]
    end
    subgraph Application
        UseCase[UseCase / Service]
    end
    subgraph Domain
        Entity[Entity / Domain Model]
        Repo["Repository (interface)"]
    end
    subgraph Infrastructure
        RepoImpl["Repository実装 (JPA)"]
        AdapterImpl["SiteAdapter実装"]
    end

    Controller --> UseCase
    UseCase --> Entity
    UseCase --> Repo
    Repo <|.. RepoImpl
    UseCase --> AdapterImpl
    RepoImpl --> DB[(PostgreSQL)]
```

依存の向きは常に外側（Infrastructure）から内側（Domain）。Domain層は外部フレームワークに依存しない。

## 5. デプロイ構成（開発環境 → 将来の本番）

```mermaid
flowchart TB
    subgraph Dev["開発環境 (docker-compose.yml)"]
        FE_dev[frontend container]
        BE_dev[backend container]
        DB_dev[(postgres container)]
    end

    subgraph Prod["将来: ConoHa VPS (docker-compose.prod.yml)"]
        Nginx[Nginx / Reverse Proxy + TLS]
        FE_prod[frontend container]
        BE_prod[backend container]
        DB_prod[(postgres container + volume)]
        Nginx --> FE_prod
        Nginx --> BE_prod
        BE_prod --> DB_prod
    end

    Dev -. 同一Compose定義をそのまま流用 .-> Prod
```

開発・本番で同じ Dockerfile / docker-compose 構成を使い、環境差分は `.env` と `docker-compose.prod.yml` の追加オーバーレイ（Nginx・TLS終端）のみで吸収する。VPSの詳細スペック・ドメイン取得はPhase6で確定（[USER_TODO.md](../USER_TODO.md)参照）。

## 6. 認証方式の拡張性

```mermaid
flowchart LR
    User[User Entity] --> AuthMethod["AuthCredential\n(provider: EMAIL / GOOGLE, ...)"]
    AuthMethod -->|provider=EMAIL| PasswordAuth[Email+Password]
    AuthMethod -.->|provider=GOOGLE 将来| OAuthAuth[Google OAuth]
```

`User` と認証方式を1:Nで分離し、将来のGoogleログイン追加時にUserテーブルを変更せずに済む設計とする。
