package com.novelshelf.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.novelshelf.TestcontainersConfiguration;
import com.novelshelf.infrastructure.security.OwnerModeService;
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

/** OWNER_USER_ID が DB に存在しないときは、起動時にオーナー固定モードを無効化する。 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "novelshelf.owner-mode.enabled=true",
            "novelshelf.owner-mode.user-id=00000000-0000-0000-0000-0000000fffff"
        })
@AutoConfigureTestRestTemplate
@Import(TestcontainersConfiguration.class)
class OwnerModeMissingUserIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private OwnerModeService ownerModeService;

    @Test
    void ownerModeIsDisabledWhenOwnerDoesNotExist() {
        assertThat(ownerModeService.isEnabled()).isFalse();

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Forwarded-For", "100.77.231.65");
        var response = restTemplate.exchange("/api/v1/shelf", HttpMethod.GET, new HttpEntity<>(headers), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
