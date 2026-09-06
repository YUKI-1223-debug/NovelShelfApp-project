package com.novelshelf.domain.shelf;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BookshelfEntryRepository extends JpaRepository<BookshelfEntry, UUID> {

    @Query("SELECT DISTINCT e FROM BookshelfEntry e LEFT JOIN FETCH e.tags WHERE e.userId = :userId")
    List<BookshelfEntry> findByUserId(@Param("userId") UUID userId);

    @Query("SELECT DISTINCT e FROM BookshelfEntry e LEFT JOIN FETCH e.tags WHERE e.userId = :userId AND e.status = :status")
    List<BookshelfEntry> findByUserIdAndStatus(@Param("userId") UUID userId, @Param("status") ShelfStatus status);

    @Query("SELECT DISTINCT e FROM BookshelfEntry e LEFT JOIN FETCH e.tags WHERE e.userId = :userId AND e.favorite = :favorite")
    List<BookshelfEntry> findByUserIdAndFavorite(@Param("userId") UUID userId, @Param("favorite") boolean favorite);

    @Query("SELECT e FROM BookshelfEntry e LEFT JOIN FETCH e.tags WHERE e.id = :id AND e.userId = :userId")
    Optional<BookshelfEntry> findByIdAndUserId(@Param("id") UUID id, @Param("userId") UUID userId);

    @Query("SELECT e FROM BookshelfEntry e LEFT JOIN FETCH e.tags WHERE e.userId = :userId AND e.novelId = :novelId")
    Optional<BookshelfEntry> findByUserIdAndNovelId(@Param("userId") UUID userId, @Param("novelId") UUID novelId);

    long countByUserIdAndStatus(UUID userId, ShelfStatus status);

    @Query("""
        SELECT e.novelId FROM BookshelfEntry e JOIN e.tags t
        WHERE e.userId = :userId AND t.name = :tagName
        """)
    List<UUID> findNovelIdsByUserIdAndTagName(@Param("userId") UUID userId, @Param("tagName") String tagName);

    /** いずれかのユーザーの本棚に入っている作品ID（更新チェックの対象集合）。 */
    @Query("SELECT DISTINCT e.novelId FROM BookshelfEntry e")
    List<UUID> findDistinctNovelIds();

    /** その作品を本棚に持つユーザーID。 */
    @Query("SELECT e.userId FROM BookshelfEntry e WHERE e.novelId = :novelId")
    List<UUID> findUserIdsByNovelId(@Param("novelId") UUID novelId);
}
