package com.novelshelf.infrastructure.adapter;

import com.novelshelf.domain.novel.NovelStatus;

public record ExternalNovelMetadata(
        String externalNovelId,
        String title,
        String authorExternalId,
        String authorName,
        String authorProfileUrl,
        String synopsis,
        String genre,
        String sourceUrl,
        NovelStatus status,
        int totalChapters) {}
