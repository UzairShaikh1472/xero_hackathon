import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, LayoutDashboard, Zap } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/app/cash", label: "Cash Lens", icon: Activity, exact: false },
  { to: "/app/actions", label: "Actions", icon: Zap, exact: false },
] as const;

export function AppNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="border-b hairline bg-surface/35 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] gap-2 overflow-x-auto px-4 py-3 sm:px-6">
        {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => {
          const active = exact ? pathname === to : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-surface-2/85 text-muted-foreground hover:bg-white/80 hover:text-foreground",
              )}
              style={active ? { boxShadow: "var(--shadow-neon)" } : undefined}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
