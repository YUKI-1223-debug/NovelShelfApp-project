package com.novelshelf.domain.reading;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "reading_positions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReadingPosition {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "novel_id", nullable = false)
    private UUID novelId;

    @Column(name = "chapter_id", nullable = false)
    private UUID chapterId;

    @Column(name = "last_read_chapter_no", nullable = false)
    private int lastReadChapterNo;

    @Column(name = "scroll_position", nullable = false)
    @Builder.Default
    private float scrollPosition = 0f;

    @Column(name = "last_read_at", nullable = false)
    @Builder.Default
    private Instant lastReadAt = Instant.now();
}
