package com.novelshelf.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.novelshelf.TestcontainersConfiguration;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** オーナー固定モード(個人利用アプリ化 フェーズ2 設計書 §4、§13 のテスト)。 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "novelshelf.owner-mode.enabled=true",
            "novelshelf.owner-mode.user-id=00000000-0000-0000-0000-00000000a001",
            "spring.flyway.locations=classpath:db/migration,classpath:db/testdata/owner"
        })
@AutoConfigureTestRestTemplate
@Import({TestcontainersConfiguration.class, OwnerModeIntegrationTest.WhoAmIController.class})
class OwnerModeIntegrationTest {

    private static final String OWNER_ID = "00000000-0000-0000-0000-00000000a001";
    private static final String TAILNET_IP = "100.77.231.65";

    /** 認証された principal(users.id)をそのまま返す、テスト専用のエンドポイント。 */
    @RestController
    static class WhoAmIController {
        @GetMapping("/api/v1/test/whoami")
        Map<String, String> whoami(@AuthenticationPrincipal UUID userId) {
            return Map.of("userId", String.valueOf(userId));
        }
    }

    @Autowired
    private TestRestTemplate restTemplate;

    private ResponseEntity<Map> whoami(String xff, String bearer) {
        HttpHeaders headers = new HttpHeaders();
        if (xff != null) {
            headers.set("X-Forwarded-For", xff);
        }
        if (bearer != null) {
            headers.setBearerAuth(bearer);
        }
        return restTemplate.exchange("/api/v1/test/whoami", HttpMethod.GET, new HttpEntity<>(headers), Map.class);
    }

    @Test
    void tailnetWithoutTokenIsOwner() {
        ResponseEntity<Map> response = whoami(TAILNET_IP, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("userId", OWNER_ID);
    }

    @Test
    void ownerCanUseRealApi() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Forwarded-For", TAILNET_IP);
        ResponseEntity<String> response = restTemplate.exchange(
                "/api/v1/shelf", HttpMethod.GET, new HttpEntity<>(headers), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void nonTailnetWithoutTokenIsUnauthorized() {
        assertThat(whoami("203.0.113.10", null).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(whoami(null, null).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void spoofedTailnetIpOnTheLeftIsUnauthorized() {
        assertThat(whoami("100.100.100.100, 172.18.0.5", null).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void validJwtTakesPrecedenceOverOwnerMode() {
        String email = "jwt-" + System.nanoTime() + "@example.com";
        ResponseEntity<Map> signup = restTemplate.postForEntity(
                "/api/v1/auth/signup", Map.of("email", email, "password", "password123"), Map.class);
        String accessToken = (String) signup.getBody().get("accessToken");

        ResponseEntity<Map> response = whoami(TAILNET_IP, accessToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("userId")).isNotEqualTo(OWNER_ID);
    }

    @Test
    void invalidJwtIsNotReplacedByOwner() {
        // Authorization ヘッダがあるときはオーナー扱いにしない(壊れたトークンでオーナーになれないこと)
        assertThat(whoami(TAILNET_IP, "invalid.token.value").getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
