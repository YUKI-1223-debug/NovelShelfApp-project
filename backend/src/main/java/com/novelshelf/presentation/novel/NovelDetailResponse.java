package com.novelshelf.presentation.novel;

import com.novelshelf.domain.novel.NovelStatus;
import com.novelshelf.domain.novel.SiteCode;
import java.util.UUID;

public record NovelDetailResponse(
        UUID id,
        String title,
        String author,
        SiteCode site,
        String genre,
        String coverUrl,
        String sourceUrl,
        NovelStatus status,
        int latestKnownChapterNo,
        boolean hasUpdate,
        UUID seriesId,
        String synopsis,
        int totalChapters) {

    static NovelDetailResponse from(NovelResponse base, String synopsis, int totalChapters) {
        return new NovelDetailResponse(
                base.id(),
                base.title(),
                base.author(),
                base.site(),
                base.genre(),
                base.coverUrl(),
                base.sourceUrl(),
                base.status(),
                base.latestKnownChapterNo(),
                base.hasUpdate(),
                base.seriesId(),
                synopsis,
                totalChapters);
    }
}
