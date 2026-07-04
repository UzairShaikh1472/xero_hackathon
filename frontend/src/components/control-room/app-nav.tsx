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
    <nav className="border-b hairline bg-surface/40">
      <div className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-4 sm:px-6">
        {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => {
          const active = exact ? pathname === to : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
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
