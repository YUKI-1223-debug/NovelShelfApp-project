package com.novelshelf.domain.novel;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeriesRepository extends JpaRepository<Series, UUID> {
}
