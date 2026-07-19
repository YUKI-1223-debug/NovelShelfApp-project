package com.novelshelf.infrastructure.adapter;

import com.novelshelf.domain.novel.SiteCode;
import java.util.List;

/**
 * サイトごとのデータ取得を抽象化するインターフェース。
 * 実装はサイトの利用規約・提供APIの範囲内でのみ本文取得を行う（docs/DECISIONS.md参照）。
 */
public interface NovelSiteAdapter {

    SiteCode siteCode();

    boolean isSupported();

    ExternalNovelMetadata resolveNovel(String url);

    List<ExternalChapter> fetchChapterList(String externalNovelId);

    ExternalChapterContent fetchChapterContent(String externalNovelId, String externalChapterId);
}
