package com.novelshelf.application.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.novelshelf.domain.user.*;
import com.novelshelf.infrastructure.mail.MailProperties;
import com.novelshelf.infrastructure.security.RefreshTokenGenerator;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private AuthCredentialRepository authCredentialRepository;

    @Mock
    private PasswordResetTokenRepository tokenRepository;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JavaMailSender mailSender;

    // 実物を使い、生トークンとハッシュの整合性をそのまま検証できるようにする。
    private final RefreshTokenGenerator tokenGenerator = new RefreshTokenGenerator();
    private final MailProperties mailProperties = new MailProperties("no-reply@novelshelf.jp", 30, "https://novelshelf.jp");

    private PasswordResetService service;

    @BeforeEach
    void setUp() {
        service = new PasswordResetService(
                userRepository,
                authCredentialRepository,
                tokenRepository,
                refreshTokenRepository,
                tokenGenerator,
                passwordEncoder,
                mailProperties,
                mailSender);
    }

    @Test
    void requestReset_existingUser_savesTokenAndSendsEmailContainingIt() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).email("reader@example.com").displayName("reader").build();
        when(userRepository.findByEmail("reader@example.com")).thenReturn(Optional.of(user));

        service.requestReset("reader@example.com");

        ArgumentCaptor<PasswordResetToken> tokenCaptor = ArgumentCaptor.forClass(PasswordResetToken.class);
        verify(tokenRepository).save(tokenCaptor.capture());
        PasswordResetToken saved = tokenCaptor.getValue();
        assertThat(saved.getUserId()).isEqualTo(userId);
        assertThat(saved.isUsed()).isFalse();
        assertThat(saved.getExpiresAt()).isAfter(Instant.now());

        ArgumentCaptor<SimpleMailMessage> mailCaptor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(mailCaptor.capture());
        SimpleMailMessage sent = mailCaptor.getValue();
        assertThat(sent.getTo()).containsExactly("reader@example.com");
        assertThat(sent.getText()).contains("https://novelshelf.jp/reset-password?token=");
    }

    @Test
    void requestReset_unknownEmail_doesNothingSilently() {
        when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());

        service.requestReset("nobody@example.com");

        verifyNoInteractions(tokenRepository, mailSender);
    }

    @Test
    void confirmReset_validToken_updatesPasswordAndRevokesSessions() {
        UUID userId = UUID.randomUUID();
        String rawToken = tokenGenerator.generate();
        PasswordResetToken storedToken = PasswordResetToken.builder()
                .userId(userId)
                .tokenHash(tokenGenerator.hash(rawToken))
                .expiresAt(Instant.now().plusSeconds(600))
                .used(false)
                .build();
        when(tokenRepository.findByTokenHash(tokenGenerator.hash(rawToken))).thenReturn(Optional.of(storedToken));
        AuthCredential credential = AuthCredential.builder().userId(userId).provider(AuthProvider.EMAIL).build();
        when(authCredentialRepository.findByUserIdAndProvider(userId, AuthProvider.EMAIL))
                .thenReturn(Optional.of(credential));
        when(passwordEncoder.encode("newpassword123")).thenReturn("hashed");
        RefreshToken activeSession =
                RefreshToken.builder().userId(userId).tokenHash("x").expiresAt(Instant.now().plusSeconds(60)).build();
        when(refreshTokenRepository.findByUserIdAndRevokedFalse(userId)).thenReturn(java.util.List.of(activeSession));

        service.confirmReset(rawToken, "newpassword123");

        assertThat(storedToken.isUsed()).isTrue();
        assertThat(credential.getPasswordHash()).isEqualTo("hashed");
        assertThat(activeSession.isRevoked()).isTrue();
    }

    @Test
    void confirmReset_expiredToken_throws() {
        UUID userId = UUID.randomUUID();
        String rawToken = tokenGenerator.generate();
        PasswordResetToken expired = PasswordResetToken.builder()
                .userId(userId)
                .tokenHash(tokenGenerator.hash(rawToken))
                .expiresAt(Instant.now().minusSeconds(1))
                .used(false)
                .build();
        when(tokenRepository.findByTokenHash(tokenGenerator.hash(rawToken))).thenReturn(Optional.of(expired));

        assertThatThrownBy(() -> service.confirmReset(rawToken, "newpassword123"))
                .isInstanceOf(InvalidPasswordResetTokenException.class);
        verify(authCredentialRepository, never()).save(any());
    }

    @Test
    void confirmReset_alreadyUsedToken_throws() {
        UUID userId = UUID.randomUUID();
        String rawToken = tokenGenerator.generate();
        PasswordResetToken used = PasswordResetToken.builder()
                .userId(userId)
                .tokenHash(tokenGenerator.hash(rawToken))
                .expiresAt(Instant.now().plusSeconds(600))
                .used(true)
                .build();
        when(tokenRepository.findByTokenHash(tokenGenerator.hash(rawToken))).thenReturn(Optional.of(used));

        assertThatThrownBy(() -> service.confirmReset(rawToken, "newpassword123"))
                .isInstanceOf(InvalidPasswordResetTokenException.class);
    }

    @Test
    void confirmReset_unknownToken_throws() {
        when(tokenRepository.findByTokenHash(any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.confirmReset("bogus-token", "newpassword123"))
                .isInstanceOf(InvalidPasswordResetTokenException.class);
    }
}
