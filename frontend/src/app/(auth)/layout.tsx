import { RedirectIfAuthenticated } from "@/lib/auth/RedirectIfAuthenticated";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <RedirectIfAuthenticated>
      <main className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">NovelShelf</h1>
            <p className="mt-1 text-sm text-muted">広告なしの、静かな読書のために。</p>
          </div>
          {children}
        </div>
      </main>
    </RedirectIfAuthenticated>
  );
}
