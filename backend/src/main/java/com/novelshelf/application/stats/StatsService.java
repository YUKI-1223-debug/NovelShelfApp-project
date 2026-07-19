package com.novelshelf.application.stats;

import com.novelshelf.domain.novel.Author;
import com.novelshelf.domain.novel.Chapter;
import com.novelshelf.domain.novel.ChapterRepository;
import com.novelshelf.domain.novel.Novel;
import com.novelshelf.domain.novel.NovelRepository;
import com.novelshelf.domain.novel.Site;
import com.novelshelf.domain.novel.SiteRepository;
import com.novelshelf.domain.reading.ReadingHistory;
import com.novelshelf.domain.reading.ReadingHistoryRepository;
import com.novelshelf.domain.shelf.BookshelfEntryRepository;
import com.novelshelf.domain.shelf.ShelfStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class StatsService {

    private static final ZoneId JST = ZoneId.of("Asia/Tokyo");

    private final BookshelfEntryRepository bookshelfEntryRepository;
    private final ReadingHistoryRepository readingHistoryRepository;
    private final ChapterRepository chapterRepository;
    private final NovelRepository novelRepository;
    private final com.novelshelf.domain.novel.AuthorRepository authorRepository;
    private final SiteRepository siteRepository;

    public StatsService(
            BookshelfEntryRepository bookshelfEntryRepository,
            ReadingHistoryRepository readingHistoryRepository,
            ChapterRepository chapterRepository,
            NovelRepository novelRepository,
            com.novelshelf.domain.novel.AuthorRepository authorRepository,
            SiteRepository siteRepository) {
        this.bookshelfEntryRepository = bookshelfEntryRepository;
        this.readingHistoryRepository = readingHistoryRepository;
        this.chapterRepository = chapterRepository;
        this.novelRepository = novelRepository;
        this.authorRepository = authorRepository;
        this.siteRepository = siteRepository;
    }

    public StatsSummary summary(UUID userId) {
        long completedNovels = bookshelfEntryRepository.countByUserIdAndStatus(userId, ShelfStatus.COMPLETED);
        long readChapters = readingHistoryRepository.countDistinctChaptersByUserId(userId);
        long totalSeconds = readingHistoryRepository.sumDurationSecondsByUserId(userId);
        return new StatsSummary(completedNovels, readChapters, totalSeconds);
    }

    public List<BreakdownItem> breakdown(UUID userId, BreakdownDimension dimension, StatsRange range) {
        List<ReadingHistory> history = filterByRange(readingHistoryRepository.findByUserIdOrderByReadAtDesc(userId), range);
        if (history.isEmpty()) {
            return List.of();
        }

        Map<UUID, Chapter> chaptersById = chapterRepository
                .findAllById(history.stream().map(ReadingHistory::getChapterId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(Chapter::getId, c -> c));

        Map<UUID, Novel> novelsById = novelRepository
                .findByIdIn(chaptersById.values().stream()
                        .map(Chapter::getNovelId)
                        .distinct()
                        .toList())
                .stream()
                .collect(Collectors.toMap(Novel::getId, n -> n));

        Map<String, Long> totals = new HashMap<>();
        for (ReadingHistory h : history) {
            Chapter chapter = chaptersById.get(h.getChapterId());
            if (chapter == null) {
                continue;
            }
            Novel novel = novelsById.get(chapter.getNovelId());
            String label = switch (dimension) {
                case MONTH -> YearMonth.from(h.getReadAt().atZone(JST)).toString();
                case SITE -> novel != null ? siteLabel(novel.getSiteId()) : "不明";
                case AUTHOR -> novel != null ? authorLabel(novel.getAuthorId()) : "不明";
            };
            totals.merge(label, (long) h.getDurationSeconds(), Long::sum);
        }

        return totals.entrySet().stream()
                .map(e -> new BreakdownItem(e.getKey(), e.getValue()))
                .sorted(Comparator.comparingLong(BreakdownItem::readingSeconds).reversed())
                .toList();
    }

    public List<CalendarDay> calendar(UUID userId, YearMonth yearMonth) {
        Instant from = yearMonth.atDay(1).atStartOfDay(JST).toInstant();
        Instant to = yearMonth.atEndOfMonth().plusDays(1).atStartOfDay(JST).toInstant();

        List<ReadingHistory> history = readingHistoryRepository.findByUserIdAndReadAtBetween(userId, from, to);

        Map<LocalDate, Long> totals = new HashMap<>();
        for (ReadingHistory h : history) {
            LocalDate date = h.getReadAt().atZone(JST).toLocalDate();
            totals.merge(date, (long) h.getDurationSeconds(), Long::sum);
        }

        return totals.entrySet().stream()
                .map(e -> new CalendarDay(e.getKey(), e.getValue()))
                .sorted(Comparator.comparing(CalendarDay::date))
                .toList();
    }

    private List<ReadingHistory> filterByRange(List<ReadingHistory> history, StatsRange range) {
        if (range == null || range == StatsRange.ALL) {
            return history;
        }
        Instant now = Instant.now();
        Instant from = switch (range) {
            case TODAY -> now.atZone(JST).toLocalDate().atStartOfDay(JST).toInstant();
            case WEEK -> now.minusSeconds(7L * 24 * 3600);
            case MONTH -> now.minusSeconds(30L * 24 * 3600);
            case YEAR -> now.minusSeconds(365L * 24 * 3600);
            case ALL -> Instant.EPOCH;
        };
        return history.stream().filter(h -> !h.getReadAt().isBefore(from)).toList();
    }

    private String siteLabel(UUID siteId) {
        return siteRepository.findById(siteId).map(Site::getName).orElse("不明");
    }

    private String authorLabel(UUID authorId) {
        return authorRepository.findById(authorId).map(Author::getName).orElse("不明");
    }
}
