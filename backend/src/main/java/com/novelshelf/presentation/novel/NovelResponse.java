package com.novelshelf.presentation.novel;

import com.novelshelf.domain.novel.NovelStatus;
import com.novelshelf.domain.novel.SiteCode;
import java.util.UUID;

public record NovelResponse(
        UUID id,
        String title,
        String author,
        SiteCode site,
        boolean siteSupported,
        String genre,
        String coverUrl,
        String sourceUrl,
        NovelStatus status,
        int latestKnownChapterNo,
        boolean hasUpdate,
        UUID seriesId) {}
