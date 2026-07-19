CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) NOT NULL UNIQUE,
    display_name  VARCHAR(100) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE auth_credentials (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider       VARCHAR(20) NOT NULL,
    password_hash  VARCHAR(255),
    provider_uid   VARCHAR(255),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_auth_credentials_user_provider UNIQUE (user_id, provider)
);

CREATE TABLE user_settings (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    dark_mode         BOOLEAN NOT NULL DEFAULT false,
    writing_mode      VARCHAR(20) NOT NULL DEFAULT 'VERTICAL',
    font_family       VARCHAR(20) NOT NULL DEFAULT 'MINCHO',
    font_size         INTEGER NOT NULL DEFAULT 16,
    line_height       REAL NOT NULL DEFAULT 1.8,
    margin_size       VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    background_color  VARCHAR(20) NOT NULL DEFAULT 'DEFAULT',
    theme             VARCHAR(20) NOT NULL DEFAULT 'DEFAULT',
    page_mode         VARCHAR(20) NOT NULL DEFAULT 'SCROLL',
    shelf_sort_order  VARCHAR(20) NOT NULL DEFAULT 'UPDATED_DESC',
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sites (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code          VARCHAR(20) NOT NULL UNIQUE,
    name          VARCHAR(50) NOT NULL,
    base_url      VARCHAR(255) NOT NULL,
    is_supported  BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE authors (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id              UUID NOT NULL REFERENCES sites(id),
    external_author_id   VARCHAR(100) NOT NULL,
    name                 VARCHAR(255) NOT NULL,
    profile_url          VARCHAR(500),
    CONSTRAINT uq_authors_site_external UNIQUE (site_id, external_author_id)
);

CREATE TABLE series (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        VARCHAR(255) NOT NULL,
    description  TEXT
);

CREATE TABLE novels (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id                  UUID NOT NULL REFERENCES sites(id),
    author_id                UUID NOT NULL REFERENCES authors(id),
    series_id                UUID REFERENCES series(id),
    external_novel_id        VARCHAR(100) NOT NULL,
    title                    VARCHAR(500) NOT NULL,
    synopsis                 TEXT,
    genre                    VARCHAR(50),
    cover_url                VARCHAR(500),
    source_url               VARCHAR(500) NOT NULL,
    status                   VARCHAR(20) NOT NULL DEFAULT 'ONGOING',
    latest_known_chapter_no  INTEGER NOT NULL DEFAULT 0,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_novels_site_external UNIQUE (site_id, external_novel_id)
);

CREATE TABLE chapters (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    novel_id             UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    external_chapter_id  VARCHAR(100) NOT NULL,
    title                VARCHAR(500) NOT NULL,
    chapter_no           INTEGER NOT NULL,
    source_url           VARCHAR(500) NOT NULL,
    published_at         TIMESTAMPTZ,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_chapters_novel_external UNIQUE (novel_id, external_chapter_id)
);
CREATE INDEX idx_chapters_novel_id ON chapters(novel_id);

CREATE TABLE bookshelf_entries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    novel_id    UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    status      VARCHAR(20) NOT NULL DEFAULT 'READING',
    is_favorite BOOLEAN NOT NULL DEFAULT false,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_bookshelf_entries_user_novel UNIQUE (user_id, novel_id)
);
CREATE INDEX idx_bookshelf_entries_user_id ON bookshelf_entries(user_id);

CREATE TABLE tags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(50) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tags_user_name UNIQUE (user_id, name)
);

CREATE TABLE bookshelf_entry_tags (
    bookshelf_entry_id  UUID NOT NULL REFERENCES bookshelf_entries(id) ON DELETE CASCADE,
    tag_id              UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (bookshelf_entry_id, tag_id)
);

CREATE TABLE reading_positions (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    novel_id               UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    chapter_id             UUID NOT NULL REFERENCES chapters(id),
    last_read_chapter_no   INTEGER NOT NULL,
    scroll_position        REAL NOT NULL DEFAULT 0,
    last_read_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_reading_positions_user_novel UNIQUE (user_id, novel_id)
);

CREATE TABLE reading_history (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chapter_id        UUID NOT NULL REFERENCES chapters(id),
    read_at           TIMESTAMPTZ NOT NULL,
    duration_seconds  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_reading_history_user_id_read_at ON reading_history(user_id, read_at);

CREATE TABLE bookmarks (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chapter_id       UUID NOT NULL REFERENCES chapters(id),
    name             VARCHAR(100) NOT NULL,
    memo             TEXT,
    scroll_position  REAL NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);

CREATE TABLE bookmark_tags (
    bookmark_id  UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
    tag_id       UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (bookmark_id, tag_id)
);

CREATE TABLE offline_save_preferences (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chapter_id    UUID NOT NULL REFERENCES chapters(id),
    auto_cached   BOOLEAN NOT NULL DEFAULT false,
    requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_offline_save_preferences_user_chapter UNIQUE (user_id, chapter_id)
);
