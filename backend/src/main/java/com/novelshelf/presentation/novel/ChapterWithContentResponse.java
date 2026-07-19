package com.novelshelf.presentation.novel;

import com.novelshelf.application.novel.ChapterWithContent;
import java.util.UUID;

public record ChapterWithContentResponse(
        UUID chapterId, int chapterNo, String title, String bodyHtml, String sourceUrl) {
    public static ChapterWithContentResponse from(ChapterWithContent c) {
        return new ChapterWithContentResponse(
                c.chapterId(), c.chapterNo(), c.title(), c.bodyHtml(), c.sourceUrl());
    }
}
