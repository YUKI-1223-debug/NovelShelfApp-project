package com.novelshelf.application.auth;

import com.novelshelf.domain.user.*;
import com.novelshelf.infrastructure.security.JwtService;
import com.novelshelf.infrastructure.security.RefreshTokenGenerator;
import java.time.Instant;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final AuthCredentialRepository authCredentialRepository;
    private final UserSettingsRepository userSettingsRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenGenerator refreshTokenGenerator;

    public AuthService(
            UserRepository userRepository,
            AuthCredentialRepository authCredentialRepository,
            UserSettingsRepository userSettingsRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            RefreshTokenGenerator refreshTokenGenerator) {
        this.userRepository = userRepository;
        this.authCredentialRepository = authCredentialRepository;
        this.userSettingsRepository = userSettingsRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.refreshTokenGenerator = refreshTokenGenerator;
    }

    @Transactional
    public TokenPair signup(String email, String rawPassword, String displayName) {
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyExistsException(email);
        }

        User user = userRepository.save(
                User.builder().email(email).displayName(displayName).build());

        authCredentialRepository.save(AuthCredential.builder()
                .userId(user.getId())
                .provider(AuthProvider.EMAIL)
                .passwordHash(passwordEncoder.encode(rawPassword))
                .build());

        userSettingsRepository.save(
                UserSettings.builder().userId(user.getId()).build());

        return issueTokenPair(user.getId());
    }

    @Transactional
    public TokenPair login(String email, String rawPassword) {
        User user = userRepository.findByEmail(email).orElseThrow(InvalidCredentialsException::new);
        AuthCredential credential = authCredentialRepository
                .findByUserIdAndProvider(user.getId(), AuthProvider.EMAIL)
                .orElseThrow(InvalidCredentialsException::new);

        if (credential.getPasswordHash() == null
                || !passwordEncoder.matches(rawPassword, credential.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }

        return issueTokenPair(user.getId());
    }

    @Transactional
    public TokenPair refresh(String rawRefreshToken) {
        String hash = refreshTokenGenerator.hash(rawRefreshToken);
        RefreshToken existing =
                refreshTokenRepository.findByTokenHash(hash).orElseThrow(InvalidRefreshTokenException::new);

        if (existing.isRevoked() || existing.getExpiresAt().isBefore(Instant.now())) {
            throw new InvalidRefreshTokenException();
        }

        existing.setRevoked(true);
        refreshTokenRepository.save(existing);

        return issueTokenPair(existing.getUserId());
    }

    @Transactional
    public void logoutAll(UUID userId) {
        refreshTokenRepository.findByUserIdAndRevokedFalse(userId).forEach(t -> t.setRevoked(true));
    }

    private TokenPair issueTokenPair(UUID userId) {
        String accessToken = jwtService.generateAccessToken(userId);
        String rawRefreshToken = refreshTokenGenerator.generate();

        refreshTokenRepository.save(RefreshToken.builder()
                .userId(userId)
                .tokenHash(refreshTokenGenerator.hash(rawRefreshToken))
                .expiresAt(Instant.now().plus(jwtService.refreshTokenTtl()))
                .build());

        return new TokenPair(accessToken, rawRefreshToken, jwtService.accessTokenTtlSeconds());
    }
}
