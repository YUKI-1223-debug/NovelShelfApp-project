import { apiFetch } from "./client";
import type {
  AuthTokens,
  Bookmark,
  BookshelfEntry,
  BreakdownItem,
  CalendarDay,
  Chapter,
  ChapterContent,
  ChapterWithContent,
  Novel,
  NovelDetail,
  OfflineSavePreference,
  ReadingHistoryItem,
  ReadingPosition,
  ShelfStatus,
  Site,
  SiteCode,
  StatsSummary,
  Tag,
  UserSettings,
} from "./types";

export const authApi = {
  signup: (email: string, password: string, displayName?: string) =>
    apiFetch<AuthTokens>("/auth/signup", { method: "POST", auth: false, body: { email, password, displayName } }),
  login: (email: string, password: string) =>
    apiFetch<AuthTokens>("/auth/login", { method: "POST", auth: false, body: { email, password } }),
  logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),
  requestPasswordReset: (email: string) =>
    apiFetch<void>("/auth/password-reset/request", { method: "POST", auth: false, body: { email } }),
  confirmPasswordReset: (token: string, newPassword: string) =>
    apiFetch<void>("/auth/password-reset/confirm", { method: "POST", auth: false, body: { token, newPassword } }),
};

export const sitesApi = {
  list: () => apiFetch<Site[]>("/sites"),
};

export const novelsApi = {
  resolve: (url: string) => apiFetch<NovelDetail>("/novels/resolve", { method: "POST", body: { url } }),
  detail: (novelId: string) => apiFetch<NovelDetail>(`/novels/${novelId}`),
  updateTitle: (novelId: string, title: string) =>
    apiFetch<NovelDetail>(`/novels/${novelId}`, { method: "PATCH", body: { title } }),
  chapters: (novelId: string) => apiFetch<Chapter[]>(`/novels/${novelId}/chapters`),
  content: (chapterId: string) => apiFetch<ChapterContent>(`/chapters/${chapterId}/content`),
  downloadAll: (novelId: string) => apiFetch<ChapterWithContent[]>(`/novels/${novelId}/download`, { method: "POST" }),
  search: (params: { q?: string; site?: SiteCode; genre?: string; tag?: string }) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.site) qs.set("site", params.site);
    if (params.genre) qs.set("genre", params.genre);
    if (params.tag) qs.set("tag", params.tag);
    return apiFetch<Novel[]>(`/novels/search?${qs.toString()}`);
  },
};

export const shelfApi = {
  list: (params?: { status?: ShelfStatus; favorite?: boolean; groupBy?: string; sort?: "recent" }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.favorite !== undefined) qs.set("favorite", String(params.favorite));
    if (params?.groupBy) qs.set("groupBy", params.groupBy);
    if (params?.sort) qs.set("sort", params.sort);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<BookshelfEntry[]>(`/shelf${suffix}`);
  },
  add: (novelId: string, status?: ShelfStatus) =>
    apiFetch<BookshelfEntry>("/shelf", { method: "POST", body: { novelId, status } }),
  update: (entryId: string, patch: { status?: ShelfStatus; isFavorite?: boolean; tagIds?: string[] }) =>
    apiFetch<BookshelfEntry>(`/shelf/${entryId}`, { method: "PATCH", body: patch }),
  remove: (entryId: string) => apiFetch<void>(`/shelf/${entryId}`, { method: "DELETE" }),
};

export const tagsApi = {
  list: () => apiFetch<Tag[]>("/tags"),
  create: (name: string) => apiFetch<Tag>("/tags", { method: "POST", body: { name } }),
};

export const readingApi = {
  getPosition: (novelId: string) => apiFetch<ReadingPosition>(`/reading/positions/${novelId}`),
  putPosition: (novelId: string, chapterId: string, scrollPosition: number) =>
    apiFetch<ReadingPosition>(`/reading/positions/${novelId}`, {
      method: "PUT",
      body: { chapterId, scrollPosition },
    }),
  recordHistory: (chapterId: string, readAt: string, durationSeconds: number) =>
    apiFetch<void>("/reading/history", { method: "POST", body: { chapterId, readAt, durationSeconds } }),
  history: (limit = 20) => apiFetch<ReadingHistoryItem[]>(`/reading/history?limit=${limit}`),
};

export const bookmarksApi = {
  list: (params?: { novelId?: string; tag?: string }) => {
    const qs = new URLSearchParams();
    if (params?.novelId) qs.set("novelId", params.novelId);
    if (params?.tag) qs.set("tag", params.tag);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<Bookmark[]>(`/bookmarks${suffix}`);
  },
  create: (input: { chapterId: string; name: string; memo?: string; scrollPosition?: number; tagIds?: string[] }) =>
    apiFetch<Bookmark>("/bookmarks", { method: "POST", body: input }),
  update: (
    bookmarkId: string,
    input: { chapterId: string; name: string; memo?: string; scrollPosition?: number; tagIds?: string[] }
  ) => apiFetch<Bookmark>(`/bookmarks/${bookmarkId}`, { method: "PATCH", body: input }),
  remove: (bookmarkId: string) => apiFetch<void>(`/bookmarks/${bookmarkId}`, { method: "DELETE" }),
};

export const settingsApi = {
  get: () => apiFetch<UserSettings>("/settings"),
  update: (settings: UserSettings) => apiFetch<UserSettings>("/settings", { method: "PUT", body: settings }),
};

export const statsApi = {
  summary: () => apiFetch<StatsSummary>("/stats/summary"),
  breakdown: (by: "month" | "site" | "author", range?: "today" | "week" | "month" | "year" | "all") =>
    apiFetch<BreakdownItem[]>(`/stats/breakdown?by=${by}${range ? `&range=${range}` : ""}`),
  calendar: (yearMonth: string) => apiFetch<CalendarDay[]>(`/stats/calendar?yearMonth=${yearMonth}`),
};

export const updatesApi = {
  list: () => apiFetch<Novel[]>("/updates"),
  check: () => apiFetch<void>("/updates/check", { method: "POST" }),
};

export const offlineApi = {
  list: () => apiFetch<OfflineSavePreference[]>("/offline/preferences"),
  add: (chapterId: string) => apiFetch<OfflineSavePreference>("/offline/preferences", { method: "POST", body: { chapterId } }),
  remove: (chapterId: string) => apiFetch<void>(`/offline/preferences/${chapterId}`, { method: "DELETE" }),
};
