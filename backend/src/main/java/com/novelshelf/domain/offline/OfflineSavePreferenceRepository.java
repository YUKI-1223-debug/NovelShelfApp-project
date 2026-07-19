package com.novelshelf.domain.offline;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OfflineSavePreferenceRepository extends JpaRepository<OfflineSavePreference, UUID> {
    List<OfflineSavePreference> findByUserId(UUID userId);

    Optional<OfflineSavePreference> findByUserIdAndChapterId(UUID userId, UUID chapterId);

    void deleteByUserIdAndChapterId(UUID userId, UUID chapterId);
}
