package com.novelshelf.application.auth;

import com.novelshelf.domain.user.*;
import com.novelshelf.infrastructure.mail.MailProperties;
import com.novelshelf.infrastructure.security.RefreshTokenGenerator;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * メール+パスワード認証のパスワードリセット機能。SMTP接続情報は{@code novelshelf.mail}配下の環境変数で
 * 設定する（Gmail SMTP/SendGrid/ConoHaメール等、プロバイダを問わずSMTPプロトコルで送信できるものであれば
 * コード変更不要。docs/DECISIONS.md参照）。
 */
@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);

    private final UserRepository userRepository;
    private final AuthCredentialRepository authCredentialRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final RefreshTokenGenerator tokenGenerator;
    private final PasswordEncoder passwordEncoder;
    private final MailProperties mailProperties;
    private final JavaMailSender mailSender;

    public PasswordResetService(
            UserRepository userRepository,
            AuthCredentialRepository authCredentialRepository,
            PasswordResetTokenRepository tokenRepository,
            RefreshTokenRepository refreshTokenRepository,
            RefreshTokenGenerator tokenGenerator,
            PasswordEncoder passwordEncoder,
            MailProperties mailProperties,
            JavaMailSender mailSender) {
        this.userRepository = userRepository;
        this.authCredentialRepository = authCredentialRepository;
        this.tokenRepository = tokenRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.tokenGenerator = tokenGenerator;
        this.passwordEncoder = passwordEncoder;
        this.mailProperties = mailProperties;
        this.mailSender = mailSender;
    }

    /**
     * メールアドレスが登録されているかどうかに関わらず常に同じ結果を返す（アカウント存在の推測を防ぐため）。
     * 実際に登録されている場合のみ、内部でトークンを発行しメールを送信する。
     */
    @Transactional
    public void requestReset(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            String rawToken = tokenGenerator.generate();
            tokenRepository.save(PasswordResetToken.builder()
                    .userId(user.getId())
                    .tokenHash(tokenGenerator.hash(rawToken))
                    .expiresAt(Instant.now().plus(Duration.ofMinutes(mailProperties.resetTokenTtlMinutes())))
                    .build());
            sendResetEmail(user.getEmail(), rawToken);
        });
    }

    @Transactional
    public void confirmReset(String rawToken, String newPassword) {
        PasswordResetToken token = tokenRepository
                .findByTokenHash(tokenGenerator.hash(rawToken))
                .orElseThrow(InvalidPasswordResetTokenException::new);
        if (token.isUsed() || token.getExpiresAt().isBefore(Instant.now())) {
            throw new InvalidPasswordResetTokenException();
        }
        token.setUsed(true);
        tokenRepository.save(token);

        AuthCredential credential = authCredentialRepository
                .findByUserIdAndProvider(token.getUserId(), AuthProvider.EMAIL)
                .orElseThrow(InvalidPasswordResetTokenException::new);
        credential.setPasswordHash(passwordEncoder.encode(newPassword));
        authCredentialRepository.save(credential);

        // リセット後は既存のログインセッションを全て失効させる（パスワード漏えい時の対策として一般的な慣行）。
        refreshTokenRepository.findByUserIdAndRevokedFalse(token.getUserId()).forEach(t -> t.setRevoked(true));
    }

    private void sendResetEmail(String to, String rawToken) {
        String link = mailProperties.frontendBaseUrl() + "/reset-password?token=" + rawToken;
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(mailProperties.from());
        message.setTo(to);
        message.setSubject("【NovelShelf】パスワード再設定のご案内");
        message.setText("NovelShelfのパスワード再設定のリクエストを受け付けました。\n"
                + "以下のリンクから" + mailProperties.resetTokenTtlMinutes() + "分以内に新しいパスワードを設定してください。\n\n"
                + link
                + "\n\n心当たりがない場合はこのメールを無視してください。");
        try {
            mailSender.send(message);
        } catch (MailException e) {
            // SMTP未設定・接続失敗時もアカウント存在の有無を漏らさないため、呼び出し元へは例外を伝播しない。
            log.warn("パスワードリセットメールの送信に失敗しました（宛先: {}）", to, e);
        }
    }
}
