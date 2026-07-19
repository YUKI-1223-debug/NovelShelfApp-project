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
  };
}
