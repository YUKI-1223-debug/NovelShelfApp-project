package com.novelshelf.application.offline;

import com.novelshelf.domain.offline.OfflineSavePreference;
import com.novelshelf.domain.offline.OfflineSavePreferenceRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OfflineService {

    private final OfflineSavePreferenceRepository repository;

    public OfflineService(OfflineSavePreferenceRepository repository) {
        this.repository = repository;
    }

    public List<OfflineSavePreference> list(UUID userId) {
        return repository.findByUserId(userId);
    }

    @Transactional
    public OfflineSavePreference add(UUID userId, UUID chapterId) {
        return repository
                .findByUserIdAndChapterId(userId, chapterId)
                .orElseGet(() -> repository.save(OfflineSavePreference.builder()
                        .userId(userId)
                        .chapterId(chapterId)
                        .build()));
    }

    @Transactional
    public void remove(UUID userId, UUID chapterId) {
        repository.deleteByUserIdAndChapterId(userId, chapterId);
    }
}
