package com.novelshelf.presentation.shelf;

import com.novelshelf.domain.shelf.ShelfStatus;
import com.novelshelf.presentation.novel.NovelResponse;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record BookshelfEntryResponse(
        UUID id, NovelResponse novel, ShelfStatus status, boolean isFavorite, List<TagResponse> tags, Instant addedAt) {}
