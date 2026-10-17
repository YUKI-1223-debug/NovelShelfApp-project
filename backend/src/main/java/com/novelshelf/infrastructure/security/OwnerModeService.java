package com.novelshelf.infrastructure.security;

import com.novelshelf.domain.user.UserRepository;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * オーナー固定モード(個人利用アプリ化 フェーズ2 設計書 §4)。
 *
 * <p>tailnet 由来で Authorization ヘッダの無いリクエストを、OWNER_USER_ID のユーザーとして扱う。
 * ログイン画面を廃止するための仕組みで、users テーブルと user_id の外部キーはそのまま使う。
 * OWNER_USER_ID が DB に存在しないときは、起動時に無効化してエラーログを出す
 * (設定ミスで別のユーザーとして動いたり、全リクエストが通ったりしないようにする)。
 */
@Component
public class OwnerModeService {

    private static final Logger log = LoggerFactory.getLogger(OwnerModeService.class);

    private final UserRepository userRepository;
    private final UUID ownerUserId;
    private final TailnetRequestMatcher tailnetMatcher;
    private volatile boolean enabled;

    public OwnerModeService(UserRepository userRepository, OwnerModeProperties properties) {
        this.userRepository = userRepository;
        this.ownerUserId = properties.userId();
        this.tailnetMatcher = new TailnetRequestMatcher(properties.tailnetCidrs());
        this.enabled = properties.enabled();
        if (enabled && ownerUserId == null) {
            log.error("オーナー固定モード: OWNER_USER_ID が未設定のため無効化します");
            this.enabled = false;
        }
    }

    @EventListener(ApplicationReadyEvent.class)
    void verifyOwnerExists() {
        if (!enabled) {
            log.info("オーナー固定モード: 無効");
            return;
        }
        if (userRepository.existsById(ownerUserId)) {
            log.info("オーナー固定モード: 有効 (userId={})", ownerUserId);
        } else {
            log.error("オーナー固定モード: OWNER_USER_ID={} のユーザーが存在しないため無効化します", ownerUserId);
            enabled = false;
        }
    }

    public boolean isEnabled() {
        return enabled;
    }

    public TailnetRequestMatcher tailnetMatcher() {
        return tailnetMatcher;
    }

    /** オーナーの users.id。無効化されているときは空。 */
    public Optional<UUID> ownerUserId() {
        return enabled ? Optional.of(ownerUserId) : Optional.empty();
    }
}
