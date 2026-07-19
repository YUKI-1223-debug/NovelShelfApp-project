package com.novelshelf.presentation.auth;

import com.novelshelf.application.auth.AuthService;
import com.novelshelf.application.auth.TokenPair;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    public record SignupRequest(
            @Email @NotBlank String email, @NotBlank @Size(min = 8) String password, String displayName) {}

    public record LoginRequest(@Email @NotBlank String email, @NotBlank String password) {}

    public record RefreshRequest(@NotBlank String refreshToken) {}

    public record AuthTokensResponse(String accessToken, String refreshToken, long expiresIn) {
        static AuthTokensResponse from(TokenPair pair) {
            return new AuthTokensResponse(pair.accessToken(), pair.refreshToken(), pair.expiresInSeconds());
        }
    }

    @PostMapping("/signup")
    public ResponseEntity<AuthTokensResponse> signup(@Valid @RequestBody SignupRequest request) {
        String displayName = (request.displayName() == null || request.displayName().isBlank())
                ? request.email()
                : request.displayName();
        TokenPair tokens = authService.signup(request.email(), request.password(), displayName);
        return ResponseEntity.status(HttpStatus.CREATED).body(AuthTokensResponse.from(tokens));
    }

    @PostMapping("/login")
    public AuthTokensResponse login(@Valid @RequestBody LoginRequest request) {
        return AuthTokensResponse.from(authService.login(request.email(), request.password()));
    }

    @PostMapping("/refresh")
    public AuthTokensResponse refresh(@Valid @RequestBody RefreshRequest request) {
        return AuthTokensResponse.from(authService.refresh(request.refreshToken()));
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@AuthenticationPrincipal UUID currentUserId) {
        authService.logoutAll(currentUserId);
    }
}
