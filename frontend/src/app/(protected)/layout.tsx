import { RequireAuth } from "@/lib/auth/RequireAuth";
import { SettingsProvider } from "@/lib/settings/SettingsProvider";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <SettingsProvider>{children}</SettingsProvider>
    </RequireAuth>
  );
}
