# NovelShelf ER図

## 設計上の補足

- 「お気に入り」は本棚ステータスと独立した真偽値 `is_favorite` として `bookshelf_entries` に持たせる（読書中のままお気に入り登録できるようにするため。要件の「読書中/お気に入り/読了/あとで読む」を単純な排他ステータスにすると `お気に入りかつ読書中` を表現できないための調整。詳細は[DECISIONS.md](../DECISIONS.md)）。
- 「更新あり」はユーザーが手動設定するステータスではなく、`novels.latest_known_chapter_no` と `reading_positions.last_read_chapter_no` の差分から導出する計算値（`has_update`）として扱う。
- タグは「本棚エントリ（作品の本棚登録）」と「しおり」それぞれに付与できるユーザー定義の自由タグ。ユーザーごとに独立する。
- オフラインキャッシュの実データ（本文）はサーバーに保持せず端末内に暗号化保存する。サーバー側は「どの話をオフライン保存したいか」という意図（`offline_save_preferences`）のみをクロスデバイス同期用に保持する。

## ER図

```mermaid
erDiagram
    USERS ||--o{ AUTH_CREDENTIALS : has
    USERS ||--|| USER_SETTINGS : has
    USERS ||--o{ BOOKSHELF_ENTRIES : owns
    USERS ||--o{ READING_POSITIONS : tracks
    USERS ||--o{ READING_HISTORY : logs
    USERS ||--o{ BOOKMARKS : creates
    USERS ||--o{ TAGS : defines
    USERS ||--o{ OFFLINE_SAVE_PREFERENCES : requests

    SITES ||--o{ AUTHORS : lists
    SITES ||--o{ NOVELS : hosts

    AUTHORS ||--o{ NOVELS : writes
    SERIES ||--o{ NOVELS : groups

    NOVELS ||--o{ CHAPTERS : contains
    NOVELS ||--o{ BOOKSHELF_ENTRIES : "registered as"
    NOVELS ||--o{ READING_POSITIONS : "position for"

    BOOKSHELF_ENTRIES ||--o{ BOOKSHELF_ENTRY_TAGS : tagged_with
    TAGS ||--o{ BOOKSHELF_ENTRY_TAGS : used_in
    TAGS ||--o{ BOOKMARK_TAGS : used_in

    CHAPTERS ||--o{ READING_HISTORY : "read in"
    CHAPTERS ||--o{ BOOKMARKS : "bookmarked in"
    CHAPTERS ||--o{ OFFLINE_SAVE_PREFERENCES : "requested for"

    BOOKMARKS ||--o{ BOOKMARK_TAGS : tagged_with

    USERS {
        uuid id PK
        string email UK
        string display_name
        timestamp created_at
        timestamp updated_at
    }

    AUTH_CREDENTIALS {
        uuid id PK
        uuid user_id FK
        string provider "EMAIL / GOOGLE(将来)"
        string password_hash "provider=EMAILのみ"
        string provider_uid "provider=GOOGLE等"
        timestamp created_at
    }

    USER_SETTINGS {
        uuid id PK
        uuid user_id FK
        boolean dark_mode
        string writing_mode "VERTICAL / HORIZONTAL"
        string font_family "MINCHO / GOTHIC"
        int font_size
        float line_height
        string margin_size
        string background_color
        string theme
        string page_mode "PAGINATION / SCROLL"
        string shelf_sort_order
        timestamp updated_at
    }

    SITES {
        uuid id PK
        string code UK "NAROU / KAKUYOMU / HAMELN / PIXIV"
        string name
        string base_url
        boolean is_supported "取得方式が確立済みか"
    }

    AUTHORS {
        uuid id PK
        uuid site_id FK
        string external_author_id
        string name
        string profile_url
    }

    SERIES {
        uuid id PK
        string title
        string description
    }

    NOVELS {
        uuid id PK
        uuid site_id FK
        uuid author_id FK
        uuid series_id FK "nullable"
        string external_novel_id
        string title
        string synopsis
        string genre
        string cover_url
        string source_url
        string status "ONGOING / COMPLETED"
        int latest_known_chapter_no
        timestamp created_at
        timestamp updated_at
    }

    CHAPTERS {
        uuid id PK
        uuid novel_id FK
        string external_chapter_id
        string title
        int chapter_no
        string source_url
        timestamp published_at
        timestamp updated_at
    }

    BOOKSHELF_ENTRIES {
        uuid id PK
        uuid user_id FK
        uuid novel_id FK
        string status "READING / COMPLETED / READ_LATER"
        boolean is_favorite
        timestamp added_at
        timestamp updated_at
    }

    TAGS {
        uuid id PK
        uuid user_id FK
        string name
        timestamp created_at
    }

    BOOKSHELF_ENTRY_TAGS {
        uuid bookshelf_entry_id FK
        uuid tag_id FK
    }

    READING_POSITIONS {
        uuid id PK
        uuid user_id FK
        uuid novel_id FK
        uuid chapter_id FK
        int last_read_chapter_no
        float scroll_position
        timestamp last_read_at
    }

    READING_HISTORY {
        uuid id PK
        uuid user_id FK
        uuid chapter_id FK
        timestamp read_at
        int duration_seconds
    }

    BOOKMARKS {
        uuid id PK
        uuid user_id FK
        uuid chapter_id FK
        string name
        string memo
        float scroll_position
        timestamp created_at
    }

    BOOKMARK_TAGS {
        uuid bookmark_id FK
        uuid tag_id FK
    }

    OFFLINE_SAVE_PREFERENCES {
        uuid id PK
        uuid user_id FK
        uuid chapter_id FK
        boolean auto_cached "自動キャッシュか明示保存か"
        timestamp requested_at
    }
```

## 補足: 統計・カレンダーの算出方法

`読書統計` `読書カレンダー` は専用テーブルを持たず、`READING_HISTORY` を集計して算出する（読了作品数は `BOOKSHELF_ENTRIES.status = COMPLETED` の件数、読書時間は `READING_HISTORY.duration_seconds` の合計）。将来的に集計コストが問題になった場合はマテリアライズドビュー化を検討する（[KNOWN_ISSUES.md](../KNOWN_ISSUES.md)に記載）。
