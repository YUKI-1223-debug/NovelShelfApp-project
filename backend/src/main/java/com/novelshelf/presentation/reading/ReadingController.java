package com.novelshelf.presentation.reading;

import com.novelshelf.application.reading.ReadingService;
import com.novelshelf.domain.novel.Chapter;
import com.novelshelf.domain.novel.ChapterRepository;
import com.novelshelf.domain.reading.ReadingHistory;
import com.novelshelf.domain.reading.ReadingPosition;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/reading")
public class ReadingController {

    private final ReadingService readingService;
    private final ChapterRepository chapterRepository;

    public ReadingController(ReadingService readingService, ChapterRepository chapterRepository) {
        this.readingService = readingService;
        this.chapterRepository = chapterRepository;
    }

    public record ReadingPositionResponse(UUID novelId, UUID chapterId, float scrollPosition, Instant lastReadAt) {
        static ReadingPositionResponse from(ReadingPosition p) {
            return new ReadingPositionResponse(p.getNovelId(), p.getChapterId(), p.getScrollPosition(), p.getLastReadAt());
        }
    }

    public record UpdatePositionRequest(@NotNull UUID chapterId, @NotNull Float scrollPosition) {}

    public record RecordHistoryRequest(
            @NotNull UUID chapterId, @NotNull Instant readAt, @NotNull Integer durationSeconds) {}

    public record ReadingHistoryItemResponse(
            UUID novelId, UUID chapterId, String title, Instant readAt, int durationSeconds) {}

    @GetMapping("/positions/{novelId}")
    public ReadingPositionResponse getPosition(@PathVariable UUID novelId, @AuthenticationPrincipal UUID userId) {
        return ReadingPositionResponse.from(readingService.getPosition(userId, novelId));
    }

    @PutMapping("/positions/{novelId}")
    public ReadingPositionResponse putPosition(
            @PathVariable UUID novelId, @Valid @RequestBody UpdatePositionRequest request, @AuthenticationPrincipal UUID userId) {
        ReadingPosition position =
                readingService.savePosition(userId, novelId, request.chapterId(), request.scrollPosition());
        return ReadingPositionResponse.from(position);
    }

    @PostMapping("/history")
    @ResponseStatus(HttpStatus.CREATED)
    public void recordHistory(@Valid @RequestBody RecordHistoryRequest request, @AuthenticationPrincipal UUID userId) {
        readingService.recordHistory(userId, request.chapterId(), request.readAt(), request.durationSeconds());
    }

    @GetMapping("/history")
    public List<ReadingHistoryItemResponse> history(
            @RequestParam(required = false, defaultValue = "20") int limit, @AuthenticationPrincipal UUID userId) {
        return readingService.recentHistory(userId, limit).stream()
                .map(this::toHistoryItem)
                .toList();
    }

    private ReadingHistoryItemResponse toHistoryItem(ReadingHistory h) {
        Chapter chapter = chapterRepository.findById(h.getChapterId()).orElse(null);
        return new ReadingHistoryItemResponse(
                chapter != null ? chapter.getNovelId() : null,
                h.getChapterId(),
                chapter != null ? chapter.getTitle() : "",
                h.getReadAt(),
                h.getDurationSeconds());
    }
}
