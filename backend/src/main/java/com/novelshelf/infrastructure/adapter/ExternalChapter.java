package com.novelshelf.infrastructure.adapter;

import java.time.Instant;

public record ExternalChapter(
        String externalChapterId, int chapterNo, String title, String sourceUrl, Instant publishedAt) {}
