package com.novelshelf.infrastructure.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * JwtAuthenticationFilter の後ろで動き、条件を満たすリクエストをオーナーとして認証する(OwnerModeService 参照)。
 *
 * <p>条件: まだ認証されていない ＋ Authorization ヘッダが無い ＋ tailnet 由来。
 * Authorization ヘッダがあるときは JWT の結果に任せる(移行期間中、旧アプリのトークンもそのまま通すため)。
 * principal は JWT のときと同じく users.id の UUID(コントローラーは {@code @AuthenticationPrincipal UUID})。
 *
 * <p>Spring Boot が @Component の Filter をサーブレットフィルタとしても自動登録しないよう、
 * Bean にはせず SecurityConfig で new して Security のフィルタチェーンにだけ入れる。
 */
public class OwnerModeFilter extends OncePerRequestFilter {

    private final OwnerModeService ownerModeService;

    public OwnerModeFilter(OwnerModeService ownerModeService) {
        this.ownerModeService = ownerModeService;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (ownerModeService.isEnabled()
                && SecurityContextHolder.getContext().getAuthentication() == null
                && request.getHeader(HttpHeaders.AUTHORIZATION) == null
                && ownerModeService.tailnetMatcher().matches(request)) {
            ownerModeService.ownerUserId().ifPresent(userId -> {
                var authentication = new UsernamePasswordAuthenticationToken(
                        userId, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            });
        }
        filterChain.doFilter(request, response);
    }
}
