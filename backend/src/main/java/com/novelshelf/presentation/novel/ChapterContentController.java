package com.novelshelf.presentation.novel;

import com.novelshelf.application.novel.NovelQueryService;
import com.novelshelf.infrastructure.adapter.ExternalChapterContent;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/chapters")
public class ChapterContentController {

    private final NovelQueryService novelQueryService;

    public ChapterContentController(NovelQueryService novelQueryService) {
        this.novelQueryService = novelQueryService;
    }

    @GetMapping("/{chapterId}/content")
    public ChapterContentResponse content(@PathVariable UUID chapterId) {
        ExternalChapterContent content = novelQueryService.getChapterContent(chapterId);
        return new ChapterContentResponse(chapterId, content.title(), content.bodyHtml(), content.sourceUrl());
    }
}
