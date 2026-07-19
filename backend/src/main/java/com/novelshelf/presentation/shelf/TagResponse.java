package com.novelshelf.presentation.shelf;

import com.novelshelf.domain.shelf.Tag;
import java.util.UUID;

public record TagResponse(UUID id, String name) {
    public static TagResponse from(Tag tag) {
        return new TagResponse(tag.getId(), tag.getName());
    }
}
