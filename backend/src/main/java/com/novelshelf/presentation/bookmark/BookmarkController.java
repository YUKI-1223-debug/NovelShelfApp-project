package com.novelshelf.presentation.bookmark;

import com.novelshelf.application.bookmark.BookmarkService;
import com.novelshelf.domain.bookmark.Bookmark;
import com.novelshelf.domain.novel.Chapter;
import com.novelshelf.domain.novel.ChapterRepository;
import com.novelshelf.presentation.shelf.TagResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/bookmarks")
public class BookmarkController {

    private final BookmarkService bookmarkService;
    private final ChapterRepository chapterRepository;

    public BookmarkController(BookmarkService bookmarkService, ChapterRepository chapterRepository) {
        this.bookmarkService = bookmarkService;
        this.chapterRepository = chapterRepository;
    }

    public record BookmarkRequest(
            @NotNull UUID chapterId, @NotBlank String name, String memo, Float scrollPosition, List<UUID> tagIds) {}

    public record BookmarkResponse(
            UUID id,
            UUID chapterId,
            UUID novelId,
            int chapterNo,
            String chapterTitle,
            String name,
            String memo,
            float scrollPosition,
            List<TagResponse> tags,
            Instant createdAt) {}

    private BookmarkResponse toResponse(Bookmark b) {
        Chapter chapter = chapterRepository.findById(b.getChapterId()).orElse(null);
        return new BookmarkResponse(
                b.getId(),
                b.getChapterId(),
                chapter != null ? chapter.getNovelId() : null,
                chapter != null ? chapter.getChapterNo() : 0,
                chapter != null ? chapter.getTitle() : "",
                b.getName(),
                b.getMemo(),
                b.getScrollPosition(),
                b.getTags().stream().map(TagResponse::from).toList(),
                b.getCreatedAt());
    }

    @GetMapping
    public List<BookmarkResponse> list(
            @RequestParam(required = false) UUID novelId,
            @RequestParam(required = false) String tag,
            @AuthenticationPrincipal UUID userId) {
        return bookmarkService.list(userId, novelId, tag).stream().map(this::toResponse).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BookmarkResponse create(@Valid @RequestBody BookmarkRequest request, @AuthenticationPrincipal UUID userId) {
        float scrollPosition = request.scrollPosition() != null ? request.scrollPosition() : 0f;
        Bookmark bookmark = bookmarkService.create(
                userId, request.chapterId(), request.name(), request.memo(), scrollPosition, request.tagIds());
        return toResponse(bookmark);
    }

    @PatchMapping("/{bookmarkId}")
    public BookmarkResponse update(
            @PathVariable UUID bookmarkId, @RequestBody BookmarkRequest request, @AuthenticationPrincipal UUID userId) {
        Bookmark bookmark = bookmarkService.update(
                bookmarkId, userId, request.name(), request.memo(), request.scrollPosition(), request.tagIds());
        return toResponse(bookmark);
    }

    @DeleteMapping("/{bookmarkId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID bookmarkId, @AuthenticationPrincipal UUID userId) {
        bookmarkService.delete(bookmarkId, userId);
    }
}
