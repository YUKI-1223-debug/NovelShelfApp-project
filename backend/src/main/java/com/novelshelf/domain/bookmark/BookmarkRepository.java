package com.novelshelf.domain.bookmark;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BookmarkRepository extends JpaRepository<Bookmark, UUID> {

    @Query("SELECT DISTINCT b FROM Bookmark b LEFT JOIN FETCH b.tags WHERE b.userId = :userId")
    List<Bookmark> findByUserId(@Param("userId") UUID userId);

    @Query("SELECT b FROM Bookmark b LEFT JOIN FETCH b.tags WHERE b.id = :id AND b.userId = :userId")
    Optional<Bookmark> findByIdAndUserId(@Param("id") UUID id, @Param("userId") UUID userId);

    @Query("""
        SELECT DISTINCT b FROM Bookmark b LEFT JOIN FETCH b.tags t
        WHERE b.userId = :userId AND t.name = :tagName
        """)
    List<Bookmark> findByUserIdAndTagName(@Param("userId") UUID userId, @Param("tagName") String tagName);

    @Query("""
        SELECT DISTINCT b FROM Bookmark b LEFT JOIN FETCH b.tags, com.novelshelf.domain.novel.Chapter c
        WHERE b.userId = :userId AND b.chapterId = c.id AND c.novelId = :novelId
        """)
    List<Bookmark> findByUserIdAndNovelId(@Param("userId") UUID userId, @Param("novelId") UUID novelId);
}
