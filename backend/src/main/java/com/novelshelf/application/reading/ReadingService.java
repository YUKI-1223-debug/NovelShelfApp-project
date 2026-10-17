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
import java.util.Optional;
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

    /**
     * 読書位置を保存する。
     *
     * <p>{@code clientUpdatedAt}(端末でその位置を読んだ時刻)があるときは、保存済みの位置より古ければ保存せず、
     * 今の位置をそのまま返す。オフライン中に端末に溜めた古い位置が、別の端末で読み進めた新しい位置を
     * 上書きしないようにするため(個人利用アプリ化 フェーズ2 設計書 §7-2)。保存する時刻も端末の時刻にする
     * (サーバーで受け取った時刻にすると、後から届いた「もっと新しい」オフラインの位置が逆に負けるため)。
     * 端末の時計が進んでいても未来の時刻にはしない。{@code clientUpdatedAt} を送らない古いアプリからの
     * 書き込みは、従来どおり受け取った時刻で上書きする。
     */
    @Transactional
    public ReadingPosition savePosition(
            UUID userId, UUID novelId, UUID chapterId, float scrollPosition, Instant clientUpdatedAt) {
        Chapter chapter = chapterRepository
                .findById(chapterId)
                .orElseThrow(() -> new NotFoundException("話が見つかりません: " + chapterId));

        Optional<ReadingPosition> existing = readingPositionRepository.findByUserIdAndNovelId(userId, novelId);
        if (clientUpdatedAt != null
                && existing.isPresent()
                && clientUpdatedAt.isBefore(existing.get().getLastReadAt())) {
            return existing.get();
        }

        ReadingPosition position = existing.orElseGet(() -> ReadingPosition.builder()
                .userId(userId)
                .novelId(novelId)
                .build());

        Instant now = Instant.now();
        position.setChapterId(chapterId);
        position.setLastReadChapterNo(chapter.getChapterNo());
        position.setScrollPosition(scrollPosition);
        position.setLastReadAt(clientUpdatedAt != null && clientUpdatedAt.isBefore(now) ? clientUpdatedAt : now);
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
