package com.novelshelf.infrastructure.push;

import com.google.firebase.messaging.BatchResponse;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.MulticastMessage;
import com.google.firebase.messaging.Notification;
import com.google.firebase.messaging.SendResponse;
import com.novelshelf.application.push.PushMessage;
import com.novelshelf.application.push.PushSender;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Firebase Cloud Messaging 経由の配信（Android は FCM、iOS は APNs 中継）。 */
public class FirebasePushSender implements PushSender {

    private static final Logger log = LoggerFactory.getLogger(FirebasePushSender.class);
    /** FCM のマルチキャスト上限。 */
    private static final int BATCH_SIZE = 500;

    private final FirebaseMessaging messaging;

    public FirebasePushSender(FirebaseMessaging messaging) {
        this.messaging = messaging;
    }

    @Override
    public List<String> send(List<String> tokens, PushMessage message) {
        List<String> deadTokens = new ArrayList<>();
        for (int i = 0; i < tokens.size(); i += BATCH_SIZE) {
            List<String> chunk = tokens.subList(i, Math.min(i + BATCH_SIZE, tokens.size()));
            MulticastMessage multicast = MulticastMessage.builder()
                    .addAllTokens(chunk)
                    .setNotification(Notification.builder()
                            .setTitle(message.title())
                            .setBody(message.body())
                            .build())
                    .putAllData(message.data())
                    .build();
            try {
                BatchResponse response = messaging.sendEachForMulticast(multicast);
                deadTokens.addAll(collectDeadTokens(chunk, response));
                if (response.getFailureCount() > 0) {
                    log.warn("FCM 送信: 成功{} / 失敗{}", response.getSuccessCount(), response.getFailureCount());
                }
            } catch (FirebaseMessagingException e) {
                log.error("FCM 送信に失敗しました（chunk size={}）", chunk.size(), e);
            }
        }
        return deadTokens;
    }

    private List<String> collectDeadTokens(List<String> chunk, BatchResponse response) {
        List<String> dead = new ArrayList<>();
        List<SendResponse> responses = response.getResponses();
        for (int j = 0; j < responses.size(); j++) {
            FirebaseMessagingException ex = responses.get(j).getException();
            if (ex == null) {
                continue;
            }
            MessagingErrorCode code = ex.getMessagingErrorCode();
            if (code == MessagingErrorCode.UNREGISTERED || code == MessagingErrorCode.INVALID_ARGUMENT) {
                dead.add(chunk.get(j));
            }
        }
        return dead;
    }
}
