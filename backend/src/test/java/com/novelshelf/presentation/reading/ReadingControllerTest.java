package com.novelshelf.presentation.reading;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyFloat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.novelshelf.application.reading.ReadingService;
import com.novelshelf.domain.novel.ChapterRepository;
import com.novelshelf.domain.reading.ReadingPosition;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

@ExtendWith(MockitoExtension.class)
class ReadingControllerTest {

    @Mock ReadingService readingService;
    @Mock ChapterRepository chapterRepository;
    @InjectMocks ReadingController controller;

    private final UUID userId = UUID.randomUUID();
    private final UUID novelId = UUID.randomUUID();
    private final UUID chapterId = UUID.randomUUID();
    private final Instant readAt = Instant.parse("2026-10-18T03:57:21Z");

    private ReadingController.UpdatePositionRequest request() {
        return new ReadingController.UpdatePositionRequest(chapterId, 0.3f, readAt);
    }

    @Test
    void retriesOnceWhenTwoFirstSavesRaceOnTheUniqueConstraint() {
        ReadingPosition saved = ReadingPosition.builder()
                .userId(userId).novelId(novelId).chapterId(chapterId).lastReadChapterNo(1).lastReadAt(readAt).build();
        when(readingService.savePosition(eq(userId), eq(novelId), eq(chapterId), anyFloat(), any()))
                .thenThrow(new DataIntegrityViolationException("uq_reading_positions_user_novel"))
                .thenReturn(saved);

        var response = controller.putPosition(novelId, request(), userId);

        assertThat(response.chapterId()).isEqualTo(chapterId);
        verify(readingService, times(2)).savePosition(userId, novelId, chapterId, 0.3f, readAt);
    }

    @Test
    void doesNotRetryForever() {
        when(readingService.savePosition(eq(userId), eq(novelId), eq(chapterId), anyFloat(), any()))
                .thenThrow(new DataIntegrityViolationException("still failing"));

        assertThatThrownBy(() -> controller.putPosition(novelId, request(), userId))
                .isInstanceOf(DataIntegrityViolationException.class);
        verify(readingService, times(2)).savePosition(userId, novelId, chapterId, 0.3f, readAt);
    }
}
