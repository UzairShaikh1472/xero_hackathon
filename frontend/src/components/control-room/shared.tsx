import { cn } from "@/lib/utils";
import type { Urgency } from "@/lib/kinetic/types";

export function LensHeader({
  icon,
  title,
  subtitle,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="grid size-8 place-items-center rounded-xl bg-secondary text-foreground">
          {icon}
        </div>
        <div>
          <div className="text-lg font-semibold">{title}</div>
          <div className="text-sm text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      {right}
    </div>
  );
}

export function UrgencyDot({ u }: { u: Urgency }) {
  const c =
    u === "critical" ? "bg-critical" :
    u === "high" ? "bg-warning" :
    u === "medium" ? "bg-info" : "bg-muted-foreground";
  return <span className={cn("size-2 rounded-full", c)} />;
}
