package com.novelshelf.application.reading;

import com.novelshelf.domain.common.NotFoundException;
import com.novelshelf.domain.novel.Chapter;
import com.novelshelf.domain.novel.ChapterRepository;
import com.novelshelf.domain.reading.ReadingHistory;
import com.novelshelf.domain.reading.ReadingHistoryRepository;
import com.novelshelf.domain.reading.ReadingPosition;
import com.novelshelf.domain.reading.ReadingPositionRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReadingService {

    private final ReadingPositionRepository readingPositionRepository;
    private final ReadingHistoryRepository readingHistoryRepository;
    private final ChapterRepository chapterRepository;

    public ReadingService(
            ReadingPositionRepository readingPositionRepository,
            ReadingHistoryRepository readingHistoryRepository,
            ChapterRepository chapterRepository) {
        this.readingPositionRepository = readingPositionRepository;
        this.readingHistoryRepository = readingHistoryRepository;
        this.chapterRepository = chapterRepository;
    }

    public ReadingPosition getPosition(UUID userId, UUID novelId) {
        return readingPositionRepository
                .findByUserIdAndNovelId(userId, novelId)
                .orElseThrow(() -> new NotFoundException("読書位置が見つかりません: " + novelId));
    }

    @Transactional
    public ReadingPosition savePosition(UUID userId, UUID novelId, UUID chapterId, float scrollPosition) {
        Chapter chapter = chapterRepository
                .findById(chapterId)
                .orElseThrow(() -> new NotFoundException("話が見つかりません: " + chapterId));

        ReadingPosition position = readingPositionRepository
                .findByUserIdAndNovelId(userId, novelId)
                .orElseGet(() -> ReadingPosition.builder()
                        .userId(userId)
                        .novelId(novelId)
                        .build());

        position.setChapterId(chapterId);
        position.setLastReadChapterNo(chapter.getChapterNo());
        position.setScrollPosition(scrollPosition);
        position.setLastReadAt(Instant.now());
        return readingPositionRepository.save(position);
    }

    @Transactional
    public void recordHistory(UUID userId, UUID chapterId, Instant readAt, int durationSeconds) {
        readingHistoryRepository.save(ReadingHistory.builder()
                .userId(userId)
                .chapterId(chapterId)
                .readAt(readAt)
                .durationSeconds(durationSeconds)
                .build());
    }

    public List<ReadingHistory> recentHistory(UUID userId, int limit) {
        List<ReadingHistory> all = readingHistoryRepository.findByUserIdOrderByReadAtDesc(userId);
        return all.size() > limit ? all.subList(0, limit) : all;
    }

    public Map<UUID, Instant> lastReadAtByNovelIds(UUID userId, List<UUID> novelIds) {
        if (novelIds.isEmpty()) {
            return Map.of();
        }
        return readingPositionRepository.findByUserIdAndNovelIdIn(userId, novelIds).stream()
                .collect(Collectors.toMap(ReadingPosition::getNovelId, ReadingPosition::getLastReadAt));
    }
}
