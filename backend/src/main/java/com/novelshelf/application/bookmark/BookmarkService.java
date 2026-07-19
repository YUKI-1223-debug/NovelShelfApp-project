package com.novelshelf.application.bookmark;

import com.novelshelf.application.shelf.TagService;
import com.novelshelf.domain.bookmark.Bookmark;
import com.novelshelf.domain.bookmark.BookmarkRepository;
import com.novelshelf.domain.common.NotFoundException;
import com.novelshelf.domain.shelf.Tag;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookmarkService {

    private final BookmarkRepository bookmarkRepository;
    private final TagService tagService;

    public BookmarkService(BookmarkRepository bookmarkRepository, TagService tagService) {
        this.bookmarkRepository = bookmarkRepository;
        this.tagService = tagService;
    }

    public List<Bookmark> list(UUID userId, UUID novelId, String tagName) {
        if (novelId != null) {
            return bookmarkRepository.findByUserIdAndNovelId(userId, novelId);
        }
        if (tagName != null && !tagName.isBlank()) {
            return bookmarkRepository.findByUserIdAndTagName(userId, tagName);
        }
        return bookmarkRepository.findByUserId(userId);
    }

    @Transactional
    public Bookmark create(
            UUID userId, UUID chapterId, String name, String memo, float scrollPosition, List<UUID> tagIds) {
        Bookmark bookmark = Bookmark.builder()
                .userId(userId)
                .chapterId(chapterId)
                .name(name)
                .memo(memo)
                .scrollPosition(scrollPosition)
                .build();
        if (tagIds != null && !tagIds.isEmpty()) {
            bookmark.setTags(new HashSet<>(tagService.resolveByIds(userId, tagIds)));
        }
        return bookmarkRepository.save(bookmark);
    }

    @Transactional
    public Bookmark update(
            UUID bookmarkId, UUID userId, String name, String memo, Float scrollPosition, List<UUID> tagIds) {
        Bookmark bookmark = getOwned(bookmarkId, userId);
        if (name != null) {
            bookmark.setName(name);
        }
        if (memo != null) {
            bookmark.setMemo(memo);
        }
        if (scrollPosition != null) {
            bookmark.setScrollPosition(scrollPosition);
        }
        if (tagIds != null) {
            List<Tag> tags = tagService.resolveByIds(userId, tagIds);
            bookmark.setTags(new HashSet<>(tags));
        }
        return bookmarkRepository.save(bookmark);
    }

    @Transactional
    public void delete(UUID bookmarkId, UUID userId) {
        bookmarkRepository.delete(getOwned(bookmarkId, userId));
    }

    private Bookmark getOwned(UUID bookmarkId, UUID userId) {
        return bookmarkRepository
                .findByIdAndUserId(bookmarkId, userId)
                .orElseThrow(() -> new NotFoundException("しおりが見つかりません: " + bookmarkId));
    }
}
