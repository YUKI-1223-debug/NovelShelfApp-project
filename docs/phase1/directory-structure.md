# NovelShelf ディレクトリ構成

モノレポ構成。`frontend` (Next.js) と `backend` (Spring Boot) を並列に配置し、`docker` でオーケストレーションする。

```
NovelShelfApp-project/
├── docs/                          # 設計・進捗ドキュメント（本ドキュメント群）
│   ├── PROGRESS.md
│   ├── NEXT_TASK.md
│   ├── USER_TODO.md
│   ├── DECISIONS.md
│   ├── KNOWN_ISSUES.md
│   └── phase1/
│       ├── requirements.md
│       ├── architecture.md
│       ├── directory-structure.md
│       ├── er-diagram.md
│       ├── api/openapi.yaml
│       └── ui-mockups.md
│
├── docker/
│   ├── docker-compose.yml         # 開発環境（frontend + backend + postgres）
│   ├── docker-compose.prod.yml    # 本番オーバーレイ（Nginx + TLS）
│   ├── frontend/Dockerfile
│   └── backend/Dockerfile
│
├── frontend/                      # Next.js (TypeScript, PWA)
│   ├── src/
│   │   ├── app/                   # App Router（ルーティング / ページ）
│   │   │   ├── (auth)/            # ログイン・サインアップ
│   │   │   ├── (shelf)/           # 本棚
│   │   │   ├── (reader)/          # 読書画面
│   │   │   ├── (bookmarks)/       # しおり
│   │   │   ├── (stats)/           # 統計・カレンダー
│   │   │   └── (settings)/        # 設定
│   │   ├── components/            # 汎用UIコンポーネント（Material Design 3ベース）
│   │   ├── features/              # 機能単位のドメインロジック + UI（shelf, reader, sync, offline...）
│   │   ├── hooks/                 # カスタムフック
│   │   ├── lib/
│   │   │   ├── api-client/        # OpenAPIから自動生成した型・クライアント
│   │   │   └── offline/           # IndexedDB + 暗号化キャッシュ制御
│   │   ├── service-worker/        # PWA Service Worker（キャッシュ戦略）
│   │   ├── styles/                # Tailwind設定・グローバルスタイル
│   │   └── types/
│   ├── public/
│   │   ├── manifest.json          # PWAマニフェスト
│   │   └── icons/
│   ├── tests/
│   │   ├── unit/
│   │   └── e2e/                   # Playwright等
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── backend/                       # Spring Boot (Java 21)
│   ├── src/main/java/com/novelshelf/
│   │   ├── presentation/          # REST Controller, DTO, ExceptionHandler
│   │   ├── application/           # UseCase / Service（ユースケース単位）
│   │   │   ├── auth/
│   │   │   ├── shelf/
│   │   │   ├── reading/           # 読書位置・履歴・統計
│   │   │   ├── bookmark/
│   │   │   ├── sync/              # 設定・読書位置の同期
│   │   │   └── ingest/            # サイトからの取り込み
│   │   ├── domain/                # Entity, ValueObject, Repositoryインターフェース
│   │   │   ├── user/
│   │   │   ├── novel/
│   │   │   ├── shelf/
│   │   │   ├── bookmark/
│   │   │   └── reading/
│   │   ├── infrastructure/
│   │   │   ├── persistence/       # Spring Data JPA実装
│   │   │   ├── adapter/           # SiteAdapter実装（narou, kakuyomu, hameln, pixiv, fallback）
│   │   │   └── security/          # 認証・JWT・パスワードハッシュ
│   │   └── config/                # Spring設定、OpenAPI設定、CORS等
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   ├── application-dev.yml
│   │   ├── application-prod.yml
│   │   └── db/migration/          # Flyway migration (V1__init.sql ...)
│   ├── src/test/java/com/novelshelf/
│   │   ├── unit/                  # JUnit
│   │   └── integration/
│   └── build.gradle.kts
│
├── .github/
│   └── workflows/                 # CI/CD（Phase6で具体化）
│
├── .env.example
└── README.md
```

## 設計方針

- **クリーンアーキテクチャ**: `backend` は `presentation → application → domain ← infrastructure` の依存方向を厳守。`domain` はフレームワーク非依存。
- **DBマイグレーション**: Flywayでスキーマをバージョン管理し、ER図（[er-diagram.md](er-diagram.md)）と対応させる。
- **型安全性**: バックエンドのOpenAPI仕様（[api/openapi.yaml](api/openapi.yaml)）からフロントエンドの型・APIクライアントを自動生成し、手書きの型ズレを防ぐ。
- **SiteAdapter**: `infrastructure/adapter/` にサイトごとの実装を分離し、規約調査が未完了のサイトは `FallbackLinkAdapter` にフォールバックする（詳細は[architecture.md](architecture.md)）。
- **オフラインキャッシュ**: `frontend/src/lib/offline/` と `service-worker/` に集約し、暗号化・容量管理・差分更新のロジックをUIから分離する。
