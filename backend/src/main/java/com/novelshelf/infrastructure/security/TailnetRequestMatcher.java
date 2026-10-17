package com.novelshelf.infrastructure.security;

import jakarta.servlet.http.HttpServletRequest;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.List;

/**
 * リクエストが tailnet(Tailscale)由来かを判定する(個人利用アプリ化 フェーズ2 設計書 §3-2)。
 *
 * <p>ミニPCでは {@code tailscale serve} が接続元端末の tailnet IP を X-Forwarded-For に入れて 127.0.0.1 の
 * backend へ渡す。判定には X-Forwarded-For の「一番右の値」(直前のプロキシが付けた値)だけを使う。
 * 左側の値はクライアントが自由に書けるため、偽の 100.x を先頭に入れても通らない。
 * 公開側(cloudflared → 共有 Caddy)では、Caddy が直前の接続元(cloudflared の 172.x)を右端に付ける。
 */
public class TailnetRequestMatcher {

    private final List<Cidr> cidrs;

    public TailnetRequestMatcher(List<String> cidrs) {
        this.cidrs = cidrs.stream()
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(Cidr::parse)
                .toList();
    }

    public boolean matches(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff == null || xff.isBlank()) {
            return false;
        }
        String[] hops = xff.split(",");
        String nearest = hops[hops.length - 1].trim();
        return isTailnetAddress(nearest);
    }

    boolean isTailnetAddress(String ip) {
        // ホスト名を渡されたときに DNS を引かないよう、数字と区切り文字だけの値に限る
        if (ip.isEmpty() || !ip.matches("[0-9a-fA-F:.]+")) {
            return false;
        }
        byte[] addr;
        try {
            addr = InetAddress.getByName(ip).getAddress();
        } catch (UnknownHostException e) {
            return false;
        }
        return cidrs.stream().anyMatch(c -> c.contains(addr));
    }

    record Cidr(byte[] network, int prefix) {

        static Cidr parse(String cidr) {
            String[] parts = cidr.split("/");
            if (parts.length != 2) {
                throw new IllegalArgumentException("CIDR の形式が不正です: " + cidr);
            }
            try {
                return new Cidr(InetAddress.getByName(parts[0]).getAddress(), Integer.parseInt(parts[1]));
            } catch (UnknownHostException | NumberFormatException e) {
                throw new IllegalArgumentException("CIDR の形式が不正です: " + cidr, e);
            }
        }

        boolean contains(byte[] addr) {
            if (addr.length != network.length) {
                return false;
            }
            int fullBytes = prefix / 8;
            for (int i = 0; i < fullBytes; i++) {
                if (addr[i] != network[i]) {
                    return false;
                }
            }
            int remainingBits = prefix % 8;
            if (remainingBits == 0) {
                return true;
            }
            int mask = (0xFF << (8 - remainingBits)) & 0xFF;
            return (addr[fullBytes] & mask) == (network[fullBytes] & mask);
        }
    }
}
