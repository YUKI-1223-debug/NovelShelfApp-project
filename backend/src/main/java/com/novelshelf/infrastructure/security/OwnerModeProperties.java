package com.novelshelf.infrastructure.security;

import java.util.List;
import java.util.UUID;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * オーナー固定モードの設定(個人利用アプリ化 フェーズ2 設計書 §4)。
 *
 * @param enabled 有効にするか(OWNER_MODE_ENABLED、既定 false)
 * @param userId オーナーとして扱う users.id(OWNER_USER_ID)
 * @param tailnetCidrs tailnet とみなす CIDR(TAILNET_CIDRS)
 */
@ConfigurationProperties(prefix = "novelshelf.owner-mode")
public record OwnerModeProperties(boolean enabled, UUID userId, List<String> tailnetCidrs) {

    public OwnerModeProperties {
        if (tailnetCidrs == null || tailnetCidrs.isEmpty()) {
            tailnetCidrs = List.of("100.64.0.0/10", "fd7a:115c:a1e0::/48");
        }
    }
}
