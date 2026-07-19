package com.novelshelf.presentation.shelf;

import com.novelshelf.application.novel.NovelQueryService;
import com.novelshelf.application.shelf.BookshelfService;
import com.novelshelf.domain.shelf.BookshelfEntry;
import com.novelshelf.domain.shelf.ShelfStatus;
import com.novelshelf.presentation.novel.NovelResponseMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/shelf")
public class BookshelfController {

    private final BookshelfService bookshelfService;
    private final NovelQueryService novelQueryService;
    private final NovelResponseMapper novelResponseMapper;

    public BookshelfController(
            BookshelfService bookshelfService, NovelQueryService novelQueryService, NovelResponseMapper novelResponseMapper) {
        this.bookshelfService = bookshelfService;
        this.novelQueryService = novelQueryService;
        this.novelResponseMapper = novelResponseMapper;
    }

    public record AddToShelfRequest(@NotNull UUID novelId, ShelfStatus status) {}

    public record UpdateShelfEntryRequest(ShelfStatus status, Boolean isFavorite, List<UUID> tagIds) {}

    @GetMapping
    public List<BookshelfEntryResponse> list(
            @RequestParam(required = false) ShelfStatus status,
            @RequestParam(required = false) Boolean favorite,
            @RequestParam(required = false) String groupBy,
            @AuthenticationPrincipal UUID userId) {
        List<BookshelfEntryResponse> responses = bookshelfService.list(userId, status, favorite).stream()
                .map(entry -> toResponse(entry, userId))
                .collect(java.util.stream.Collectors.toCollection(java.util.ArrayList::new));

        if (groupBy != null) {
            responses.sort(groupComparator(groupBy));
        }
        return responses;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BookshelfEntryResponse add(@Valid @RequestBody AddToShelfRequest request, @AuthenticationPrincipal UUID userId) {
        BookshelfEntry entry = bookshelfService.addToShelf(userId, request.novelId(), request.status());
        return toResponse(entry, userId);
    }

    @PatchMapping("/{entryId}")
    public BookshelfEntryResponse update(
            @PathVariable UUID entryId, @RequestBody UpdateShelfEntryRequest request, @AuthenticationPrincipal UUID userId) {
        BookshelfEntry entry =
                bookshelfService.update(entryId, userId, request.status(), request.isFavorite(), request.tagIds());
        return toResponse(entry, userId);
    }

    @DeleteMapping("/{entryId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable UUID entryId, @AuthenticationPrincipal UUID userId) {
        bookshelfService.remove(entryId, userId);
    }

    private BookshelfEntryResponse toResponse(BookshelfEntry entry, UUID userId) {
        var novel = novelQueryService.getById(entry.getNovelId());
        var tags = entry.getTags().stream().map(TagResponse::from).toList();
        return new BookshelfEntryResponse(
                entry.getId(),
                novelResponseMapper.toResponse(novel, userId),
                entry.getStatus(),
                entry.isFavorite(),
                tags,
                entry.getAddedAt());
    }

    private Comparator<BookshelfEntryResponse> groupComparator(String groupBy) {
        return switch (groupBy) {
            case "author" -> Comparator.comparing(r -> r.novel().author());
            case "site" -> Comparator.comparing(r -> r.novel().site() != null ? r.novel().site().name() : "");
            case "series" -> Comparator.comparing(
                    r -> r.novel().seriesId() != null ? r.novel().seriesId().toString() : "");
            case "tag" -> Comparator.comparing(
                    r -> r.tags().isEmpty() ? "" : r.tags().get(0).name());
            default -> Comparator.comparing(BookshelfEntryResponse::addedAt).reversed();
        };
    }
}
