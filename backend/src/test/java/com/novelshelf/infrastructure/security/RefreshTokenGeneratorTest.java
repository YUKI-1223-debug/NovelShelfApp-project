package com.novelshelf.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class RefreshTokenGeneratorTest {

    private final RefreshTokenGenerator generator = new RefreshTokenGenerator();

    @Test
    void generate_producesUniqueTokens() {
        String a = generator.generate();
        String b = generator.generate();

        assertThat(a).isNotEqualTo(b);
        assertThat(a).hasSizeGreaterThan(32);
    }

    @Test
    void hash_isDeterministicForSameInput() {
        String token = generator.generate();

        assertThat(generator.hash(token)).isEqualTo(generator.hash(token));
    }

    @Test
    void hash_differsForDifferentInputs() {
        assertThat(generator.hash(generator.generate())).isNotEqualTo(generator.hash(generator.generate()));
    }

    @Test
    void hash_doesNotContainRawToken() {
        String token = generator.generate();

        assertThat(generator.hash(token)).isNotEqualTo(token).doesNotContain(token);
    }
}
