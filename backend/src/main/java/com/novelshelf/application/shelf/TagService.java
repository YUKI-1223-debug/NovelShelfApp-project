package com.novelshelf.application.shelf;

import com.novelshelf.domain.shelf.Tag;
import com.novelshelf.domain.shelf.TagRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TagService {

    private final TagRepository tagRepository;

    public TagService(TagRepository tagRepository) {
        this.tagRepository = tagRepository;
    }

    public List<Tag> listByUser(UUID userId) {
        return tagRepository.findByUserId(userId);
    }

    @Transactional
    public Tag getOrCreate(UUID userId, String name) {
        return tagRepository
                .findByUserIdAndName(userId, name)
                .orElseGet(() -> tagRepository.save(
                        Tag.builder().userId(userId).name(name).build()));
    }

    public List<Tag> resolveByIds(UUID userId, List<UUID> tagIds) {
        if (tagIds == null || tagIds.isEmpty()) {
            return List.of();
        }
        return tagRepository.findByIdInAndUserId(tagIds, userId);
    }
}
