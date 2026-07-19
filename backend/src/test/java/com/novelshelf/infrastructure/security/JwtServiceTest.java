package com.novelshelf.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

    private final JwtProperties properties =
            new JwtProperties("test-secret-key-at-least-32-bytes-long!!", 30, 30);
    private final JwtService jwtService = new JwtService(properties);

    @Test
    void generateAccessToken_roundTripsUserId() {
        UUID userId = UUID.randomUUID();
        String token = jwtService.generateAccessToken(userId);

        Optional<UUID> extracted = jwtService.extractUserId(token);

        assertThat(extracted).contains(userId);
    }

    @Test
    void extractUserId_returnsEmpty_forGarbageToken() {
        assertThat(jwtService.extractUserId("not-a-real-token")).isEmpty();
    }

    @Test
    void extractUserId_returnsEmpty_whenSignedWithDifferentSecret() {
        JwtService otherService =
                new JwtService(new JwtProperties("a-completely-different-secret-key-32bytes!", 30, 30));
        String token = otherService.generateAccessToken(UUID.randomUUID());

        assertThat(jwtService.extractUserId(token)).isEmpty();
    }

    @Test
    void accessTokenTtlSeconds_matchesConfiguredMinutes() {
        assertThat(jwtService.accessTokenTtlSeconds()).isEqualTo(30 * 60);
    }
}
