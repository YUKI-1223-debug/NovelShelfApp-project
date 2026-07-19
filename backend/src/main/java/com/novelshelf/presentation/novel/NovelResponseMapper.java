package com.novelshelf.presentation.novel;

import com.novelshelf.application.novel.NovelUpdateChecker;
import com.novelshelf.domain.novel.Author;
import com.novelshelf.domain.novel.AuthorRepository;
import com.novelshelf.domain.novel.Novel;
import com.novelshelf.domain.novel.Site;
import com.novelshelf.domain.novel.SiteRepository;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class NovelResponseMapper {

    private final AuthorRepository authorRepository;
    private final SiteRepository siteRepository;
    private final NovelUpdateChecker updateChecker;

    public NovelResponseMapper(
            AuthorRepository authorRepository, SiteRepository siteRepository, NovelUpdateChecker updateChecker) {
        this.authorRepository = authorRepository;
        this.siteRepository = siteRepository;
        this.updateChecker = updateChecker;
    }

    public NovelResponse toResponse(Novel novel, UUID userId) {
        String authorName =
                authorRepository.findById(novel.getAuthorId()).map(Author::getName).orElse("不明");
        var siteEntity = siteRepository.findById(novel.getSiteId()).orElse(null);
        var site = siteEntity != null ? siteEntity.getCode() : null;
        boolean siteSupported = siteEntity != null && siteEntity.isSupported();
        boolean hasUpdate = updateChecker.hasUpdate(userId, novel);
        return new NovelResponse(
                novel.getId(),
                novel.getTitle(),
                authorName,
                site,
                siteSupported,
                novel.getGenre(),
                novel.getCoverUrl(),
                novel.getSourceUrl(),
                novel.getStatus(),
                novel.getLatestKnownChapterNo(),
                hasUpdate,
                novel.getSeriesId());
    }

    public NovelDetailResponse toDetailResponse(Novel novel, UUID userId) {
        NovelResponse base = toResponse(novel, userId);
        return NovelDetailResponse.from(base, novel.getSynopsis(), novel.getLatestKnownChapterNo());
    }
}
