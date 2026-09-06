package com.novelshelf.presentation.push;

import com.novelshelf.application.push.NovelUpdateNotifier;
import com.novelshelf.application.push.PushDeviceService;
import com.novelshelf.application.push.PushMessage;
import com.novelshelf.application.push.PushSender;
import com.novelshelf.domain.push.PushDeviceToken;
import com.novelshelf.domain.push.PushDeviceTokenRepository;
import com.novelshelf.domain.push.PushPlatform;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/push")
public class PushController {

    private final PushDeviceService pushDeviceService;
    private final PushDeviceTokenRepository pushDeviceTokenRepository;
    private final PushSender pushSender;
    private final NovelUpdateNotifier novelUpdateNotifier;

    public PushController(
            PushDeviceService pushDeviceService,
            PushDeviceTokenRepository pushDeviceTokenRepository,
            PushSender pushSender,
            NovelUpdateNotifier novelUpdateNotifier) {
        this.pushDeviceService = pushDeviceService;
        this.pushDeviceTokenRepository = pushDeviceTokenRepository;
        this.pushSender = pushSender;
        this.novelUpdateNotifier = novelUpdateNotifier;
    }

    public record RegisterDeviceRequest(@NotNull PushPlatform platform, @NotBlank String token) {}

    public record DeviceTokenRequest(@NotBlank String token) {}

    /** アプリ起動時にデバイストークンを登録／更新する。 */
    @PostMapping("/devices")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void registerDevice(@RequestBody RegisterDeviceRequest request, @AuthenticationPrincipal UUID userId) {
        pushDeviceService.register(userId, request.platform(), request.token());
    }

    /** ログアウト時・通知オフ時にトークンを解除する。 */
    @DeleteMapping("/devices")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unregisterDevice(@RequestBody DeviceTokenRequest request, @AuthenticationPrincipal UUID userId) {
        pushDeviceService.unregister(request.token());
    }

    /** 呼び出したユーザー自身の全端末へテスト通知を送る（配信経路の疎通確認用）。 */
    @PostMapping("/test")
    public Map<String, Object> sendTest(@AuthenticationPrincipal UUID userId) {
        List<PushDeviceToken> tokens = pushDeviceTokenRepository.findByUserId(userId);
        if (tokens.isEmpty()) {
            return Map.of("sent", 0, "message", "登録済みの端末がありません");
        }
        PushMessage message = new PushMessage(
                "NovelShelf",
                "テスト通知です。届いていれば設定は完了しています。",
                Map.of("type", "test"));
        List<String> tokenStrings = tokens.stream().map(PushDeviceToken::getToken).toList();
        List<String> dead = pushSender.send(tokenStrings, message);
        pushDeviceService.deleteTokens(dead);
        return Map.of("sent", tokenStrings.size() - dead.size(), "removed", dead.size());
    }

    /** 更新検知ジョブを即時実行する（cron を待たずに確認する用。外部サイトへの取得を伴うため時間がかかる）。 */
    @PostMapping("/run-update-check")
    public NovelUpdateNotifier.Summary runUpdateCheck() {
        return novelUpdateNotifier.run();
    }
}
