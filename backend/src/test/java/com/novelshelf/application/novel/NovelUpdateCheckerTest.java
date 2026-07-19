package com.novelshelf.application.novel;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.novelshelf.domain.novel.Novel;
import com.novelshelf.domain.reading.ReadingPosition;
import com.novelshelf.domain.reading.ReadingPositionRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class NovelUpdateCheckerTest {

    @Mock
    private ReadingPositionRepository readingPositionRepository;

    @Test
    void hasUpdate_returnsFalse_whenNoReadingPositionExists() {
        NovelUpdateChecker checker = new NovelUpdateChecker(readingPositionRepository);
        UUID userId = UUID.randomUUID();
        Novel novel = Novel.builder().id(UUID.randomUUID()).latestKnownChapterNo(5).build();

        when(readingPositionRepository.findByUserIdAndNovelId(userId, novel.getId())).thenReturn(Optional.empty());

        assertThat(checker.hasUpdate(userId, novel)).isFalse();
    }

    @Test
    void hasUpdate_returnsTrue_whenLatestChapterIsAheadOfLastRead() {
        NovelUpdateChecker checker = new NovelUpdateChecker(readingPositionRepository);
        UUID userId = UUID.randomUUID();
        Novel novel = Novel.builder().id(UUID.randomUUID()).latestKnownChapterNo(10).build();
        ReadingPosition position =
                ReadingPosition.builder().lastReadChapterNo(7).build();

        when(readingPositionRepository.findByUserIdAndNovelId(userId, novel.getId()))
                .thenReturn(Optional.of(position));

        assertThat(checker.hasUpdate(userId, novel)).isTrue();
    }

    @Test
    void hasUpdate_returnsFalse_whenCaughtUpToLatestChapter() {
        NovelUpdateChecker checker = new NovelUpdateChecker(readingPositionRepository);
        UUID userId = UUID.randomUUID();
        Novel novel = Novel.builder().id(UUID.randomUUID()).latestKnownChapterNo(10).build();
        ReadingPosition position =
                ReadingPosition.builder().lastReadChapterNo(10).build();

        when(readingPositionRepository.findByUserIdAndNovelId(userId, novel.getId()))
                .thenReturn(Optional.of(position));

        assertThat(checker.hasUpdate(userId, novel)).isFalse();
    }
}
