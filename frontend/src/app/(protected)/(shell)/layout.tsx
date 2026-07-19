import { BottomNav } from "@/components/BottomNav";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="flex-1 pb-4">{children}</main>
      <BottomNav />
    </div>
  );
}
