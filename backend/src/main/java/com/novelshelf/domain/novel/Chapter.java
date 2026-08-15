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

    // サイト側で話が「章」単位にグループ分けされている場合の章題。章分けが無い作品・サイトではnull。
    @Column(name = "arc_title", length = 500)
    private String arcTitle;

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
