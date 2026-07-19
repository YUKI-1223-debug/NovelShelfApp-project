import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NovelShelf",
    short_name: "NovelShelf",
    description: "広告なしのWeb小説リーダー",
    start_url: "/",
    display: "standalone",
    background_color: "#f0ece2",
    theme_color: "#2b3a55",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Android/Windows版Chrome・Edgeでインストール後、OS標準の共有シートにNovelShelfが出るようにする。
    // なろう/カクヨム/ハーメルンの検索ページ等で目的の作品を開いた状態で共有すると、
    // そのページのURLを受け取って本棚に追加する（/share参照）。iOS Safariは2026-07時点で
    // share_targetに非対応のため効果がない（docs/DECISIONS.md参照、ショートカットアプリでの代替手順あり）。
    share_target: {
      action: "/share",
      method: "GET",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
  };
}
