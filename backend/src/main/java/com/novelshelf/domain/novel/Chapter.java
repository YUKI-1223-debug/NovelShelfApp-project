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
@Table(name = "chapters")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Chapter {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "novel_id", nullable = false)
    private UUID novelId;

    @Column(name = "external_chapter_id", nullable = false)
    private String externalChapterId;

    @Column(nullable = false, length = 500)
    private String title;

    @Column(name = "chapter_no", nullable = false)
    private int chapterNo;

    @Column(name = "source_url", nullable = false)
    private String sourceUrl;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
