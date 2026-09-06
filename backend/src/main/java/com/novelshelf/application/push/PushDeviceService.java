package com.novelshelf.application.push;

import com.novelshelf.domain.push.PushDeviceToken;
import com.novelshelf.domain.push.PushDeviceTokenRepository;
import com.novelshelf.domain.push.PushPlatform;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** デバイストークンの登録・更新・解除。 */
@Service
public class PushDeviceService {

    private final PushDeviceTokenRepository repository;

    public PushDeviceService(PushDeviceTokenRepository repository) {
        this.repository = repository;
    }

    /**
     * トークンを登録する。既存トークンなら所有ユーザー・種別・最終確認時刻を更新する
     * （端末が別アカウントでログインし直した場合に持ち主を付け替える）。
     */
    @Transactional
    public void register(UUID userId, PushPlatform platform, String token) {
        PushDeviceToken entity = repository
                .findByToken(token)
                .map(existing -> {
                    existing.setUserId(userId);
                    existing.setPlatform(platform);
                    existing.setLastSeenAt(Instant.now());
                    return existing;
                })
                .orElseGet(() -> PushDeviceToken.builder()
                        .userId(userId)
                        .platform(platform)
                        .token(token)
                        .build());
        repository.save(entity);
    }

    /** 指定トークンを解除する（そのトークンが別ユーザーのものでも消えるが、値は端末固有なので実害はない）。 */
    @Transactional
    public void unregister(String token) {
        repository.deleteByToken(token);
    }

    @Transactional(readOnly = true)
    public List<PushDeviceToken> tokensForUsers(List<UUID> userIds) {
        if (userIds.isEmpty()) {
            return List.of();
        }
        return repository.findByUserIdIn(userIds);
    }

    @Transactional
    public void deleteTokens(List<String> tokens) {
        if (!tokens.isEmpty()) {
            repository.deleteByTokenIn(tokens);
        }
    }
}
