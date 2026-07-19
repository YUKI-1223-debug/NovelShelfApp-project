package com.novelshelf.domain.novel;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChapterRepository extends JpaRepository<Chapter, UUID> {
    List<Chapter> findByNovelIdOrderByChapterNoAsc(UUID novelId);

    Optional<Chapter> findByNovelIdAndExternalChapterId(UUID novelId, String externalChapterId);

    Optional<Chapter> findByNovelIdAndChapterNo(UUID novelId, int chapterNo);
}
