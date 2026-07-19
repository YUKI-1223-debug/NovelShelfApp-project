package com.novelshelf.application.novel;

import com.novelshelf.domain.novel.Novel;
import com.novelshelf.domain.novel.NovelRepository;
import com.novelshelf.domain.novel.Site;
import com.novelshelf.domain.novel.SiteRepository;
import com.novelshelf.domain.shelf.BookshelfEntry;
import com.novelshelf.domain.shelf.BookshelfEntryRepository;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class UpdateService {

    private static final Logger log = LoggerFactory.getLogger(UpdateService.class);

    private final BookshelfEntryRepository bookshelfEntryRepository;
    private final NovelRepository novelRepository;
    private final SiteRepository siteRepository;
    private final NovelUpdateChecker updateChecker;
    private final IngestService ingestService;

    public UpdateService(
            BookshelfEntryRepository bookshelfEntryRepository,
            NovelRepository novelRepository,
            SiteRepository siteRepository,
            NovelUpdateChecker updateChecker,
            IngestService ingestService) {
        this.bookshelfEntryRepository = bookshelfEntryRepository;
        this.novelRepository = novelRepository;
        this.siteRepository = siteRepository;
        this.updateChecker = updateChecker;
        this.ingestService = ingestService;
    }

    public List<Novel> listUpdated(UUID userId) {
        return bookshelfEntryRepository.findByUserId(userId).stream()
                .map(BookshelfEntry::getNovelId)
                .map(novelId -> novelRepository.findById(novelId).orElse(null))
                .filter(Objects::nonNull)
                .filter(novel -> updateChecker.hasUpdate(userId, novel))
                .toList();
    }

    @Async
    public void checkUpdatesAsync(UUID userId) {
        List<BookshelfEntry> entries = bookshelfEntryRepository.findByUserId(userId);
        for (BookshelfEntry entry : entries) {
            Novel novel = novelRepository.findById(entry.getNovelId()).orElse(null);
            if (novel == null) {
                continue;
            }
            Site site = siteRepository.findById(novel.getSiteId()).orElse(null);
            if (site == null || !site.isSupported()) {
                continue;
            }
            try {
                ingestService.resolveNovel(novel.getSourceUrl());
            } catch (RuntimeException e) {
                log.warn("更新確認に失敗しました: novelId={}, reason={}", novel.getId(), e.getMessage());
            }
        }
    }
}
