package com.novelshelf.infrastructure.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TailnetRequestMatcherTest {

    private final TailnetRequestMatcher matcher =
            new TailnetRequestMatcher(List.of("100.64.0.0/10", "fd7a:115c:a1e0::/48"));

    private MockHttpServletRequest requestWithXff(String xff) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        if (xff != null) {
            request.addHeader("X-Forwarded-For", xff);
        }
        return request;
    }

    @Test
    void tailnetIpv4Matches() {
        assertThat(matcher.matches(requestWithXff("100.77.231.65"))).isTrue();
    }

    @Test
    void tailnetIpv6Matches() {
        assertThat(matcher.matches(requestWithXff("fd7a:115c:a1e0::1234"))).isTrue();
    }

    @Test
    void cidrBoundaries() {
        assertThat(matcher.isTailnetAddress("100.64.0.0")).isTrue();
        assertThat(matcher.isTailnetAddress("100.127.255.255")).isTrue();
        assertThat(matcher.isTailnetAddress("100.63.255.255")).isFalse();
        assertThat(matcher.isTailnetAddress("100.128.0.0")).isFalse();
        assertThat(matcher.isTailnetAddress("fd7a:115c:a1e1::1")).isFalse();
    }

    @Test
    void nonTailnetDoesNotMatch() {
        assertThat(matcher.matches(requestWithXff("172.18.0.5"))).isFalse();
        assertThat(matcher.matches(requestWithXff("203.0.113.10"))).isFalse();
    }

    @Test
    void missingHeaderDoesNotMatch() {
        assertThat(matcher.matches(requestWithXff(null))).isFalse();
        assertThat(matcher.matches(requestWithXff(""))).isFalse();
    }

    @Test
    void onlyRightmostHopIsTrusted() {
        // クライアントが偽の 100.x を先頭に入れ、プロキシが本当の接続元を右に付け足した形
        assertThat(matcher.matches(requestWithXff("100.100.100.100, 172.18.0.5"))).isFalse();
        assertThat(matcher.matches(requestWithXff("203.0.113.10, 100.77.231.65"))).isTrue();
    }

    @Test
    void hostnamesAreRejectedWithoutDnsLookup() {
        assertThat(matcher.matches(requestWithXff("minipc.tail0347f4.ts.net"))).isFalse();
        assertThat(matcher.matches(requestWithXff("localhost"))).isFalse();
    }
}
