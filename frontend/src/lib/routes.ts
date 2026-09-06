// アプリ内画面遷移のパス生成。
// Capacitor 用の静的エクスポート（output: "export"）では動的セグメント（/novels/[id] 等）に
// ビルド時の generateStaticParams が必須になり、実行時に決まる ID を扱えない。そのため
// 作品・読書・作者の各画面はクエリパラメータ方式（/novel?id=... 等）に統一している。
// 遷移先は必ずこのヘルパー経由で組み立てること。

export const routes = {
  /** 作品詳細（話一覧・本棚操作） */
  novel: (novelId: string) => `/novel?id=${encodeURIComponent(novelId)}`,
  /** 読書画面（イマーシブ表示、シェル外） */
  reader: (novelId: string, chapterId: string) =>
    `/reader?novel=${encodeURIComponent(novelId)}&chapter=${encodeURIComponent(chapterId)}`,
  /** 作者ページ */
  author: (authorName: string) => `/author?name=${encodeURIComponent(authorName)}`,
} as const;
