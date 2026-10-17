import { SettingsProvider } from "@/lib/settings/SettingsProvider";

// ログインは廃止した(サーバーのオーナー固定モードで認証する)。オフライン保存した作品は
// サーバーにつながらなくても読めるよう、接続の可否で画面を止めない(接続できないことは ConnectionBanner が示す)。
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>;
}
