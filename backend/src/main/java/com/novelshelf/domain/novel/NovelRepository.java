package com.novelshelf.domain.novel;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NovelRepository extends JpaRepository<Novel, UUID> {
    Optional<Novel> findBySiteIdAndExternalNovelId(UUID siteId, String externalNovelId);

    @Query("""
        SELECT n FROM Novel n
        WHERE (:siteId IS NULL OR n.siteId = :siteId)
          AND (:genre IS NULL OR n.genre = :genre)
        ORDER BY n.updatedAt DESC
        """)
    List<Novel> findBySiteIdAndGenre(@Param("siteId") UUID siteId, @Param("genre") String genre);

    List<Novel> findByIdIn(List<UUID> ids);
}
