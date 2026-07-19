package com.novelshelf.application.stats;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.novelshelf.domain.novel.AuthorRepository;
import com.novelshelf.domain.novel.Chapter;
import com.novelshelf.domain.novel.ChapterRepository;
import com.novelshelf.domain.novel.Novel;
import com.novelshelf.domain.novel.NovelRepository;
import com.novelshelf.domain.novel.NovelStatus;
import com.novelshelf.domain.novel.SiteRepository;
import com.novelshelf.domain.reading.ReadingHistory;
import com.novelshelf.domain.reading.ReadingHistoryRepository;
import com.novelshelf.domain.shelf.BookshelfEntryRepository;
import com.novelshelf.domain.shelf.ShelfStatus;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class StatsServiceTest {

    private static final ZoneId JST = ZoneId.of("Asia/Tokyo");

    @Mock
    private BookshelfEntryRepository bookshelfEntryRepository;

    @Mock
    private ReadingHistoryRepository readingHistoryRepository;

    @Mock
    private ChapterRepository chapterRepository;

    @Mock
    private NovelRepository novelRepository;

    @Mock
    private AuthorRepository authorRepository;

    @Mock
    private SiteRepository siteRepository;

    @InjectMocks
    private StatsService statsService;

    @Test
    void summary_aggregatesCompletedNovelsChaptersAndSeconds() {
        UUID userId = UUID.randomUUID();
        when(bookshelfEntryRepository.countByUserIdAndStatus(userId, ShelfStatus.COMPLETED)).thenReturn(3L);
        when(readingHistoryRepository.countDistinctChaptersByUserId(userId)).thenReturn(42L);
        when(readingHistoryRepository.sumDurationSecondsByUserId(userId)).thenReturn(9000L);

        StatsSummary summary = statsService.summary(userId);

        assertThat(summary.totalCompletedNovels()).isEqualTo(3);
        assertThat(summary.totalReadChapters()).isEqualTo(42);
        assertThat(summary.totalReadingSeconds()).isEqualTo(9000);
    }

    @Test
    void calendar_bucketsReadingSecondsByJstDate() {
        UUID userId = UUID.randomUUID();
        UUID chapterId = UUID.randomUUID();
        YearMonth yearMonth = YearMonth.of(2026, 7);

        // 2026-07-15 09:00 JST と 2026-07-15 21:00 JST は同じ日、2026-07-16 00:30 JSTは別の日
        Instant morning = Instant.parse("2026-07-15T00:00:00Z"); // JST 09:00
        Instant evening = Instant.parse("2026-07-15T12:00:00Z"); // JST 21:00
        Instant nextDay = Instant.parse("2026-07-15T15:30:00Z"); // JST 2026-07-16 00:30

        when(readingHistoryRepository.findByUserIdAndReadAtBetween(any(), any(), any()))
                .thenReturn(List.of(
                        ReadingHistory.builder().userId(userId).chapterId(chapterId).readAt(morning).durationSeconds(100).build(),
                        ReadingHistory.builder().userId(userId).chapterId(chapterId).readAt(evening).durationSeconds(200).build(),
                        ReadingHistory.builder().userId(userId).chapterId(chapterId).readAt(nextDay).durationSeconds(50).build()));

        List<CalendarDay> days = statsService.calendar(userId, yearMonth);

        assertThat(days).hasSize(2);
        assertThat(days.stream().mapToLong(CalendarDay::readingSeconds).sum()).isEqualTo(350);
        CalendarDay firstDay = days.get(0);
        assertThat(firstDay.date().toString()).isEqualTo("2026-07-15");
        assertThat(firstDay.readingSeconds()).isEqualTo(300);
    }

    @Test
    void breakdown_bySite_groupsBySiteName() {
        UUID userId = UUID.randomUUID();
        UUID chapterId = UUID.randomUUID();
        UUID novelId = UUID.randomUUID();
        UUID siteId = UUID.randomUUID();
        UUID authorId = UUID.randomUUID();

        Chapter chapter = Chapter.builder().id(chapterId).novelId(novelId).chapterNo(1).title("第1話").build();
        Novel novel = Novel.builder()
                .id(novelId)
                .siteId(siteId)
                .authorId(authorId)
                .title("テスト")
                .status(NovelStatus.ONGOING)
                .build();

        when(readingHistoryRepository.findByUserIdOrderByReadAtDesc(userId))
                .thenReturn(List.of(ReadingHistory.builder()
                        .userId(userId)
                        .chapterId(chapterId)
                        .readAt(Instant.now())
                        .durationSeconds(120)
                        .build()));
        when(chapterRepository.findAllById(List.of(chapterId))).thenReturn(List.of(chapter));
        when(novelRepository.findByIdIn(List.of(novelId))).thenReturn(List.of(novel));
        when(siteRepository.findById(siteId)).thenReturn(java.util.Optional.of(
                com.novelshelf.domain.novel.Site.builder().id(siteId).name("小説家になろう").build()));

        List<BreakdownItem> breakdown = statsService.breakdown(userId, BreakdownDimension.SITE, StatsRange.ALL);

        assertThat(breakdown).hasSize(1);
        assertThat(breakdown.get(0).label()).isEqualTo("小説家になろう");
        assertThat(breakdown.get(0).readingSeconds()).isEqualTo(120);
    }
}
