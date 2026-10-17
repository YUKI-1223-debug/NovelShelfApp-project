package com.novelshelf.application.reading;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.novelshelf.domain.novel.Chapter;
import com.novelshelf.domain.novel.ChapterRepository;
import com.novelshelf.domain.reading.ReadingHistoryRepository;
import com.novelshelf.domain.reading.ReadingPosition;
import com.novelshelf.domain.reading.ReadingPositionRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** 読書位置の時刻比較(個人利用アプリ化 フェーズ2 設計書 §7-2)。 */
@ExtendWith(MockitoExtension.class)
class ReadingServiceTest {

    @Mock ReadingPositionRepository readingPositionRepository;
    @Mock ReadingHistoryRepository readingHistoryRepository;
    @Mock ChapterRepository chapterRepository;

    ReadingService service;

    private final UUID userId = UUID.randomUUID();
    private final UUID novelId = UUID.randomUUID();
    private final UUID oldChapterId = UUID.randomUUID();
    private final UUID newChapterId = UUID.randomUUID();
    private final Instant savedAt = Instant.now().minus(Duration.ofHours(1));

    @BeforeEach
    void setUp() {
        service = new ReadingService(readingPositionRepository, readingHistoryRepository, chapterRepository);
        when(chapterRepository.findById(newChapterId))
                .thenReturn(Optional.of(Chapter.builder().id(newChapterId).chapterNo(12).build()));
    }

    private ReadingPosition existingPosition() {
        ReadingPosition p = ReadingPosition.builder()
                .userId(userId)
                .novelId(novelId)
                .chapterId(oldChapterId)
                .lastReadChapterNo(10)
                .scrollPosition(0.5f)
                .lastReadAt(savedAt)
                .build();
        when(readingPositionRepository.findByUserIdAndNovelId(userId, novelId)).thenReturn(Optional.of(p));
        return p;
    }

    private void saveReturnsArgument() {
        when(readingPositionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void newerClientTimeOverwritesAndKeepsTheClientTime() {
        existingPosition();
        saveReturnsArgument();
        Instant readAt = savedAt.plus(Duration.ofMinutes(10));

        ReadingPosition result = service.savePosition(userId, novelId, newChapterId, 0.1f, readAt);

        assertThat(result.getChapterId()).isEqualTo(newChapterId);
        assertThat(result.getLastReadChapterNo()).isEqualTo(12);
        assertThat(result.getLastReadAt()).isEqualTo(readAt);
    }

    @Test
    void olderClientTimeIsIgnoredAndCurrentPositionIsReturned() {
        ReadingPosition existing = existingPosition();

        ReadingPosition result =
                service.savePosition(userId, novelId, newChapterId, 0.1f, savedAt.minus(Duration.ofMinutes(30)));

        assertThat(result).isSameAs(existing);
        assertThat(result.getChapterId()).isEqualTo(oldChapterId);
        verify(readingPositionRepository, never()).save(any());
    }

    @Test
    void withoutClientTimeOldAppsStillOverwrite() {
        existingPosition();
        saveReturnsArgument();
        Instant before = Instant.now();

        ReadingPosition result = service.savePosition(userId, novelId, newChapterId, 0.1f, null);

        assertThat(result.getChapterId()).isEqualTo(newChapterId);
        assertThat(result.getLastReadAt()).isAfterOrEqualTo(before);
    }

    @Test
    void futureClientTimeIsClampedToNow() {
        existingPosition();
        saveReturnsArgument();

        ReadingPosition result =
                service.savePosition(userId, novelId, newChapterId, 0.1f, Instant.now().plus(Duration.ofDays(1)));

        assertThat(result.getLastReadAt()).isBeforeOrEqualTo(Instant.now());
    }

    @Test
    void firstPositionIsSavedEvenWithClientTime() {
        when(readingPositionRepository.findByUserIdAndNovelId(userId, novelId)).thenReturn(Optional.empty());
        saveReturnsArgument();
        Instant readAt = Instant.now().minus(Duration.ofDays(2));

        ReadingPosition result = service.savePosition(userId, novelId, newChapterId, 0.3f, readAt);

        assertThat(result.getChapterId()).isEqualTo(newChapterId);
        assertThat(result.getLastReadAt()).isEqualTo(readAt);
    }
}
