package com.novelshelf.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.novelshelf.TestcontainersConfiguration;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import(TestcontainersConfiguration.class)
class AuthFlowIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    private String uniqueEmail() {
        return "test-" + System.nanoTime() + "@example.com";
    }

    @Test
    void signupThenLoginIssuesTokens() {
        String email = uniqueEmail();
        ResponseEntity<Map> signup = restTemplate.postForEntity(
                "/api/v1/auth/signup",
                Map.of("email", email, "password", "password123", "displayName", "テスト"),
                Map.class);

        assertThat(signup.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(signup.getBody()).containsKeys("accessToken", "refreshToken", "expiresIn");

        ResponseEntity<Map> login = restTemplate.postForEntity(
                "/api/v1/auth/login", Map.of("email", email, "password", "password123"), Map.class);
        assertThat(login.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(login.getBody()).containsKey("accessToken");
    }

    @Test
    void loginWithWrongPasswordReturns401() {
        String email = uniqueEmail();
        restTemplate.postForEntity(
                "/api/v1/auth/signup", Map.of("email", email, "password", "password123"), Map.class);

        ResponseEntity<Map> login = restTemplate.postForEntity(
                "/api/v1/auth/login", Map.of("email", email, "password", "wrong-password"), Map.class);
        assertThat(login.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void duplicateSignupReturns409() {
        String email = uniqueEmail();
        restTemplate.postForEntity(
                "/api/v1/auth/signup", Map.of("email", email, "password", "password123"), Map.class);

        ResponseEntity<Map> second = restTemplate.postForEntity(
                "/api/v1/auth/signup", Map.of("email", email, "password", "password123"), Map.class);
        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void unauthenticatedRequestToProtectedEndpointReturns401() {
        ResponseEntity<Map> response = restTemplate.getForEntity("/api/v1/shelf", Map.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void refreshRotatesTokenAndOldTokenBecomesInvalid() {
        String email = uniqueEmail();
        ResponseEntity<Map> signup = restTemplate.postForEntity(
                "/api/v1/auth/signup", Map.of("email", email, "password", "password123"), Map.class);
        String refreshToken = (String) signup.getBody().get("refreshToken");

        ResponseEntity<Map> refreshed =
                restTemplate.postForEntity("/api/v1/auth/refresh", Map.of("refreshToken", refreshToken), Map.class);
        assertThat(refreshed.getStatusCode()).isEqualTo(HttpStatus.OK);

        ResponseEntity<Map> reuseOldToken =
                restTemplate.postForEntity("/api/v1/auth/refresh", Map.of("refreshToken", refreshToken), Map.class);
        assertThat(reuseOldToken.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void logoutRevokesAllRefreshTokens() {
        String email = uniqueEmail();
        ResponseEntity<Map> signup = restTemplate.postForEntity(
                "/api/v1/auth/signup", Map.of("email", email, "password", "password123"), Map.class);
        String accessToken = (String) signup.getBody().get("accessToken");
        String refreshToken = (String) signup.getBody().get("refreshToken");

        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.setBearerAuth(accessToken);
        ResponseEntity<Void> logout = restTemplate.exchange(
                "/api/v1/auth/logout",
                org.springframework.http.HttpMethod.POST,
                new org.springframework.http.HttpEntity<>(headers),
                Void.class);
        assertThat(logout.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        ResponseEntity<Map> reuse =
                restTemplate.postForEntity("/api/v1/auth/refresh", Map.of("refreshToken", refreshToken), Map.class);
        assertThat(reuse.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
