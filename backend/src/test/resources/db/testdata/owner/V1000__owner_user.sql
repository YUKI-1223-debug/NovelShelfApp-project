-- オーナー固定モードの結合テスト用(OwnerModeIntegrationTest)。本番のマイグレーションには含まれない
INSERT INTO users (id, email, display_name)
VALUES ('00000000-0000-0000-0000-00000000a001', 'owner@example.com', 'オーナー');
