package com.novelshelf.domain.shelf;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TagRepository extends JpaRepository<Tag, UUID> {
    List<Tag> findByUserId(UUID userId);

    Optional<Tag> findByUserIdAndName(UUID userId, String name);

    List<Tag> findByIdInAndUserId(List<UUID> ids, UUID userId);
}
