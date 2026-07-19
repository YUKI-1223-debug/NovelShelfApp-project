package com.novelshelf.domain.reading;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReadingHistoryRepository extends JpaRepository<ReadingHistory, UUID> {
    List<ReadingHistory> findByUserIdOrderByReadAtDesc(UUID userId);

    List<ReadingHistory> findByUserIdAndReadAtBetween(UUID userId, Instant from, Instant to);

    @Query("SELECT COALESCE(SUM(h.durationSeconds), 0) FROM ReadingHistory h WHERE h.userId = :userId")
    long sumDurationSecondsByUserId(@Param("userId") UUID userId);

    @Query("SELECT COUNT(DISTINCT h.chapterId) FROM ReadingHistory h WHERE h.userId = :userId")
    long countDistinctChaptersByUserId(@Param("userId") UUID userId);
}
