package com.novelshelf.presentation.novel;

import com.novelshelf.domain.novel.Chapter;
import java.time.Instant;
import java.util.UUID;

public record ChapterResponse(UUID id, UUID novelId, int chapterNo, String title, Instant publishedAt) {
    public static ChapterResponse from(Chapter chapter) {
        return new ChapterResponse(
                chapter.getId(), chapter.getNovelId(), chapter.getChapterNo(), chapter.getTitle(), chapter.getPublishedAt());
    }
}
