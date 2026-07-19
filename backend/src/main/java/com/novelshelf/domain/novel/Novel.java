package com.novelshelf.domain.novel;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "novels")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Novel {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "site_id", nullable = false)
    private UUID siteId;

    @Column(name = "author_id", nullable = false)
    private UUID authorId;

    @Column(name = "series_id")
    private UUID seriesId;

    @Column(name = "external_novel_id", nullable = false)
    private String externalNovelId;

    @Column(nullable = false, length = 500)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String synopsis;

    @Column(length = 50)
    private String genre;

    @Column(name = "cover_url")
    private String coverUrl;

    @Column(name = "source_url", nullable = false)
    private String sourceUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private NovelStatus status = NovelStatus.ONGOING;

    @Column(name = "latest_known_chapter_no", nullable = false)
    @Builder.Default
    private int latestKnownChapterNo = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
