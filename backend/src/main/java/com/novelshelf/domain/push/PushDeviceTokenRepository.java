package com.novelshelf.domain.push;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PushDeviceTokenRepository extends JpaRepository<PushDeviceToken, UUID> {

    Optional<PushDeviceToken> findByToken(String token);

    List<PushDeviceToken> findByUserId(UUID userId);

    List<PushDeviceToken> findByUserIdIn(List<UUID> userIds);

    void deleteByToken(String token);

    void deleteByTokenIn(List<String> tokens);
}
