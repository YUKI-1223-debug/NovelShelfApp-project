package com.novelshelf.domain.reading;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReadingPositionRepository extends JpaRepository<ReadingPosition, UUID> {
    Optional<ReadingPosition> findByUserIdAndNovelId(UUID userId, UUID novelId);
}
