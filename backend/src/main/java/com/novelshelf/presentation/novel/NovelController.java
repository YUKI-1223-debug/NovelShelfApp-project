package com.novelshelf.presentation.novel;

import com.novelshelf.application.novel.IngestService;
import com.novelshelf.application.novel.NovelQueryService;
import com.novelshelf.domain.novel.Novel;
import com.novelshelf.domain.novel.SiteCode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class NovelController {

    private final IngestService ingestService;
    private final NovelQueryService novelQueryService;
    private final NovelResponseMapper mapper;

    public NovelController(IngestService ingestService, NovelQueryService novelQueryService, NovelResponseMapper mapper) {
        this.ingestService = ingestService;
        this.novelQueryService = novelQueryService;
        this.mapper = mapper;
    }

    public record ResolveNovelRequest(@NotBlank String url) {}

    @PostMapping("/novels/resolve")
    public NovelDetailResponse resolve(@Valid @RequestBody ResolveNovelRequest request, @AuthenticationPrincipal UUID userId) {
        Novel novel = ingestService.resolveNovel(request.url());
        return mapper.toDetailResponse(novel, userId);
    }

    @GetMapping("/novels/{novelId}")
    public NovelDetailResponse detail(@PathVariable UUID novelId, @AuthenticationPrincipal UUID userId) {
        return mapper.toDetailResponse(novelQueryService.getById(novelId), userId);
    }

    public record UpdateTitleRequest(@NotBlank String title) {}

    @PatchMapping("/novels/{novelId}")
    public NovelDetailResponse updateTitle(
            @PathVariable UUID novelId, @Valid @RequestBody UpdateTitleRequest request, @AuthenticationPrincipal UUID userId) {
        Novel novel = novelQueryService.updateTitle(novelId, request.title());
        return mapper.toDetailResponse(novel, userId);
    }

    @GetMapping("/novels/{novelId}/chapters")
    public List<ChapterResponse> chapters(@PathVariable UUID novelId) {
        return novelQueryService.getChapters(novelId).stream().map(ChapterResponse::from).toList();
    }

    /**
     * 全話本文を一括取得する（作品単位のオフライン保存用）。サイトへのリクエストは1秒間隔を維持するため、
     * 話数が多い作品ほどレスポンスに時間がかかる（例: 300話で約5分）。
     */
    @PostMapping("/novels/{novelId}/download")
    public List<ChapterWithContentResponse> downloadAll(@PathVariable UUID novelId) {
        return novelQueryService.getAllChapterContents(novelId).stream()
                .map(ChapterWithContentResponse::from)
                .toList();
    }

    @GetMapping("/novels/search")
    public List<NovelResponse> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) SiteCode site,
            @RequestParam(required = false) String genre,
            @RequestParam(required = false) String tag,
            @AuthenticationPrincipal UUID userId) {
        return novelQueryService.search(q, site, genre, tag, userId).stream()
                .map(n -> mapper.toResponse(n, userId))
                .toList();
    }
}
