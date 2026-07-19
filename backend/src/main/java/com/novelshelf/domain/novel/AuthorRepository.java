package com.novelshelf.domain.novel;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthorRepository extends JpaRepository<Author, UUID> {
    Optional<Author> findBySiteIdAndExternalAuthorId(UUID siteId, String externalAuthorId);

    List<Author> findByNameContainingIgnoreCase(String name);
}
