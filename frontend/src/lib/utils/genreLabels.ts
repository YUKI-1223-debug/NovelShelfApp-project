import type { SiteCode } from "@/lib/api";

// なろう: https://dev.syosetu.com/man/api/ のジャンルコード一覧より。
const NAROU_GENRES: Record<string, string> = {
  "101": "異世界〔恋愛〕",
  "102": "現実世界〔恋愛〕",
  "201": "ハイファンタジー〔ファンタジー〕",
  "202": "ローファンタジー〔ファンタジー〕",
  "301": "純文学〔文芸〕",
  "302": "ヒューマンドラマ〔文芸〕",
  "303": "歴史〔文芸〕",
  "304": "推理〔文芸〕",
  "305": "ホラー〔文芸〕",
  "306": "アクション〔文芸〕",
  "307": "コメディー〔文芸〕",
  "401": "VRゲーム〔SF〕",
  "402": "宇宙〔SF〕",
  "403": "空想科学〔SF〕",
  "404": "パニック〔SF〕",
  "9801": "ノンジャンル",
  "9901": "童話",
  "9902": "詩",
  "9903": "エッセイ",
  "9904": "リプレイ",
  "9999": "その他",
};

// R18(ノクターン/ムーンライト/ミッドナイト)のnocgenre。NarouAdapterがこの値をgenreとして保存する。
const NAROU_R18_GENRES: Record<string, string> = {
  "1": "ノクターン(男性向け)",
  "2": "ムーンライト(女性向け)",
  "3": "ムーンライト(BL)",
  "4": "ミッドナイト",
};

// カクヨム: 実際の作品ページで確認できたジャンルのみ。未確認のジャンルはコードのまま表示する。
const KAKUYOMU_GENRES: Record<string, string> = {
  FANTASY: "異世界ファンタジー",
  ACTION: "現代ファンタジー",
  SF: "SF",
  MYSTERY: "ミステリー",
  HORROR: "ホラー",
  DRAMA: "現代ドラマ",
  LOVE_STORY: "恋愛",
  ROMANCE: "ラブコメ",
};

/**
 * サイトごとに体系の異なるジャンルコードを日本語ラベルに変換する。
 * なろうのR18作品はnocgenre(1〜4)を同じgenreフィールドに使っているため、
 * 通常のなろうジャンルコードと衝突しない範囲(1桁)だけR18ラベルを先に試す。
 */
export function genreLabel(site: SiteCode | null | undefined, code: string | null | undefined): string {
  if (!code) return "";
  if (site === "NAROU") {
    if (code.length === 1 && NAROU_R18_GENRES[code]) return NAROU_R18_GENRES[code];
    return NAROU_GENRES[code] ?? code;
  }
  if (site === "KAKUYOMU") {
    return KAKUYOMU_GENRES[code] ?? code;
  }
  return code;
}

/** /search画面のジャンル選択肢。サイトを1つ選んだときだけ意味のある一覧を返す。 */
export function genreOptionsForSite(site: SiteCode | null | undefined): { code: string; label: string }[] {
  if (site === "NAROU") {
    return Object.entries(NAROU_GENRES).map(([code, label]) => ({ code, label }));
  }
  if (site === "KAKUYOMU") {
    return Object.entries(KAKUYOMU_GENRES).map(([code, label]) => ({ code, label }));
  }
  return [];
}
