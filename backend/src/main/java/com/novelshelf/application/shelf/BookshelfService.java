package com.novelshelf.application.shelf;

import com.novelshelf.domain.common.NotFoundException;
import com.novelshelf.domain.shelf.BookshelfEntry;
import com.novelshelf.domain.shelf.BookshelfEntryRepository;
import com.novelshelf.domain.shelf.ShelfStatus;
import com.novelshelf.domain.shelf.Tag;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookshelfService {

    private final BookshelfEntryRepository bookshelfEntryRepository;
    private final TagService tagService;

    public BookshelfService(BookshelfEntryRepository bookshelfEntryRepository, TagService tagService) {
        this.bookshelfEntryRepository = bookshelfEntryRepository;
        this.tagService = tagService;
    }

    public List<BookshelfEntry> list(UUID userId, ShelfStatus status, Boolean favorite) {
        if (status != null) {
            return bookshelfEntryRepository.findByUserIdAndStatus(userId, status);
        }
        if (favorite != null) {
            return bookshelfEntryRepository.findByUserIdAndFavorite(userId, favorite);
        }
        return bookshelfEntryRepository.findByUserId(userId);
    }

    @Transactional
    public BookshelfEntry addToShelf(UUID userId, UUID novelId, ShelfStatus status) {
        return bookshelfEntryRepository
                .findByUserIdAndNovelId(userId, novelId)
                .orElseGet(() -> bookshelfEntryRepository.save(BookshelfEntry.builder()
                        .userId(userId)
                        .novelId(novelId)
                        .status(status != null ? status : ShelfStatus.READING)
                        .build()));
    }

    @Transactional
    public BookshelfEntry update(UUID entryId, UUID userId, ShelfStatus status, Boolean favorite, List<UUID> tagIds) {
        BookshelfEntry entry = getOwned(entryId, userId);

        if (status != null) {
            entry.setStatus(status);
        }
        if (favorite != null) {
            entry.setFavorite(favorite);
        }
        if (tagIds != null) {
            List<Tag> tags = tagService.resolveByIds(userId, tagIds);
            entry.setTags(new HashSet<>(tags));
        }
        entry.setUpdatedAt(Instant.now());
        return bookshelfEntryRepository.save(entry);
    }

    @Transactional
    public void remove(UUID entryId, UUID userId) {
        BookshelfEntry entry = getOwned(entryId, userId);
        bookshelfEntryRepository.delete(entry);
    }

    private BookshelfEntry getOwned(UUID entryId, UUID userId) {
        return bookshelfEntryRepository
                .findByIdAndUserId(entryId, userId)
                .orElseThrow(() -> new NotFoundException("本棚エントリが見つかりません: " + entryId));
    }
}
