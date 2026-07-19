package com.novelshelf.domain.novel;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SiteRepository extends JpaRepository<Site, UUID> {
    Optional<Site> findByCode(SiteCode code);
}
