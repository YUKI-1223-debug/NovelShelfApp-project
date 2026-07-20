package com.novelshelf.domain.user;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "user_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, unique = true)
    private UUID userId;

    @Column(name = "dark_mode", nullable = false)
    @Builder.Default
    private boolean darkMode = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "writing_mode", nullable = false, length = 20)
    @Builder.Default
    private WritingMode writingMode = WritingMode.VERTICAL;

    @Enumerated(EnumType.STRING)
    @Column(name = "font_family", nullable = false, length = 20)
    @Builder.Default
    private FontFamily fontFamily = FontFamily.MINCHO;

    @Column(name = "font_size", nullable = false)
    @Builder.Default
    private int fontSize = 16;

    @Column(name = "line_height", nullable = false)
    @Builder.Default
    private float lineHeight = 1.8f;

    @Column(name = "margin_size", nullable = false, length = 20)
    @Builder.Default
    private String marginSize = "MEDIUM";

    @Column(name = "background_color", nullable = false, length = 20)
    @Builder.Default
    private String backgroundColor = "DEFAULT";

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String theme = "DEFAULT";

    @Enumerated(EnumType.STRING)
    @Column(name = "page_mode", nullable = false, length = 20)
    @Builder.Default
    private PageMode pageMode = PageMode.SCROLL;

    @Column(name = "shelf_sort_order", nullable = false, length = 20)
    @Builder.Default
    private String shelfSortOrder = "ADDED_DESC";

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
