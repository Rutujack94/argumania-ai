import { Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { ReactNode } from "react";
import { toast } from "sonner";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/arena", label: "Arena" },
  { to: "/history", label: "History" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/knowledge", label: "Knowledge" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen relative">
      <div className="pointer-events-none absolute inset-0 -z-10 hero-bg" />
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-96 w-[80vw] -translate-x-1/2 mesh-bg" />
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[oklch(0.72_0.22_300)] to-[oklch(0.78_0.16_210)] font-display text-sm font-bold text-background">
              L
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">
              LovableDebate
            </span>
          </Link>
          <nav className="hidden gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
                activeProps={{ className: "rounded-md px-3 py-2 text-sm text-foreground bg-white/5" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-xs">
            <span className="hidden text-muted-foreground sm:inline">
              {user?.email}
            </span>
            <button
              onClick={handleSignOut}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
    </div>
  );
}
