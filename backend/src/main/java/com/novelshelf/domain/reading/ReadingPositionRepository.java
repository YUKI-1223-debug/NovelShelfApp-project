package com.novelshelf.domain.reading;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReadingPositionRepository extends JpaRepository<ReadingPosition, UUID> {
    Optional<ReadingPosition> findByUserIdAndNovelId(UUID userId, UUID novelId);

    List<ReadingPosition> findByUserIdAndNovelIdIn(UUID userId, List<UUID> novelIds);
}
