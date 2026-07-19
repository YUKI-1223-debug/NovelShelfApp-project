package com.novelshelf.application.novel;

import java.util.UUID;

public record ChapterWithContent(UUID chapterId, int chapterNo, String title, String bodyHtml, String sourceUrl) {}
