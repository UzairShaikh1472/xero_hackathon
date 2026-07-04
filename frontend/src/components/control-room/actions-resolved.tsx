import { Bot, CheckCircle2, Mail, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { gbp, timeAgo } from "@/lib/kinetic/format";
import type { ResolvedAction } from "@/lib/kinetic/types";

import { LensHeader } from "./shared";

export function ActionsResolved({ resolved }: { resolved: ResolvedAction[] }) {
  return (
    <section className="space-y-4">
      <LensHeader
        icon={<CheckCircle2 className="size-4 text-positive" />}
        title="Resolved"
        subtitle="Follow-ups confirmed paid: invoice no longer outstanding in Xero"
        right={
          <Badge variant="outline" className="border-positive/30 bg-positive/10 text-positive">
            {resolved.length} collected
          </Badge>
        }
      />

      {resolved.length === 0 ? (
        <p className="rounded-xl border border-dashed hairline bg-surface-2/40 p-6 text-sm text-muted-foreground">
          Resolved follow-ups appear here once payment is recorded in Xero and you refresh.
          Send a reminder first, then record payment against the invoice in Xero.
        </p>
      ) : (
        <ul className="divide-y divide-hairline rounded-2xl border hairline bg-surface-2/30">
          {resolved.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0 text-positive" />
                  <span className="font-medium">{item.contactName}</span>
                  <span className="text-sm text-muted-foreground">{item.invoiceNumber}</span>
                  <ChannelBadge channel={item.channel} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.channel === "email" ? "Email" : "Call"} sent{" "}
                  <span suppressHydrationWarning>{timeAgo(item.sentAt)}</span>
                  {" · "}
                  confirmed via Xero{" "}
                  <span suppressHydrationWarning>{timeAgo(item.resolvedAt)}</span>
                </p>
              </div>
              <div className="numeric shrink-0 text-right">
                <div className="text-lg font-semibold text-positive">
                  +{gbp(item.amountCollected)}
                </div>
                <div className="text-xs text-muted-foreground">collected</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ChannelBadge({ channel }: { channel: ResolvedAction["channel"] }) {
  if (channel === "email") {
    return (
      <Badge variant="outline" className="gap-1 border-hairline">
        <Mail className="size-3" />
        Email
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1 border-hairline">
      <Bot className="size-3" />
      <Phone className="size-3" />
      Call
    </Badge>
  );
}
