export type SiteCode = "NAROU" | "KAKUYOMU" | "HAMELN" | "PIXIV";
export type NovelStatus = "ONGOING" | "COMPLETED";
export type ShelfStatus = "READING" | "COMPLETED" | "READ_LATER";
export type WritingMode = "VERTICAL" | "HORIZONTAL";
export type FontFamily = "MINCHO" | "GOTHIC";
export type PageMode = "PAGINATION" | "SCROLL";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface Site {
  id: string;
  code: SiteCode;
  name: string;
  isSupported: boolean;
}

export interface Novel {
  id: string;
  title: string;
  author: string;
  site: SiteCode | null;
  siteSupported: boolean;
  genre: string | null;
  coverUrl: string | null;
  sourceUrl: string;
  status: NovelStatus;
  latestKnownChapterNo: number;
  hasUpdate: boolean;
  seriesId: string | null;
}

export interface NovelDetail extends Novel {
  synopsis: string | null;
  totalChapters: number;
}

export interface Chapter {
  id: string;
  novelId: string;
  chapterNo: number;
  title: string;
  publishedAt: string | null;
}

export interface ChapterContent {
  chapterId: string;
  title: string;
  bodyHtml: string;
  sourceUrl: string;
}

export interface ChapterWithContent {
  chapterId: string;
  chapterNo: number;
  title: string;
  bodyHtml: string;
  sourceUrl: string;
}

export interface Tag {
  id: string;
  name: string;
}

export interface BookshelfEntry {
  id: string;
  novel: Novel;
  status: ShelfStatus;
  isFavorite: boolean;
  tags: Tag[];
  addedAt: string;
  lastReadAt: string | null;
}

export interface ReadingPosition {
  novelId: string;
  chapterId: string;
  scrollPosition: number;
  lastReadAt: string;
}

export interface ReadingHistoryItem {
  novelId: string;
  chapterId: string;
  title: string;
  readAt: string;
  durationSeconds: number;
}

export interface Bookmark {
  id: string;
  chapterId: string;
  novelId: string | null;
  chapterNo: number;
  chapterTitle: string;
  name: string;
  memo: string | null;
  scrollPosition: number;
  tags: Tag[];
  createdAt: string;
}

export interface UserSettings {
  darkMode: boolean;
  writingMode: WritingMode;
  fontFamily: FontFamily;
  fontSize: number;
  lineHeight: number;
  marginSize: string;
  backgroundColor: string;
  theme: string;
  pageMode: PageMode;
  shelfSortOrder: string;
}

export interface StatsSummary {
  totalCompletedNovels: number;
  totalReadChapters: number;
  totalReadingSeconds: number;
}

export interface BreakdownItem {
  label: string;
  readingSeconds: number;
}

export interface CalendarDay {
  date: string;
  readingSeconds: number;
}

export interface OfflineSavePreference {
  chapterId: string;
  autoCached: boolean;
  requestedAt: string;
}

export interface ApiErrorBody {
  message: string;
}
