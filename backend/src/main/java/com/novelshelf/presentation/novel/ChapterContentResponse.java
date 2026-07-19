package com.novelshelf.presentation.novel;

import java.util.UUID;

public record ChapterContentResponse(UUID chapterId, String title, String bodyHtml, String sourceUrl) {}
