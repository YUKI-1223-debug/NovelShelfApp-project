package com.novelshelf.application.novel;

import com.novelshelf.domain.common.NotFoundException;
import com.novelshelf.domain.novel.*;
import com.novelshelf.domain.shelf.BookshelfEntryRepository;
import com.novelshelf.infrastructure.adapter.ExternalChapter;
import com.novelshelf.infrastructure.adapter.ExternalChapterContent;
import com.novelshelf.infrastructure.adapter.NovelSiteAdapter;
import com.novelshelf.infrastructure.adapter.SiteAdapterRegistry;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NovelQueryService {

    private final NovelRepository novelRepository;
    private final AuthorRepository authorRepository;
    private final SiteRepository siteRepository;
    private final ChapterRepository chapterRepository;
    private final BookshelfEntryRepository bookshelfEntryRepository;
    private final SiteAdapterRegistry adapterRegistry;

    public NovelQueryService(
            NovelRepository novelRepository,
            AuthorRepository authorRepository,
            SiteRepository siteRepository,
            ChapterRepository chapterRepository,
            BookshelfEntryRepository bookshelfEntryRepository,
            SiteAdapterRegistry adapterRegistry) {
        this.novelRepository = novelRepository;
        this.authorRepository = authorRepository;
        this.siteRepository = siteRepository;
        this.chapterRepository = chapterRepository;
        this.bookshelfEntryRepository = bookshelfEntryRepository;
        this.adapterRegistry = adapterRegistry;
    }

    public Novel getById(UUID novelId) {
        return novelRepository.findById(novelId).orElseThrow(() -> new NotFoundException("作品が見つかりません: " + novelId));
    }

    public List<Novel> search(String q, SiteCode siteCode, String genre, String tagName, UUID userId) {
        UUID siteId = siteCode != null
                ? siteRepository.findByCode(siteCode).map(Site::getId).orElse(null)
                : null;
        List<Novel> candidates = novelRepository.findBySiteIdAndGenre(siteId, genre);

        if (tagName != null && !tagName.isBlank()) {
            Set<UUID> allowedNovelIds =
                    Set.copyOf(bookshelfEntryRepository.findNovelIdsByUserIdAndTagName(userId, tagName));
            candidates = candidates.stream().filter(n -> allowedNovelIds.contains(n.getId())).toList();
        }

        if (q != null && !q.isBlank()) {
            String needle = q.toLowerCase();
            Map<UUID, Author> authorsById = new HashMap<>();
            authorRepository
                    .findAllById(candidates.stream().map(Novel::getAuthorId).distinct().toList())
                    .forEach(a -> authorsById.put(a.getId(), a));

            candidates = candidates.stream()
                    .filter(n -> n.getTitle().toLowerCase().contains(needle)
                            || authorsById.containsKey(n.getAuthorId())
                                    && authorsById
                                            .get(n.getAuthorId())
                                            .getName()
                                            .toLowerCase()
                                            .contains(needle))
                    .toList();
        }

        return candidates;
    }

    @Transactional
    public List<Chapter> getChapters(UUID novelId) {
        Novel novel = getById(novelId);
        Site site = siteRepository
                .findById(novel.getSiteId())
                .orElseThrow(() -> new NotFoundException("サイトが見つかりません: " + novel.getSiteId()));

        if (!site.isSupported()) {
            return chapterRepository.findByNovelIdOrderByChapterNoAsc(novelId);
        }

        NovelSiteAdapter adapter = adapterRegistry.resolve(site.getCode());
        List<ExternalChapter> externalChapters = adapter.fetchChapterList(novel.getExternalNovelId());

        for (ExternalChapter ec : externalChapters) {
            Chapter chapter = chapterRepository
                    .findByNovelIdAndExternalChapterId(novelId, ec.externalChapterId())
                    .map(existing -> {
                        existing.setTitle(ec.title());
                        existing.setPublishedAt(ec.publishedAt());
                        existing.setSourceUrl(ec.sourceUrl());
                        return existing;
                    })
                    .orElseGet(() -> Chapter.builder()
                            .novelId(novelId)
                            .externalChapterId(ec.externalChapterId())
                            .chapterNo(ec.chapterNo())
                            .title(ec.title())
                            .sourceUrl(ec.sourceUrl())
                            .publishedAt(ec.publishedAt())
                            .build());
            chapterRepository.save(chapter);
        }

        return chapterRepository.findByNovelIdOrderByChapterNoAsc(novelId);
    }

    public ExternalChapterContent getChapterContent(UUID chapterId) {
        Chapter chapter = chapterRepository
                .findById(chapterId)
                .orElseThrow(() -> new NotFoundException("話が見つかりません: " + chapterId));
        Novel novel = getById(chapter.getNovelId());
        Site site = siteRepository
                .findById(novel.getSiteId())
                .orElseThrow(() -> new NotFoundException("サイトが見つかりません: " + novel.getSiteId()));

        if (!site.isSupported()) {
            throw new ContentNotAvailableException(site.getCode());
        }

        NovelSiteAdapter adapter = adapterRegistry.resolve(site.getCode());
        return adapter.fetchChapterContent(novel.getExternalNovelId(), chapter.getExternalChapterId());
    }

    /**
     * 作品の全話本文をまとめて取得する（オフライン一括保存用）。
     * サイトへのリクエスト間隔は{@link com.novelshelf.infrastructure.adapter.narou.NarouRateLimiter}が
     * 全リクエスト共通で1秒以上空けるため、話数が多い作品ほど時間がかかる（例: 300話なら約5分）。
     * 一括「事前」保存の乱用を避けるため、本メソッドはユーザーが明示的に呼び出す操作としてのみ提供する。
     */
    public List<ChapterWithContent> getAllChapterContents(UUID novelId) {
        Novel novel = getById(novelId);
        Site site = siteRepository
                .findById(novel.getSiteId())
                .orElseThrow(() -> new NotFoundException("サイトが見つかりません: " + novel.getSiteId()));

        if (!site.isSupported()) {
            throw new ContentNotAvailableException(site.getCode());
        }

        NovelSiteAdapter adapter = adapterRegistry.resolve(site.getCode());
        List<Chapter> chapters = getChapters(novelId);

        return chapters.stream()
                .map(chapter -> {
                    ExternalChapterContent content =
                            adapter.fetchChapterContent(novel.getExternalNovelId(), chapter.getExternalChapterId());
                    return new ChapterWithContent(
                            chapter.getId(), chapter.getChapterNo(), content.title(), content.bodyHtml(), content.sourceUrl());
                })
                .toList();
    }
}
